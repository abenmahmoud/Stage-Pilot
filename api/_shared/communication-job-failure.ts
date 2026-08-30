import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  communicationDeliveries,
  communicationEvents,
  communicationJobs,
} from "../../db/schema.js";
import {
  planCommunicationJobFailure,
  type CommunicationJobFailureCode,
  type CommunicationJobType,
} from "../../shared/communication-job-policy.js";
import type { StoredCommunicationDeliveryStatus } from "../../shared/communication-delivery-transition.js";

type CommunicationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRE_SEND_STATUSES = new Set<StoredCommunicationDeliveryStatus>(["prepared", "queued", "error"]);

export type PersistedCommunicationJobFailure = {
  accepted: true;
  jobStatus: "retry" | "dead";
  attemptCount: number;
  runAfter: string | null;
  showInFailureInbox: boolean;
};

export async function persistCommunicationJobFailure(input: {
  tx: CommunicationTransaction;
  institutionId: string;
  jobId: string;
  failureCode: CommunicationJobFailureCode;
  failedAt?: Date;
}): Promise<PersistedCommunicationJobFailure> {
  if (!UUID_PATTERN.test(input.institutionId) || !UUID_PATTERN.test(input.jobId)) {
    throw new Error("job_failure_scope_invalid");
  }
  const failedAt = input.failedAt ?? new Date();
  if (!Number.isFinite(failedAt.getTime())) throw new Error("job_failure_time_invalid");

  const [row] = await input.tx
    .select({
      jobId: communicationJobs.id,
      jobType: communicationJobs.jobType,
      jobStatus: communicationJobs.status,
      attemptCount: communicationJobs.attemptCount,
      runAfter: communicationJobs.runAfter,
      deliveryId: communicationJobs.deliveryId,
      communicationId: communicationJobs.communicationId,
      deliveryStatus: communicationDeliveries.status,
    })
    .from(communicationJobs)
    .innerJoin(communicationDeliveries, and(
      eq(communicationJobs.deliveryId, communicationDeliveries.id),
      eq(communicationJobs.institutionId, communicationDeliveries.institutionId)
    ))
    .where(and(
      eq(communicationJobs.id, input.jobId),
      eq(communicationJobs.institutionId, input.institutionId)
    ))
    .limit(1)
    .for("update");
  if (!row) throw new Error("job_failure_state_missing");

  const decision = planCommunicationJobFailure({
    jobType: row.jobType as CommunicationJobType,
    status: row.jobStatus,
    attemptCount: row.attemptCount,
    failureCode: input.failureCode,
  }, failedAt);
  const runAfter = decision.runAfter === null ? row.runAfter : new Date(decision.runAfter);

  const updated = await input.tx
    .update(communicationJobs)
    .set({
      status: decision.nextStatus,
      attemptCount: decision.attemptCount,
      runAfter,
      lockedAt: null,
      completedAt: null,
      lastErrorCode: decision.failureCode,
      updatedAt: failedAt,
    })
    .where(and(
      eq(communicationJobs.id, row.jobId),
      eq(communicationJobs.institutionId, input.institutionId),
      eq(communicationJobs.status, "running"),
      eq(communicationJobs.attemptCount, row.attemptCount)
    ))
    .returning({ id: communicationJobs.id });
  if (updated.length !== 1) throw new Error("job_failure_conflict");

  if (
    row.deliveryId &&
    row.deliveryStatus &&
    PRE_SEND_STATUSES.has(row.deliveryStatus as StoredCommunicationDeliveryStatus)
  ) {
    const deliveryUpdated = await input.tx
      .update(communicationDeliveries)
      .set({
        status: "error",
        lastErrorCode: decision.failureCode,
        updatedAt: failedAt,
      })
      .where(and(
        eq(communicationDeliveries.id, row.deliveryId),
        eq(communicationDeliveries.institutionId, input.institutionId),
        eq(communicationDeliveries.status, row.deliveryStatus)
      ))
      .returning({ id: communicationDeliveries.id });
    if (deliveryUpdated.length !== 1) throw new Error("delivery_failure_conflict");
  }

  await input.tx.insert(communicationEvents).values({
    institutionId: input.institutionId,
    communicationId: row.communicationId,
    resourceType: "job",
    resourceId: row.jobId,
    eventType: decision.nextStatus === "dead" ? "job.dead" : "job.retry_scheduled",
    actorType: "worker",
    summary: {
      failureCode: decision.failureCode,
      attemptCount: decision.attemptCount,
      runAfter: decision.runAfter,
    },
  });

  return {
    accepted: true,
    jobStatus: decision.nextStatus,
    attemptCount: decision.attemptCount,
    runAfter: decision.runAfter,
    showInFailureInbox: decision.showInFailureInbox,
  };
}
