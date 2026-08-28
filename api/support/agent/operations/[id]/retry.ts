import { randomBytes, randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  supportContacts,
  supportEvents,
  supportFailedJobs,
  supportMagicTokens,
} from "../../../../../db/schema.js";
import {
  isSupportRetryableJobType,
  retryPayloadId,
  supportRetryNeedsRequesterAccess,
} from "../../../../../shared/support-job-retry.js";
import { HttpError } from "../../../../_shared/auth.js";
import { requireSupportOperationsManager } from "../../../../_shared/support-operations.js";
import { SUPPORT_MAGIC_TOKEN_MINUTES, sha256 } from "../../../../_shared/support.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const id = retryPayloadId({ messageId: value }, "messageId");
  if (!id) throw new HttpError(400, "Échec à relancer invalide");
  return id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  return handleApi(res, async () => {
    const context = await requireSupportOperationsManager(req);
    const id = routeId(req);
    const [failure] = await db
      .select()
      .from(supportFailedJobs)
      .where(and(eq(supportFailedJobs.id, id), isNull(supportFailedJobs.retriedAt)))
      .limit(1);
    if (!failure) throw new HttpError(404, "Cet échec n’est plus en attente");
    const requestId = failure.requestId;
    const jobType = failure.jobType;
    if (!requestId || !isSupportRetryableJobType(jobType)) {
      throw new HttpError(409, "Cette opération exige un contrôle technique manuel");
    }
    const messageId = retryPayloadId(failure.payloadRedacted, "messageId");
    if (!messageId) throw new HttpError(409, "Le message d’origine est introuvable");

    const newJobId = randomUUID();
    await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(supportFailedJobs)
        .set({ retriedBy: context.user.id, retriedAt: new Date() })
        .where(and(eq(supportFailedJobs.id, id), isNull(supportFailedJobs.retriedAt)))
        .returning({ id: supportFailedJobs.id });
      if (!claimed) throw new HttpError(409, "Cette opération vient déjà d’être relancée");

      let contactId: string | null = null;
      let accessToken: string | null = null;
      if (supportRetryNeedsRequesterAccess(jobType)) {
        const requestedContactId = retryPayloadId(failure.payloadRedacted, "contactId");
        const [contact] = await tx
          .select({ id: supportContacts.id })
          .from(supportContacts)
          .where(
            and(
              eq(supportContacts.requestId, requestId),
              eq(supportContacts.channel, "email"),
              isNull(supportContacts.disabledAt),
              ...(requestedContactId ? [eq(supportContacts.id, requestedContactId)] : [])
            )
          )
          .limit(1);
        if (!contact) throw new HttpError(409, "Aucune adresse email active n’est disponible");
        contactId = contact.id;
        accessToken = randomBytes(32).toString("base64url");
        await tx
          .update(supportMagicTokens)
          .set({ usedAt: new Date() })
          .where(
            and(
              eq(supportMagicTokens.requestId, requestId),
              eq(supportMagicTokens.contactId, contactId),
              eq(supportMagicTokens.purpose, "support_access"),
              isNull(supportMagicTokens.usedAt)
            )
          );
        await tx.insert(supportMagicTokens).values({
          requestId,
          contactId,
          tokenHash: sha256(accessToken),
          purpose: "support_access",
          expiresAt: new Date(Date.now() + SUPPORT_MAGIC_TOKEN_MINUTES * 60 * 1000),
        });
      }

      const queuePayload = {
        job_id: newJobId,
        job_type: jobType,
        request_id: requestId,
        message_id: messageId,
        contact_id: contactId,
        access_token: accessToken,
        idempotency_key: `manual-retry:${failure.jobId}:${newJobId}`,
        attempt: 0,
      };
      await tx.execute(sql`
        select pgmq.send('support_jobs', ${JSON.stringify(queuePayload)}::jsonb)
      `);
      await tx.insert(supportEvents).values({
        requestId,
        eventType: "job.retry_requested",
        actorType: "agent",
        actorId: context.user.id,
        fromValue: { failedJobId: failure.jobId },
        toValue: { jobId: newJobId, jobType },
        correlationId: randomUUID(),
      });
    });

    return { queued: true, jobId: newJobId };
  });
}
