import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  supportCallbackTasks,
  supportContacts,
  supportEvents,
  supportRequests,
} from "../../../../../db/schema.js";
import { HttpError } from "../../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";
import {
  assertSupportRequestAccess,
  requireSupportAgent,
} from "../../../../_shared/support-agent-access.js";
import {
  planSupportCallbackTransition,
  type SupportCallbackAction,
} from "../../../../../shared/support-callback-policy.js";

const CALLBACK_ACTIONS = new Set<SupportCallbackAction>(["claim", "complete", "cancel"]);

function publicCode(req: VercelRequest): string {
  const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
  if (!code || !/^BC-\d{4}-\d{6}$/.test(code)) {
    throw new HttpError(400, "Numéro de demande invalide");
  }
  return code;
}

function uuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, `${field} invalide`);
  }
  return value;
}

function callbackView<T extends {
  id: string;
  phoneContactId: string;
  assignedTo: string | null;
  dueAt: Date | null;
  status: string;
  outcome: string | null;
  completedAt: Date | null;
  createdAt: Date;
}>(callback: T, userId: string) {
  return {
    id: callback.id,
    phoneContactId: callback.phoneContactId,
    dueAt: callback.dueAt,
    status: callback.status,
    outcome: callback.outcome,
    completedAt: callback.completedAt,
    createdAt: callback.createdAt,
    assigned: callback.assignedTo !== null,
    assignedToCurrentAgent: callback.assignedTo === userId,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!req.method || !["POST", "PATCH"].includes(req.method)) {
    return methodNotAllowed(res, ["POST", "PATCH"]);
  }

  return handleApi(res, async () => {
    const { user, access } = await requireSupportAgent(req);
    const code = publicCode(req);
    const [request] = await db
      .select({
        id: supportRequests.id,
        status: supportRequests.status,
        assignedTeam: supportRequests.assignedTeam,
      })
      .from(supportRequests)
      .where(eq(supportRequests.publicCode, code))
      .limit(1);
    if (!request) throw new HttpError(404, "Demande introuvable");
    assertSupportRequestAccess(access, request.assignedTeam);

    const body = (req.body ?? {}) as Record<string, unknown>;
    if (req.method === "POST") {
      if (["clos", "indesirable"].includes(request.status)) {
        throw new HttpError(409, "Rouvrez le dossier avant de programmer un rappel");
      }
      const requestedPhoneId = body.phoneContactId === undefined
        ? null
        : uuid(body.phoneContactId, "Contact téléphonique");
      const phoneContacts = await db
        .select({ id: supportContacts.id })
        .from(supportContacts)
        .where(
          and(
            eq(supportContacts.requestId, request.id),
            eq(supportContacts.channel, "phone"),
            eq(supportContacts.usageScope, "support"),
            isNull(supportContacts.disabledAt)
          )
        );
      const phone = requestedPhoneId
        ? phoneContacts.find((contact) => contact.id === requestedPhoneId)
        : phoneContacts[0];
      if (!phone) throw new HttpError(409, "Aucun téléphone actif n'est disponible pour ce dossier");

      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`support-callback:${request.id}`}))`);
        const [existing] = await tx
          .select()
          .from(supportCallbackTasks)
          .where(
            and(
              eq(supportCallbackTasks.requestId, request.id),
              eq(supportCallbackTasks.phoneContactId, phone.id),
              inArray(supportCallbackTasks.status, ["todo", "in_progress"])
            )
          )
          .limit(1);
        if (existing) return { callback: existing, duplicate: true };

        const [created] = await tx
          .insert(supportCallbackTasks)
          .values({
            requestId: request.id,
            phoneContactId: phone.id,
            dueAt: new Date(),
          })
          .returning();
        await tx.insert(supportEvents).values({
          requestId: request.id,
          eventType: "callback.created",
          actorType: "agent",
          actorId: user.id,
          toValue: { callbackId: created.id },
          correlationId: randomUUID(),
        });
        return { callback: created, duplicate: false };
      });
      res.status(result.duplicate ? 200 : 201);
      return { callback: callbackView(result.callback, user.id), duplicate: result.duplicate };
    }

    const callbackId = uuid(body.callbackId, "Rappel");
    const action = typeof body.action === "string" && CALLBACK_ACTIONS.has(body.action as SupportCallbackAction)
      ? (body.action as SupportCallbackAction)
      : null;
    if (!action) throw new HttpError(400, "Action de rappel invalide");
    const [callback] = await db
      .select()
      .from(supportCallbackTasks)
      .where(
        and(
          eq(supportCallbackTasks.id, callbackId),
          eq(supportCallbackTasks.requestId, request.id)
        )
      )
      .limit(1);
    if (!callback) throw new HttpError(404, "Rappel introuvable");

    const completedAt = new Date();
    const transition = planSupportCallbackTransition({
      status: callback.status,
      assignedTo: callback.assignedTo,
      actorId: user.id,
      action,
      outcome: body.outcome,
      completedAt: completedAt.toISOString(),
    });
    if (!transition.ok) {
      const messages = {
        invalid_status: "État du rappel invalide",
        already_finished: "Ce rappel est déjà terminé",
        owned_by_other: "Ce rappel est déjà pris en charge par un autre agent",
        outcome_required: "Indiquez le résultat du rappel",
      } as const;
      throw new HttpError(transition.reason === "outcome_required" ? 400 : 409, messages[transition.reason]);
    }
    if (!transition.changed) {
      return { callback: callbackView(callback, user.id), duplicate: true };
    }

    const assignmentCondition = callback.assignedTo === null
      ? isNull(supportCallbackTasks.assignedTo)
      : eq(supportCallbackTasks.assignedTo, callback.assignedTo);
    const [updated] = await db.transaction(async (tx) => {
      const [saved] = await tx
        .update(supportCallbackTasks)
        .set({
          status: transition.status,
          assignedTo: transition.assignedTo,
          outcome: transition.outcome,
          completedAt: transition.completedAt ? completedAt : null,
        })
        .where(
          and(
            eq(supportCallbackTasks.id, callback.id),
            eq(supportCallbackTasks.status, callback.status),
            assignmentCondition
          )
        )
        .returning();
      if (!saved) {
        throw new HttpError(409, "Ce rappel vient d'être modifié par un autre agent");
      }
      await tx.insert(supportEvents).values({
        requestId: request.id,
        eventType: `callback.${transition.status}`,
        actorType: "agent",
        actorId: user.id,
        fromValue: { status: callback.status },
        toValue: {
          callbackId: saved.id,
          status: saved.status,
          outcomeRecorded: Boolean(saved.outcome),
        },
        correlationId: randomUUID(),
      });
      return [saved];
    });
    return { callback: callbackView(updated, user.id), duplicate: false };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "8kb" } } };
