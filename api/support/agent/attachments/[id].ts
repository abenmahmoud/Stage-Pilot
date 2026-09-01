import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  supportAttachments,
  supportEvents,
  supportRequests,
} from "../../../../db/schema.js";
import { HttpError, supabaseAdmin } from "../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";
import { idempotencyKey } from "../../../_shared/support.js";
import {
  assertSupportRequestAccess,
  requireSupportAgent,
} from "../../../_shared/support-agent-access.js";
import {
  enforceAgentAttachmentDownloadRateLimit,
  enforceAgentWriteRateLimit,
} from "../../../_shared/support-rate-limits.js";
import { createSupportAttachmentRemovalConfirmation } from "../../../../shared/support-attachment-removal-confirmation.js";
import { singleSupportAgentRouteValue } from "../../../../shared/support-agent-mutation-input-policy.js";
import { isSupportAttachmentLinkPayload } from "../../../../shared/support-attachment-link-payload-policy.js";

const REMOVABLE_DRAFT_STATUSES = ["clean", "blocked", "scan_error"] as const;

function attachmentLinkPayload(url: string) {
  const payload = { url, expiresIn: 60 };
  const configuredStorageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (!isSupportAttachmentLinkPayload(payload, configuredStorageUrl)) {
    throw new HttpError(503, "Le lien du fichier est invalide");
  }
  return payload;
}

function attachmentId(req: VercelRequest): string {
  const id = singleSupportAgentRouteValue(req.query.id);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "Pièce jointe invalide");
  return id;
}

