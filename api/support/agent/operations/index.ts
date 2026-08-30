import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  supportAttachments,
  supportFailedJobs,
  supportJobRuns,
  supportMessages,
  supportRequests,
  supportWebhookReceipts,
} from "../../../../db/schema.js";
import { requireSupportOperationsManager } from "../../../_shared/support-operations.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";
import { assertLegacySingleInstitutionMode } from "../../../_shared/institution-context.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  return handleApi(res, async () => {
    const context = await requireSupportOperationsManager(req);
    await assertLegacySingleInstitutionMode(context.institutionId);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const waitingSince = new Date(Date.now() - 15 * 60 * 1000);

    const [jobStats] = await db
      .select({
        successes24h: sql<number>`count(*) filter (where ${supportJobRuns.status} = 'success')`.mapWith(Number),
        failures24h: sql<number>`count(*) filter (where ${supportJobRuns.status} = 'failure')`.mapWith(Number),
        lastSuccessAt: sql<Date | null>`max(${supportJobRuns.createdAt}) filter (where ${supportJobRuns.status} = 'success')`,
      })
      .from(supportJobRuns)
      .innerJoin(supportRequests, eq(supportRequests.id, supportJobRuns.requestId))
      .where(and(
        eq(supportRequests.institutionId, context.institutionId),
        gte(supportJobRuns.createdAt, since)
      ));

    const [webhookStats] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(supportWebhookReceipts)
      .where(
        sql`${supportWebhookReceipts.createdAt} >= ${since} and ${supportWebhookReceipts.status} in ('error', 'rejected')`
      );

    const [deliveryStats] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(supportMessages)
      .innerJoin(supportRequests, eq(supportRequests.id, supportMessages.requestId))
      .where(
        and(
          eq(supportRequests.institutionId, context.institutionId),
          sql`${supportMessages.createdAt} >= ${since} and ${supportMessages.deliveryStatus} in ('soft_bounce', 'hard_bounce', 'blocked', 'spam', 'invalid')`
        )
      );

    const [attachmentStats] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(supportAttachments)
      .innerJoin(supportRequests, eq(supportRequests.id, supportAttachments.requestId))
      .where(
        and(
          eq(supportRequests.institutionId, context.institutionId),
          sql`${supportAttachments.createdAt} < ${waitingSince} and ${supportAttachments.scanStatus} = 'quarantine'`
        )
      );

    const [failureStats] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(supportFailedJobs)
      .innerJoin(supportRequests, eq(supportRequests.id, supportFailedJobs.requestId))
      .where(and(
        eq(supportRequests.institutionId, context.institutionId),
        isNull(supportFailedJobs.retriedAt)
      ));

    const failures = await db
      .select({
        id: supportFailedJobs.id,
        jobType: supportFailedJobs.jobType,
        attempts: supportFailedJobs.attempts,
        lastErrorCode: supportFailedJobs.lastErrorCode,
        lastErrorSummary: supportFailedJobs.lastErrorSummary,
        failedAt: supportFailedJobs.failedAt,
        publicCode: supportRequests.publicCode,
        subject: supportRequests.subject,
      })
      .from(supportFailedJobs)
      .innerJoin(supportRequests, eq(supportFailedJobs.requestId, supportRequests.id))
      .where(and(
        eq(supportRequests.institutionId, context.institutionId),
        isNull(supportFailedJobs.retriedAt)
      ))
      .orderBy(desc(supportFailedJobs.failedAt))
      .limit(50);

    return {
      generatedAt: new Date(),
      summary: {
        failuresWaiting: failureStats?.count ?? 0,
        jobSuccesses24h: jobStats?.successes24h ?? 0,
        jobFailures24h: jobStats?.failures24h ?? 0,
        webhookAlerts24h: webhookStats?.count ?? 0,
        deliveryAlerts24h: deliveryStats?.count ?? 0,
        attachmentsWaiting: attachmentStats?.count ?? 0,
        lastSuccessAt: jobStats?.lastSuccessAt ?? null,
      },
      failures,
    };
  });
}
