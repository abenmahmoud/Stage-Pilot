import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { supportAttachments, supportEvents } from "../../../db/schema.js";
import { HttpError, supabaseAdmin } from "../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { idempotencyKey, requireSupportAccess } from "../../_shared/support.js";
import {
  enforceAttachmentDownloadRateLimit,
  enforceAttachmentReservationRateLimit,
} from "../../_shared/support-rate-limits.js";
import { createSupportAttachmentRemovalConfirmation } from "../../../shared/support-attachment-removal-confirmation.js";
import { verifySupportAttachmentRemovalMutationPayload } from "../../../shared/support-public-mutation-payload-policy.js";
import { singleSupportQueryValue } from "../../../shared/support-public-mutation-input-policy.js";

const REMOVABLE_REQUESTER_STATUSES = ["awaiting_upload", "blocked", "scan_error"] as const;

function operationId(req: VercelRequest): string {
  const value = idempotencyKey(req);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, "Clé de retrait invalide");
  }
  return value;
}

function attachmentRemovalPayload(input: {
  publicCode: string;
  attachmentId: string;
  duplicate: boolean;
  confirmedAt: Date;
  correlationId: string;
}) {
  const payload = {
    confirmation: createSupportAttachmentRemovalConfirmation(input),
  };
  if (!verifySupportAttachmentRemovalMutationPayload({
    value: payload,
    expectedPublicCode: input.publicCode,
    expectedAttachmentId: input.attachmentId,
  })) {
    throw new HttpError(503, "La confirmation du retrait est invalide");
  }
  return payload;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "DELETE") {
    return methodNotAllowed(res, ["GET", "DELETE"]);
  }

  return handleApi(res, async () => {
    const id = singleSupportQueryValue(req.query.id);
    const code = singleSupportQueryValue(req.query.code);
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "Pièce jointe invalide");
    if (!code || !/^BC-\d{4}-\d{6}$/.test(code)) throw new HttpError(400, "Numéro de demande invalide");

    const access = await requireSupportAccess(req, code);

    if (req.method === "DELETE") {
      await enforceAttachmentReservationRateLimit(access.sessionId);
      const removalOperationId = operationId(req);
      const [operationEvent] = await db
        .select({
          eventType: supportEvents.eventType,
          actorType: supportEvents.actorType,
          actorId: supportEvents.actorId,
          attachmentId: sql<string | null>`${supportEvents.fromValue}->>'attachmentId'`,
          removed: sql<string | null>`${supportEvents.toValue}->>'removed'`,
          createdAt: supportEvents.createdAt,
          correlationId: supportEvents.correlationId,
        })
        .from(supportEvents)
        .where(and(
          eq(supportEvents.requestId, access.requestId),
          eq(supportEvents.correlationId, removalOperationId)
        ))
        .orderBy(desc(supportEvents.createdAt))
        .limit(1);
      if (operationEvent) {
        if (
          !["attachment.draft_removed", "attachment.draft_removal_reused"].includes(operationEvent.eventType)
          || operationEvent.actorType !== "requester"
          || operationEvent.actorId !== access.sessionId
          || operationEvent.attachmentId !== id
          || operationEvent.removed !== "true"
        ) {
          throw new HttpError(409, "Cette clé de retrait a déjà été utilisée pour une autre action");
        }
        return attachmentRemovalPayload({
          publicCode: code,
          attachmentId: id,
          duplicate: true,
          confirmedAt: operationEvent.createdAt,
          correlationId: operationEvent.correlationId,
        });
      }

      const prepared = await db.transaction(async (tx) => {
        await tx.execute(sql`
          select pg_advisory_xact_lock(hashtextextended(${access.requestId}::text, 0))
        `);
        const [candidate] = await tx
          .select({
            id: supportAttachments.id,
            requestId: supportAttachments.requestId,
            direction: supportAttachments.direction,
            uploadedBySession: supportAttachments.uploadedBySession,
            scanStatus: supportAttachments.scanStatus,
            storageBucket: supportAttachments.storageBucket,
            storagePath: supportAttachments.storagePath,
          })
          .from(supportAttachments)
          .where(and(
            eq(supportAttachments.id, id),
            eq(supportAttachments.requestId, access.requestId)
          ))
          .limit(1);
        if (
          !candidate
          || candidate.direction !== "requester"
          || candidate.uploadedBySession !== access.sessionId
        ) {
          throw new HttpError(404, "Pièce jointe introuvable");
        }

        const resuming = candidate.scanStatus === "removal_pending";
        if (
          !resuming
          && !REMOVABLE_REQUESTER_STATUSES.includes(
            candidate.scanStatus as typeof REMOVABLE_REQUESTER_STATUSES[number]
          )
        ) {
          throw new HttpError(409, "Un document déjà reçu par le lycée ne peut pas être retiré ici");
        }

        if (!resuming) {
          const [marked] = await tx
            .update(supportAttachments)
            .set({ scanStatus: "removal_pending", scanDetail: "requester_requested_removal" })
            .where(and(
              eq(supportAttachments.id, candidate.id),
              eq(supportAttachments.requestId, access.requestId),
              eq(supportAttachments.direction, "requester"),
              eq(supportAttachments.uploadedBySession, access.sessionId),
              inArray(supportAttachments.scanStatus, [...REMOVABLE_REQUESTER_STATUSES])
            ))
            .returning({ id: supportAttachments.id });
          if (!marked) throw new HttpError(409, "Ce document vient d’être modifié");

          await tx.insert(supportEvents).values({
            requestId: access.requestId,
            eventType: "attachment.draft_removal_requested",
            actorType: "requester",
            actorId: access.sessionId,
            fromValue: {
              attachmentId: candidate.id,
              direction: "requester",
              scanStatus: candidate.scanStatus,
            },
            toValue: { scanStatus: "removal_pending" },
            correlationId: randomUUID(),
          });
        }
        return candidate;
      });

      const { error: storageError } = await supabaseAdmin.storage
        .from(prepared.storageBucket)
        .remove([prepared.storagePath]);
      if (storageError) {
        await db.transaction(async (tx) => {
          await tx.execute(sql`
            select pg_advisory_xact_lock(hashtextextended(${access.requestId}::text, 0))
          `);
          const [restored] = await tx
            .update(supportAttachments)
            .set({ scanStatus: "scan_error", scanDetail: "storage_removal_failed" })
            .where(and(
              eq(supportAttachments.id, prepared.id),
              eq(supportAttachments.requestId, access.requestId),
              eq(supportAttachments.direction, "requester"),
              eq(supportAttachments.uploadedBySession, access.sessionId),
              eq(supportAttachments.scanStatus, "removal_pending")
            ))
            .returning({ id: supportAttachments.id });
          if (restored) {
            await tx.insert(supportEvents).values({
              requestId: access.requestId,
              eventType: "attachment.draft_removal_failed",
              actorType: "system",
              fromValue: { attachmentId: prepared.id, scanStatus: "removal_pending" },
              toValue: { scanStatus: "scan_error" },
              correlationId: randomUUID(),
            });
          }
        });
        throw new HttpError(503, "Le retrait du document a échoué. Vous pouvez réessayer.");
      }

      const removed = await db.transaction(async (tx) => {
        await tx.execute(sql`
          select pg_advisory_xact_lock(hashtextextended(${access.requestId}::text, 0))
        `);
        const [deleted] = await tx
          .delete(supportAttachments)
          .where(and(
            eq(supportAttachments.id, prepared.id),
            eq(supportAttachments.requestId, access.requestId),
            eq(supportAttachments.direction, "requester"),
            eq(supportAttachments.uploadedBySession, access.sessionId),
            eq(supportAttachments.scanStatus, "removal_pending")
          ))
          .returning({ id: supportAttachments.id });
        if (!deleted) {
          const [remaining] = await tx
            .select({ id: supportAttachments.id })
            .from(supportAttachments)
            .where(and(
              eq(supportAttachments.id, prepared.id),
              eq(supportAttachments.requestId, access.requestId)
            ))
            .limit(1);
          if (remaining) throw new HttpError(409, "Ce document vient d’être modifié");

          const [previousRemoval] = await tx
            .select({
              createdAt: supportEvents.createdAt,
              correlationId: supportEvents.correlationId,
            })
            .from(supportEvents)
            .where(and(
              eq(supportEvents.requestId, access.requestId),
              inArray(supportEvents.eventType, [
                "attachment.draft_removed",
                "attachment.draft_removal_reused",
              ]),
              eq(supportEvents.actorType, "requester"),
              eq(supportEvents.actorId, access.sessionId),
              sql`${supportEvents.fromValue}->>'attachmentId' = ${prepared.id}`,
              sql`${supportEvents.toValue}->>'removed' = 'true'`
            ))
            .orderBy(desc(supportEvents.createdAt))
            .limit(1);
          if (!previousRemoval) {
            throw new HttpError(409, "La disparition du document n'est pas confirmée par le journal du dossier");
          }
          if (previousRemoval.correlationId === removalOperationId) {
            return {
              id: prepared.id,
              duplicate: true,
              confirmedAt: previousRemoval.createdAt,
              correlationId: previousRemoval.correlationId,
            };
          }
          const [reuseEvent] = await tx.insert(supportEvents).values({
            requestId: access.requestId,
            eventType: "attachment.draft_removal_reused",
            actorType: "requester",
            actorId: access.sessionId,
            fromValue: { attachmentId: prepared.id, direction: "requester" },
            toValue: { removed: true, reused: true },
            correlationId: removalOperationId,
          }).returning({
            createdAt: supportEvents.createdAt,
            correlationId: supportEvents.correlationId,
          });
          if (!reuseEvent) throw new HttpError(409, "La reprise du retrait n'a pas été confirmée");
          return {
            id: prepared.id,
            duplicate: true,
            confirmedAt: reuseEvent.createdAt,
            correlationId: reuseEvent.correlationId,
          };
        }

        const [removedEvent] = await tx.insert(supportEvents).values({
          requestId: access.requestId,
          eventType: "attachment.draft_removed",
          actorType: "requester",
          actorId: access.sessionId,
          fromValue: {
            attachmentId: deleted.id,
            direction: "requester",
            scanStatus: "removal_pending",
          },
          toValue: { removed: true },
          correlationId: removalOperationId,
        }).returning({
          createdAt: supportEvents.createdAt,
          correlationId: supportEvents.correlationId,
        });
        if (!removedEvent) throw new HttpError(409, "Le retrait n'a pas été confirmé par le journal du dossier");
        return {
          id: deleted.id,
          duplicate: false,
          confirmedAt: removedEvent.createdAt,
          correlationId: removedEvent.correlationId,
        };
      });

      return attachmentRemovalPayload({
        publicCode: code,
        attachmentId: removed.id,
        duplicate: removed.duplicate,
        confirmedAt: removed.confirmedAt,
        correlationId: removed.correlationId,
      });
    }

    await enforceAttachmentDownloadRateLimit(access.sessionId);
    const [attachment] = await db
      .select({
        requestId: supportAttachments.requestId,
        direction: supportAttachments.direction,
        originalName: supportAttachments.originalName,
        storageBucket: supportAttachments.storageBucket,
        storagePath: supportAttachments.storagePath,
        scanStatus: supportAttachments.scanStatus,
      })
      .from(supportAttachments)
      .where(and(
        eq(supportAttachments.id, id),
        eq(supportAttachments.requestId, access.requestId),
        or(
          eq(supportAttachments.direction, "requester"),
          and(
            eq(supportAttachments.direction, "agent"),
            isNotNull(supportAttachments.messageId),
            isNotNull(supportAttachments.releasedAt)
          )
        )
      ))
      .limit(1);
    if (!attachment) throw new HttpError(404, "Pièce jointe introuvable");
    if (attachment.scanStatus !== "clean") {
      throw new HttpError(423, "Le fichier n'est pas encore disponible");
    }

    const { data, error } = await supabaseAdmin.storage
      .from(attachment.storageBucket)
      .createSignedUrl(attachment.storagePath, 60, { download: attachment.originalName });
    if (error || !data?.signedUrl) throw new HttpError(503, "Ouverture du fichier impossible");
    await db.insert(supportEvents).values({
      requestId: attachment.requestId,
      eventType: "attachment.download_link_issued",
      actorType: "requester",
      actorId: access.sessionId,
      toValue: { attachmentId: id, direction: attachment.direction, expiresIn: 60 },
      correlationId: randomUUID(),
    });
    return { url: data.signedUrl, expiresIn: 60 };
  });
}

export const config = { api: { bodyParser: false } };
