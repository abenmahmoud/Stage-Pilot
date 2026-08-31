import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  supportCallbackTasks,
  supportContacts,
  supportEvents,
  supportRequests,
} from "../../../../../db/schema.js";
import { HttpError } from "../../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";
import { idempotencyKey } from "../../../../_shared/support.js";
import {
  assertSupportRequestAccess,
  requireSupportAgent,
} from "../../../../_shared/support-agent-access.js";
import { enforceAgentWriteRateLimit } from "../../../../_shared/support-rate-limits.js";
import {
  normalizeSupportCallbackOutcome,
  planSupportCallbackTransition,
  type SupportCallbackAction,
  type SupportCallbackStatus,
} from "../../../../../shared/support-callback-policy.js";
import {
  createSupportCallbackConfirmation,
  type SupportCallbackConfirmationOperation,
} from "../../../../../shared/support-callback-confirmation.js";
import {
  isSupportAgentCallbackCreateInput,
  isSupportAgentCallbackMutationInput,
  singleSupportAgentRouteValue,
} from "../../../../../shared/support-agent-mutation-input-policy.js";

const CALLBACK_ACTIONS = new Set<SupportCallbackAction>(["claim", "complete", "cancel"]);

function callbackOperation(action: SupportCallbackAction): SupportCallbackConfirmationOperation {
  if (action === "claim") return "support_callback_claim";
  if (action === "complete") return "support_callback_complete";
  return "support_callback_cancel";
}

function callbackEventType(action: SupportCallbackAction): string {
  if (action === "claim") return "callback.in_progress";
  if (action === "complete") return "callback.done";
  return "callback.cancelled";
}

function callbackStatus(value: string): SupportCallbackStatus {
  if (!["todo", "in_progress", "done", "cancelled"].includes(value)) {
    throw new HttpError(409, "État du rappel invalide");
  }
  return value as SupportCallbackStatus;
}