function operationId(req: VercelRequest): string {
  const value = idempotencyKey(req);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, "Clé de retrait invalide");
  }
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "DELETE") {
    return methodNotAllowed(res, ["GET", "DELETE"]);
  }

  return handleApi(res, async () => {
    const { user, access, institutionId } = await requireSupportAgent(req);
    const id = attachmentId(req);

    if (req.method === "DELETE") {
      await enforceAgentWriteRateLimit(user.id);
      const removalOperationId = operationId(req);
      const [operationEvent] = await db
        .select({
          eventType: supportEvents.eventType,
          actorId: supportEvents.actorId,
          attachmentId: sql<string | null>`${supportEvents.fromValue}->>'attachmentId'`,
          removed: sql<string | null>`${supportEvents.toValue}->>'removed'`,
          publicCode: supportRequests.publicCode,
          assignedTeam: supportRequests.assignedTeam,
          createdAt: supportEvents.createdAt,
          correlationId: supportEvents.correlationId,
        })
        .from(supportEvents)
        .innerJoin(supportRequests, eq(supportRequests.id, supportEvents.requestId))
        .where(and(
          eq(supportRequests.institutionId, institutionId),
          eq(supportEvents.correlationId, removalOperationId)
        ))
        .orderBy(desc(supportEvents.createdAt))
        .limit(1);
      if (operationEvent) {
        if (
          !["attachment.draft_removed", "attachment.draft_removal_reused"].includes(operationEvent.eventType)
          || operationEvent.actorId !== user.id
          || operationEvent.attachmentId !== id
          || operationEvent.removed !== "true"
        ) {
          throw new HttpError(409, "Cette clé de retrait a déjà été utilisée pour une autre action");
        }
        assertSupportRequestAccess(access, operationEvent.assignedTeam);
        return {
          confirmation: createSupportAttachmentRemovalConfirmation({
            publicCode: operationEvent.publicCode,
            attachmentId: id,
            duplicate: true,
            confirmedAt: operationEvent.createdAt,
            correlationId: operationEvent.correlationId,
          }),
        };
      }

      const prepared = await db.transaction(async (tx) => {
        const [candidate] = await tx
          .select({
            id: supportAttachments.id,
            requestId: supportAttachments.requestId,
            publicCode: supportRequests.publicCode,
            assignedTeam: supportRequests.assignedTeam,
          })
          .from(supportAttachments)
          .innerJoin(supportRequests, eq(supportRequests.id, supportAttachments.requestId))
          .where(and(
            eq(supportRequests.institutionId, institutionId),
            eq(supportAttachments.id, id)
          ))
          .limit(1);
        if (!candidate) throw new HttpError(404, "Pièce jointe introuvable");
        assertSupportRequestAccess(access, candidate.assignedTeam);

        await tx.execute(sql`
          select pg_advisory_xact_lock(hashtextextended(${candidate.requestId}::text, 0))
        `);
        const [lockedCandidate] = await tx
          .select({
            id: supportAttachments.id,
            requestId: supportAttachments.requestId,
            messageId: supportAttachments.messageId,
            direction: supportAttachments.direction,
            uploadedByUser: supportAttachments.uploadedByUser,
            releasedAt: supportAttachments.releasedAt,
            scanStatus: supportAttachments.scanStatus,
            storageBucket: supportAttachments.storageBucket,
            storagePath: supportAttachments.storagePath,
          })
          .from(supportAttachments)
          .where(and(
            eq(supportAttachments.id, candidate.id),
            eq(supportAttachments.requestId, candidate.requestId)
          ))
          .limit(1);
        if (!lockedCandidate) throw new HttpError(404, "Pièce jointe introuvable");
        if (lockedCandidate.direction !== "agent" || lockedCandidate.uploadedByUser !== user.id) {
          throw new HttpError(404, "Pièce jointe introuvable");
        }
        if (lockedCandidate.messageId || lockedCandidate.releasedAt) {
          throw new HttpError(409, "Un document déjà envoyé ne peut pas être retiré");
        }
        const resuming = lockedCandidate.scanStatus === "removal_pending";
        if (
          !resuming
          && !REMOVABLE_DRAFT_STATUSES.includes(lockedCandidate.scanStatus as typeof REMOVABLE_DRAFT_STATUSES[number])
        ) {
          throw new HttpError(409, "Attendez la fin du contrôle avant de retirer ce document");
        }

        if (!resuming) {
          const [marked] = await tx
            .update(supportAttachments)
            .set({ scanStatus: "removal_pending", scanDetail: "agent_requested_removal" })
            .where(and(
              eq(supportAttachments.id, lockedCandidate.id),
              eq(supportAttachments.requestId, lockedCandidate.requestId),
              eq(supportAttachments.direction, "agent"),
              eq(supportAttachments.uploadedByUser, user.id),
              inArray(supportAttachments.scanStatus, [...REMOVABLE_DRAFT_STATUSES]),
              isNull(supportAttachments.messageId),
              isNull(supportAttachments.releasedAt)
            ))
            .returning({ id: supportAttachments.id });
          if (!marked) throw new HttpError(409, "Ce document vient d’être modifié");

          await tx.insert(supportEvents).values({
            requestId: lockedCandidate.requestId,
            eventType: "attachment.draft_removal_requested",
            actorType: "agent",
            actorId: user.id,
            fromValue: { attachmentId: lockedCandidate.id, direction: "agent", scanStatus: lockedCandidate.scanStatus },
            toValue: { scanStatus: "removal_pending" },
            correlationId: randomUUID(),
          });
        }
        return {
          id: lockedCandidate.id,
          requestId: lockedCandidate.requestId,
          publicCode: candidate.publicCode,
          storageBucket: lockedCandidate.storageBucket,
          storagePath: lockedCandidate.storagePath,
        };
      });

      const { error: storageError } = await supabaseAdmin.storage
        .from(prepared.storageBucket)
        .remove([prepared.storagePath]);
      if (storageError) {
        await db.transaction(async (tx) => {
          await tx.execute(sql`
            select pg_advisory_xact_lock(hashtextextended(${prepared.requestId}::text, 0))
          `);
          const [restored] = await tx
            .update(supportAttachments)
            .set({ scanStatus: "scan_error", scanDetail: "storage_removal_failed" })
            .where(and(
              eq(supportAttachments.id, prepared.id),
              eq(supportAttachments.requestId, prepared.requestId),
              eq(supportAttachments.direction, "agent"),
              eq(supportAttachments.uploadedByUser, user.id),
              eq(supportAttachments.scanStatus, "removal_pending"),
              isNull(supportAttachments.messageId),
              isNull(supportAttachments.releasedAt)
            ))
            .returning({ id: supportAttachments.id });
          if (restored) {
            await tx.insert(supportEvents).values({
              requestId: prepared.requestId,
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
          select pg_advisory_xact_lock(hashtextextended(${prepared.requestId}::text, 0))
        `);
        const [deleted] = await tx
          .delete(supportAttachments)
          .where(and(
            eq(supportAttachments.id, prepared.id),
            eq(supportAttachments.requestId, prepared.requestId),
            eq(supportAttachments.direction, "agent"),
            eq(supportAttachments.uploadedByUser, user.id),
            eq(supportAttachments.scanStatus, "removal_pending"),
            isNull(supportAttachments.messageId),
            isNull(supportAttachments.releasedAt)
          ))
          .returning({ id: supportAttachments.id });
        if (!deleted) {
          const [remaining] = await tx
            .select({ id: supportAttachments.id })
            .from(supportAttachments)
            .where(and(
              eq(supportAttachments.id, prepared.id),
              eq(supportAttachments.requestId, prepared.requestId)
            ))
            .limit(1);
          if (!remaining) {
            const [previousRemoval] = await tx
              .select({
                createdAt: supportEvents.createdAt,
                correlationId: supportEvents.correlationId,
              })
              .from(supportEvents)
              .where(and(
                eq(supportEvents.requestId, prepared.requestId),
                inArray(supportEvents.eventType, [
                  "attachment.draft_removed",
                  "attachment.draft_removal_reused",
                ]),
                eq(supportEvents.actorId, user.id),
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
              requestId: prepared.requestId,
              eventType: "attachment.draft_removal_reused",
              actorType: "agent",
              actorId: user.id,
              fromValue: { attachmentId: prepared.id, direction: "agent" },
              toValue: { removed: true, reused: true },
              correlationId: removalOperationId,
            }).returning({
              createdAt: supportEvents.createdAt,
              correlationId: supportEvents.correlationId,
            });
            if (!reuseEvent) {
              throw new HttpError(409, "La reprise du retrait n'a pas été confirmée");
            }
            return {
              id: prepared.id,
              duplicate: true,
              confirmedAt: reuseEvent.createdAt,
              correlationId: reuseEvent.correlationId,
            };
          }
          throw new HttpError(409, "Ce document vient d’être modifié");
        }

        const [removedEvent] = await tx.insert(supportEvents).values({
          requestId: prepared.requestId,
          eventType: "attachment.draft_removed",
          actorType: "agent",
          actorId: user.id,
          fromValue: { attachmentId: prepared.id, direction: "agent", scanStatus: "removal_pending" },
          toValue: { removed: true },
          correlationId: removalOperationId,
        }).returning({
          createdAt: supportEvents.createdAt,
          correlationId: supportEvents.correlationId,
        });
        if (!removedEvent) {
          throw new HttpError(409, "Le retrait n'a pas été confirmé par le journal du dossier");
        }
        return {
          id: deleted.id,
          duplicate: false,
          confirmedAt: removedEvent.createdAt,
          correlationId: removedEvent.correlationId,
        };
      });

      return {
        confirmation: createSupportAttachmentRemovalConfirmation({
          publicCode: prepared.publicCode,
          attachmentId: removed.id,
          duplicate: removed.duplicate,
          confirmedAt: removed.confirmedAt,
          correlationId: removed.correlationId,
        }),
      };
    }

    await enforceAgentAttachmentDownloadRateLimit(user.id);
    const [attachment] = await db
      .select({
        requestId: supportAttachments.requestId,
        direction: supportAttachments.direction,
        originalName: supportAttachments.originalName,
        storageBucket: supportAttachments.storageBucket,
        storagePath: supportAttachments.storagePath,
        scanStatus: supportAttachments.scanStatus,
        assignedTeam: supportRequests.assignedTeam,
      })
      .from(supportAttachments)
      .innerJoin(supportRequests, eq(supportRequests.id, supportAttachments.requestId))
      .where(and(
        eq(supportRequests.institutionId, institutionId),
        eq(supportAttachments.id, id)
      ))
      .limit(1);
    if (!attachment) throw new HttpError(404, "Pièce jointe introuvable");
    assertSupportRequestAccess(access, attachment.assignedTeam);
    if (attachment.scanStatus !== "clean") {
      throw new HttpError(423, "Le fichier n'est pas encore disponible");
    }
    const { data, error } = await supabaseAdmin.storage
      .from(attachment.storageBucket)
      .createSignedUrl(attachment.storagePath, 60, { download: attachment.originalName });
    if (error || !data?.signedUrl) throw new HttpError(503, "Ouverture du fichier impossible");
    const payload = attachmentLinkPayload(data.signedUrl);
    await db.insert(supportEvents).values({
      requestId: attachment.requestId,
      eventType: "attachment.download_link_issued",
      actorType: "agent",
      actorId: user.id,
      toValue: { attachmentId: id, direction: attachment.direction, expiresIn: 60 },
      correlationId: randomUUID(),
    });
    return payload;
  });
}

export const config = { api: { bodyParser: false } };
