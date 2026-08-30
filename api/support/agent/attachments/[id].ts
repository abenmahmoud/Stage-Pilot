import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  supportAttachments,
  supportEvents,
  supportRequests,
} from "../../../../db/schema.js";
import { HttpError, supabaseAdmin } from "../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";
import {
  assertSupportRequestAccess,
  requireSupportAgent,
} from "../../../_shared/support-agent-access.js";
import { enforceAgentWriteRateLimit } from "../../../_shared/support-rate-limits.js";

const REMOVABLE_DRAFT_STATUSES = ["clean", "blocked", "scan_error"] as const;

function attachmentId(req: VercelRequest): string {
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "Pièce jointe invalide");
  return id;
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
      const prepared = await db.transaction(async (tx) => {
        const [candidate] = await tx
          .select({
            id: supportAttachments.id,
            requestId: supportAttachments.requestId,
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
          if (!remaining) return { id: prepared.id, duplicate: true };
          throw new HttpError(409, "Ce document vient d’être modifié");
        }

        await tx.insert(supportEvents).values({
          requestId: prepared.requestId,
          eventType: "attachment.draft_removed",
          actorType: "agent",
          actorId: user.id,
          fromValue: { attachmentId: prepared.id, direction: "agent", scanStatus: "removal_pending" },
          toValue: { removed: true },
          correlationId: randomUUID(),
        });
        return { id: deleted.id, duplicate: false };
      });

      return { attachment: { id: removed.id }, removed: true, duplicate: removed.duplicate };
    }

    const [attachment] = await db
      .select({
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
    return { url: data.signedUrl, expiresIn: 60 };
  });
}

export const config = { api: { bodyParser: false } };
