import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  supportAttachments,
  supportContacts,
  supportEvents,
  supportMessages,
  supportRequests,
} from "../../../../db/schema.js";
import { HttpError, requireRole } from "../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

const AGENT_ROLES = ["superadmin", "administration", "proviseur"];
const STATUSES = new Set([
  "nouveau",
  "a_qualifier",
  "assigne",
  "en_cours",
  "attente_demandeur",
  "attente_interne",
  "resolu",
  "clos",
  "indesirable",
]);
const PRIORITIES = new Set(["p1", "p2", "p3", "p4"]);

function publicCode(req: VercelRequest): string {
  const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
  if (!code || !/^BC-\d{4}-\d{6}$/.test(code)) {
    throw new HttpError(400, "Numéro de demande invalide");
  }
  return code;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!req.method || !["GET", "PATCH"].includes(req.method)) {
    return methodNotAllowed(res, ["GET", "PATCH"]);
  }

  return handleApi(res, async () => {
    const user = await requireRole(req, AGENT_ROLES);
    const code = publicCode(req);
    const [request] = await db
      .select()
      .from(supportRequests)
      .where(eq(supportRequests.publicCode, code))
      .limit(1);
    if (!request) throw new HttpError(404, "Demande introuvable");

    if (req.method === "PATCH") {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const nextStatus = typeof body.status === "string" ? body.status : request.status;
      const nextPriority = typeof body.priority === "string" ? body.priority : request.priority;
      if (!STATUSES.has(nextStatus)) throw new HttpError(400, "Statut invalide");
      if (!PRIORITIES.has(nextPriority)) throw new HttpError(400, "Priorité invalide");

      const now = new Date();
      const [updated] = await db.transaction(async (tx) => {
        const [saved] = await tx
          .update(supportRequests)
          .set({
            status: nextStatus,
            priority: nextPriority,
            assignedTo: body.assignToMe === true ? user.id : request.assignedTo,
            resolvedAt:
              nextStatus === "resolu" || nextStatus === "clos"
                ? request.resolvedAt ?? now
                : request.resolvedAt,
            closedAt: nextStatus === "clos" ? now : null,
          })
          .where(eq(supportRequests.id, request.id))
          .returning();
        await tx.insert(supportEvents).values({
          requestId: request.id,
          eventType: "request.updated",
          actorType: "agent",
          actorId: user.id,
          fromValue: { status: request.status, priority: request.priority, assignedTo: request.assignedTo },
          toValue: { status: nextStatus, priority: nextPriority, assignedTo: saved.assignedTo },
          correlationId: randomUUID(),
        });
        return [saved];
      });
      return { request: updated };
    }

    const [contacts, messages, attachments] = await Promise.all([
      db
        .select({
          id: supportContacts.id,
          channel: supportContacts.channel,
          value: supportContacts.value,
          isPrimary: supportContacts.isPrimary,
          isVerified: supportContacts.isVerified,
        })
        .from(supportContacts)
        .where(and(eq(supportContacts.requestId, request.id), eq(supportContacts.usageScope, "support"))),
      db
        .select()
        .from(supportMessages)
        .where(and(eq(supportMessages.requestId, request.id), ne(supportMessages.direction, "internal")))
        .orderBy(asc(supportMessages.createdAt)),
      db
        .select({
          id: supportAttachments.id,
          originalName: supportAttachments.originalName,
          documentType: supportAttachments.documentType,
          concernsLabel: supportAttachments.concernsLabel,
          detectedMime: supportAttachments.detectedMime,
          sizeBytes: supportAttachments.sizeBytes,
          scanStatus: supportAttachments.scanStatus,
          createdAt: supportAttachments.createdAt,
        })
        .from(supportAttachments)
        .where(eq(supportAttachments.requestId, request.id)),
    ]);

    return { request, contacts, messages, attachments };
  });
}