function publicCode(req: VercelRequest): string {
  const code = singleSupportAgentRouteValue(req.query.code);
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!req.method || !["POST", "PATCH"].includes(req.method)) {
    return methodNotAllowed(res, ["POST", "PATCH"]);
  }

  return handleApi(res, async () => {
    const { user, access, institutionId } = await requireSupportAgent(req);
    const code = publicCode(req);
    const bodyInput = req.method === "POST" && req.body === undefined ? {} : req.body;
    if (req.method === "POST" && !isSupportAgentCallbackCreateInput(bodyInput)) {
      throw new HttpError(400, "Création du rappel invalide");
    }
    if (req.method === "PATCH" && !isSupportAgentCallbackMutationInput(bodyInput)) {
      throw new HttpError(400, "Action de rappel invalide");
    }
    const body = bodyInput;
    const [request] = await db
      .select({
        id: supportRequests.id,
        status: supportRequests.status,
        assignedTeam: supportRequests.assignedTeam,
      })
      .from(supportRequests)
      .where(and(
        eq(supportRequests.institutionId, institutionId),
        eq(supportRequests.publicCode, code)
      ))
      .limit(1);
    if (!request) throw new HttpError(404, "Demande introuvable");
    assertSupportRequestAccess(access, request.assignedTeam);

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
      const operationId = uuid(idempotencyKey(req), "Clé de rappel");
      await enforceAgentWriteRateLimit(user.id);

      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`support-callback:${request.id}`}))`);
        const [operationEvent] = await tx
          .select({
            eventType: supportEvents.eventType,
            actorId: supportEvents.actorId,
            callbackId: sql<string | null>`${supportEvents.toValue}->>'callbackId'`,
            createdAt: supportEvents.createdAt,
            correlationId: supportEvents.correlationId,
          })
          .from(supportEvents)
          .where(and(
            eq(supportEvents.requestId, request.id),
            eq(supportEvents.correlationId, operationId)
          ))
          .orderBy(desc(supportEvents.createdAt))
          .limit(1);
        if (operationEvent) {
          if (
            !["callback.created", "callback.creation_reused"].includes(operationEvent.eventType)
            || operationEvent.actorId !== user.id
            || !operationEvent.callbackId
          ) {
            throw new HttpError(409, "Cette clé de rappel a déjà été utilisée pour une autre action");
          }
          const [replayed] = await tx
            .select()
            .from(supportCallbackTasks)
            .where(and(
              eq(supportCallbackTasks.requestId, request.id),
              eq(supportCallbackTasks.id, operationEvent.callbackId)
            ))
            .limit(1);
          if (!replayed || replayed.phoneContactId !== phone.id) {
            throw new HttpError(409, "Cette clé de rappel correspond à un autre contact");
          }
          return {
            callback: replayed,
            duplicate: true,
            confirmedAt: operationEvent.createdAt,
            correlationId: operationEvent.correlationId,
          };
        }

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
        if (existing) {
          if (existing.phoneContactId !== phone.id) {
            throw new HttpError(409, "Un rappel actif existe déjà pour un autre téléphone");
          }
          const [reuseEvent] = await tx.insert(supportEvents).values({
            requestId: request.id,
            eventType: "callback.creation_reused",
            actorType: "agent",
            actorId: user.id,
            toValue: {
              callbackId: existing.id,
              status: existing.status,
              reused: true,
            },
            correlationId: operationId,
          }).returning({
            createdAt: supportEvents.createdAt,
            correlationId: supportEvents.correlationId,
          });
          if (!reuseEvent) {
            throw new HttpError(409, "La reprise du rappel n'a pas été confirmée par le journal du dossier");
          }
          return {
            callback: existing,
            duplicate: true,
            confirmedAt: reuseEvent.createdAt,
            correlationId: reuseEvent.correlationId,
          };
        }

        const [created] = await tx
          .insert(supportCallbackTasks)
          .values({
            requestId: request.id,
            phoneContactId: phone.id,
            dueAt: new Date(),
          })
          .returning();
        const [createdEvent] = await tx.insert(supportEvents).values({
          requestId: request.id,
          eventType: "callback.created",
          actorType: "agent",
          actorId: user.id,
          toValue: { callbackId: created.id, status: created.status },
          correlationId: operationId,
        }).returning({
          createdAt: supportEvents.createdAt,
          correlationId: supportEvents.correlationId,
        });
        if (!createdEvent) {
          throw new HttpError(409, "Le rappel n'a pas été confirmé par le journal du dossier");
        }
        return {
          callback: created,
          duplicate: false,
          confirmedAt: createdEvent.createdAt,
          correlationId: createdEvent.correlationId,
        };
      });
      res.status(result.duplicate ? 200 : 201);
      return {
        confirmation: createSupportCallbackConfirmation({
          operation: "support_callback_create",
          publicCode: code,
          callbackId: result.callback.id,
          previousStatus: null,
          callbackStatus: callbackStatus(result.callback.status),
          duplicate: result.duplicate,
          confirmedAt: result.confirmedAt,
          correlationId: result.correlationId,
        }),
      };
    }

    const callbackId = uuid(body.callbackId, "Rappel");
    const action = typeof body.action === "string" && CALLBACK_ACTIONS.has(body.action as SupportCallbackAction)
      ? (body.action as SupportCallbackAction)
      : null;
    if (!action) throw new HttpError(400, "Action de rappel invalide");
    const operationId = uuid(idempotencyKey(req), "Clé d'action");
    const operation = callbackOperation(action);
    const expectedEventType = callbackEventType(action);
    await enforceAgentWriteRateLimit(user.id);
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

    const [operationEvent] = await db
      .select({
        eventType: supportEvents.eventType,
        actorId: supportEvents.actorId,
        callbackId: sql<string | null>`${supportEvents.toValue}->>'callbackId'`,
        previousStatus: sql<string | null>`${supportEvents.fromValue}->>'status'`,
        callbackStatus: sql<string | null>`${supportEvents.toValue}->>'status'`,
        createdAt: supportEvents.createdAt,
        correlationId: supportEvents.correlationId,
      })
      .from(supportEvents)
      .where(and(
        eq(supportEvents.requestId, request.id),
        eq(supportEvents.correlationId, operationId)
      ))
      .orderBy(desc(supportEvents.createdAt))
      .limit(1);
    if (operationEvent) {
      if (
        operationEvent.eventType !== expectedEventType
        || operationEvent.actorId !== user.id
        || operationEvent.callbackId !== callback.id
        || !operationEvent.previousStatus
        || !operationEvent.callbackStatus
      ) {
        throw new HttpError(409, "Cette clé d'action a déjà été utilisée pour un autre rappel");
      }
      if (action !== "claim") {
        const repeatedOutcome = normalizeSupportCallbackOutcome(body.outcome);
        if (!repeatedOutcome || repeatedOutcome !== callback.outcome) {
          throw new HttpError(409, "Cette clé d'action correspond à un autre résultat de rappel");
        }
      }
      return {
        confirmation: createSupportCallbackConfirmation({
          operation,
          publicCode: code,
          callbackId: callback.id,
          previousStatus: callbackStatus(operationEvent.previousStatus),
          callbackStatus: callbackStatus(operationEvent.callbackStatus),
          duplicate: true,
          confirmedAt: operationEvent.createdAt,
          correlationId: operationEvent.correlationId,
        }),
      };
    }

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
      const [existingEvent] = await db
        .select({
          previousStatus: sql<string | null>`${supportEvents.fromValue}->>'status'`,
          callbackStatus: sql<string | null>`${supportEvents.toValue}->>'status'`,
          createdAt: supportEvents.createdAt,
          correlationId: supportEvents.correlationId,
        })
        .from(supportEvents)
        .where(and(
          eq(supportEvents.requestId, request.id),
          eq(supportEvents.eventType, expectedEventType),
          eq(supportEvents.actorId, user.id),
          sql`${supportEvents.toValue}->>'callbackId' = ${callback.id}`
        ))
        .orderBy(desc(supportEvents.createdAt))
        .limit(1);
      if (!existingEvent?.previousStatus || !existingEvent.callbackStatus) {
        throw new HttpError(409, "Le rappel pris en charge n'a pas de confirmation exploitable");
      }
      return {
        confirmation: createSupportCallbackConfirmation({
          operation,
          publicCode: code,
          callbackId: callback.id,
          previousStatus: callbackStatus(existingEvent.previousStatus),
          callbackStatus: callbackStatus(existingEvent.callbackStatus),
          duplicate: true,
          confirmedAt: existingEvent.createdAt,
          correlationId: existingEvent.correlationId,
        }),
      };
    }

    const assignmentCondition = callback.assignedTo === null
      ? isNull(supportCallbackTasks.assignedTo)
      : eq(supportCallbackTasks.assignedTo, callback.assignedTo);
    const result = await db.transaction(async (tx) => {
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
      const [transitionEvent] = await tx.insert(supportEvents).values({
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
        correlationId: operationId,
      }).returning({
        createdAt: supportEvents.createdAt,
        correlationId: supportEvents.correlationId,
      });
      if (!transitionEvent) {
        throw new HttpError(409, "L'action de rappel n'a pas été confirmée par le journal du dossier");
      }
      return {
        callback: saved,
        confirmedAt: transitionEvent.createdAt,
        correlationId: transitionEvent.correlationId,
      };
    });
    return {
      confirmation: createSupportCallbackConfirmation({
        operation,
        publicCode: code,
        callbackId: result.callback.id,
        previousStatus: callbackStatus(callback.status),
        callbackStatus: callbackStatus(result.callback.status),
        duplicate: false,
        confirmedAt: result.confirmedAt,
        correlationId: result.correlationId,
      }),
    };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "8kb" } } };
