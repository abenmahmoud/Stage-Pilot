import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  supportEvents,
  supportMessages,
  supportRequests,
} from "../../../../../db/schema.js";
import { HttpError } from "../../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";
import {
  assertNoForbiddenSupportSecret,
  idempotencyKey,
  sha256,
} from "../../../../_shared/support.js";
import {
  assertSupportRequestAccess,
  requireSupportAgent,
} from "../../../../_shared/support-agent-access.js";
import { enforceAgentWriteRateLimit } from "../../../../_shared/support-rate-limits.js";
import { createSupportInternalNoteConfirmation } from "../../../../../shared/support-internal-note-confirmation.js";


export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  return handleApi(res, async () => {
    const { user, access, institutionId } = await requireSupportAgent(req);
    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    if (!code || !/^BC-\d{4}-\d{6}$/.test(code)) {
      throw new HttpError(400, "Numéro de demande invalide");
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.note !== "string") throw new HttpError(400, "Note requise");
    const note = body.note
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .trim();
    if (!note || note.length > 5000) throw new HttpError(400, "Note invalide");
    assertNoForbiddenSupportSecret(note);

    const [request] = await db
      .select({ id: supportRequests.id, assignedTeam: supportRequests.assignedTeam })
      .from(supportRequests)
      .where(and(
        eq(supportRequests.institutionId, institutionId),
        eq(supportRequests.publicCode, code)
      ))
      .limit(1);
    if (!request) throw new HttpError(404, "Demande introuvable");
    assertSupportRequestAccess(access, request.assignedTeam);
    await enforceAgentWriteRateLimit(user.id);

    const idempotencyHash = sha256(idempotencyKey(req));
    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(supportMessages)
        .values({
          requestId: request.id,
          direction: "internal",
          channel: "system",
          authorUserId: user.id,
          authorLabel: "Note interne",
          bodyText: note,
          clientIdempotencyKeyHash: idempotencyHash,
          deliveryStatus: "stored",
          validatedBy: user.id,
          validatedAt: new Date(),
        })
        .onConflictDoNothing({
          target: [supportMessages.requestId, supportMessages.clientIdempotencyKeyHash],
        })
        .returning({ id: supportMessages.id, createdAt: supportMessages.createdAt });
      if (!created) {
        const [existing] = await tx
          .select({
            id: supportMessages.id,
            createdAt: supportMessages.createdAt,
            bodyText: supportMessages.bodyText,
            authorUserId: supportMessages.authorUserId,
          })
          .from(supportMessages)
          .where(
            and(
              eq(supportMessages.clientIdempotencyKeyHash, idempotencyHash),
              eq(supportMessages.requestId, request.id)
            )
          )
          .limit(1);
        if (!existing) throw new Error("Idempotent internal note could not be recovered");
        if (existing.bodyText !== note || existing.authorUserId !== user.id) {
          throw new HttpError(409, "Cette clé correspond déjà à une autre note");
        }
        const [existingEvent] = await tx
          .select({
            createdAt: supportEvents.createdAt,
            correlationId: supportEvents.correlationId,
          })
          .from(supportEvents)
          .where(and(
            eq(supportEvents.requestId, request.id),
            eq(supportEvents.eventType, "note.created"),
            eq(supportEvents.actorId, user.id),
            sql`${supportEvents.toValue}->>'messageId' = ${existing.id}`
          ))
          .orderBy(desc(supportEvents.createdAt))
          .limit(1);
        if (!existingEvent?.correlationId) {
          throw new HttpError(409, "La note enregistrée n'a pas de confirmation exploitable");
        }
        return {
          ...existing,
          duplicate: true,
          confirmedAt: existingEvent.createdAt,
          correlationId: existingEvent.correlationId,
        };
      }
      const correlationId = randomUUID();
      const [noteEvent] = await tx.insert(supportEvents).values({
        requestId: request.id,
        eventType: "note.created",
        actorType: "agent",
        actorId: user.id,
        toValue: { messageId: created.id },
        correlationId,
      }).returning({ createdAt: supportEvents.createdAt });
      if (!noteEvent) {
        throw new HttpError(409, "La note n'a pas été confirmée par le journal du dossier");
      }
      return {
        ...created,
        duplicate: false,
        confirmedAt: noteEvent.createdAt,
        correlationId,
      };
    });

    res.status(result.duplicate ? 200 : 201);
    return {
      confirmation: createSupportInternalNoteConfirmation({
        publicCode: code,
        messageId: result.id,
        duplicate: result.duplicate,
        messageCreatedAt: result.createdAt,
        confirmedAt: result.confirmedAt,
        correlationId: result.correlationId,
      }),
    };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "12kb" } } };
