import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  communicationDeliveries,
  communicationEvents,
  communicationJobs,
} from "../../db/schema.js";
import {
  communicationManualRetryIdempotencyHash,
  planCommunicationManualRetry,
  type CommunicationManualRetryActorRole,
} from "../../shared/communication-job-manual-retry.js";
import type {
  CommunicationDeliveryLifecycleStatus,
  CommunicationJobFailureCode,
  CommunicationJobType,
} from "../../shared/communication-job-policy.js";

type CommunicationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PersistedCommunicationManualRetry = {
  allowed: boolean;
  reason: ReturnType<typeof planCommunicationManualRetry>["reason"];
  created: boolean;
  duplicate: boolean;
};

export async function persistCommunicationManualRetry(input: {
  tx: CommunicationTransaction;
  institutionId: string;
  originalJobId: string;
  actorUserId: string;
  actorRole: CommunicationManualRetryActorRole;
  authenticatorLevel: "aal1" | "aal2";
  operatorConfirmedReady: boolean;
  idempotencySecret: string;
  requestedAt?: Date;
}): Promise<PersistedCommunicationManualRetry> {
  if (
    !UUID_PATTERN.test(input.institutionId) ||
    !UUID_PATTERN.test(input.originalJobId) ||
    !UUID_PATTERN.test(input.actorUserId)
  ) {
    throw new Error("manual_retry_scope_invalid");
  }
  const requestedAt = input.requestedAt ?? new Date();
  if (!Number.isFinite(requestedAt.getTime())) throw new Error("manual_retry_time_invalid");

  const [row] = await input.tx
    .select({
      jobId: communicationJobs.id,
      communicationId: communicationJobs.communicationId,
      versionId: communicationJobs.versionId,
      version: communicationJobs.version,
      deliveryId: communicationJobs.deliveryId,
      jobType: communicationJobs.jobType,
      status: communicationJobs.status,
      attemptCount: communicationJobs.attemptCount,
      failureCode: communicationJobs.lastErrorCode,
      deliveryStatus: communicationDeliveries.status,
    })
    .from(communicationJobs)
    .innerJoin(communicationDeliveries, and(
      eq(communicationJobs.deliveryId, communicationDeliveries.id),
      eq(communicationJobs.institutionId, communicationDeliveries.institutionId)
    ))
    .where(and(
      eq(communicationJobs.id, input.originalJobId),
      eq(communicationJobs.institutionId, input.institutionId)
    ))
    .limit(1)
    .for("update");
  if (!row || !row.versionId || row.version === null || !row.deliveryId || !row.failureCode) {
    throw new Error("manual_retry_state_missing");
  }

  const decision = planCommunicationManualRetry({
    actorRole: input.actorRole,
    authenticatorLevel: input.authenticatorLevel,
    jobType: row.jobType as CommunicationJobType,
    status: row.status,
    attemptCount: row.attemptCount,
    failureCode: row.failureCode as CommunicationJobFailureCode,
    deliveryStatus: row.deliveryStatus as CommunicationDeliveryLifecycleStatus,
    operatorConfirmedReady: input.operatorConfirmedReady,
  }, requestedAt);
  if (!decision.allowed || !decision.successorJobType || !decision.runAfter) {
    return { allowed: false, reason: decision.reason, created: false, duplicate: false };
  }

  const idempotencyKeyHash = communicationManualRetryIdempotencyHash({
    institutionId: input.institutionId,
    originalJobId: input.originalJobId,
    secret: input.idempotencySecret,
  });
  const inserted = await input.tx
    .insert(communicationJobs)
    .values({
      institutionId: input.institutionId,
      communicationId: row.communicationId,
      versionId: row.versionId,
      version: row.version,
      deliveryId: row.deliveryId,
      jobType: decision.successorJobType,
      status: "pending",
      idempotencyKeyHash,
      attemptCount: 0,
      runAfter: new Date(decision.runAfter),
    })
    .onConflictDoNothing()
    .returning({ id: communicationJobs.id });
  const created = inserted.length === 1;

  if (created) {
    await input.tx.insert(communicationEvents).values({
      institutionId: input.institutionId,
      communicationId: row.communicationId,
      resourceType: "job",
      resourceId: row.jobId,
      eventType: "job.manual_retry_requested",
      actorUserId: input.actorUserId,
      actorType: "user",
      summary: {
        successorJobType: decision.successorJobType,
        originalFailureCode: row.failureCode,
        requestedAt: requestedAt.toISOString(),
      },
    });
  }

  return {
    allowed: true,
    reason: decision.reason,
    created,
    duplicate: !created,
  };
}
