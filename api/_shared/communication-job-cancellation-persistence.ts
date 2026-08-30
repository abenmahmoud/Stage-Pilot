import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  communicationDeliveries,
  communicationEvents,
  communicationJobs,
} from "../../db/schema.js";
import {
  planCommunicationJobCancellation,
  type CommunicationDeliveryLifecycleStatus,
  type CommunicationJobType,
} from "../../shared/communication-job-policy.js";

type CommunicationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIRECTION_ROLES = new Set(["superadmin", "proviseur"]);
const PRE_SEND_STATUSES = new Set(["prepared", "queued", "error"]);

export type PersistedCommunicationJobCancellation = {
  allowed: boolean;
  cancelled: boolean;
  reason: ReturnType<typeof planCommunicationJobCancellation>["reason"];
  deliveryAction: ReturnType<typeof planCommunicationJobCancellation>["deliveryAction"];
};

export async function persistCommunicationJobCancellation(input: {
  tx: CommunicationTransaction;
  institutionId: string;
  jobId: string;
  actorUserId: string;
  actorRole: "superadmin" | "proviseur";
  authenticatorLevel: "aal1" | "aal2";
  operatorConfirmedCancellation: boolean;
  cancelledAt?: Date;
}): Promise<PersistedCommunicationJobCancellation> {
  if (
    !UUID_PATTERN.test(input.institutionId) ||
    !UUID_PATTERN.test(input.jobId) ||
    !UUID_PATTERN.test(input.actorUserId)
  ) {
    throw new Error("job_cancellation_scope_invalid");
  }
  if (
    !DIRECTION_ROLES.has(input.actorRole) ||
    input.authenticatorLevel !== "aal2" ||
    input.operatorConfirmedCancellation !== true
  ) {
    throw new Error("job_cancellation_authorization_invalid");
  }
  const cancelledAt = input.cancelledAt ?? new Date();
  if (!Number.isFinite(cancelledAt.getTime())) throw new Error("job_cancellation_time_invalid");

  const [job] = await input.tx
    .select({
      id: communicationJobs.id,
      communicationId: communicationJobs.communicationId,
      deliveryId: communicationJobs.deliveryId,
      jobType: communicationJobs.jobType,
      status: communicationJobs.status,
    })
    .from(communicationJobs)
    .where(and(
      eq(communicationJobs.id, input.jobId),
      eq(communicationJobs.institutionId, input.institutionId)
    ))
    .limit(1)
    .for("update");
  if (!job) throw new Error("job_cancellation_state_missing");

  const delivery = job.deliveryId
    ? (await input.tx
      .select({ id: communicationDeliveries.id, status: communicationDeliveries.status })
      .from(communicationDeliveries)
      .where(and(
        eq(communicationDeliveries.id, job.deliveryId),
        eq(communicationDeliveries.institutionId, input.institutionId)
      ))
      .limit(1)
      .for("update"))[0]
    : undefined;
  if (job.deliveryId && !delivery) throw new Error("job_cancellation_delivery_missing");

  const decision = planCommunicationJobCancellation({
    jobType: job.jobType as CommunicationJobType,
    status: job.status,
    deliveryStatus: delivery?.status ?? null,
  });
  if (!decision.canCancelJob) {
    return {
      allowed: false,
      cancelled: false,
      reason: decision.reason,
      deliveryAction: decision.deliveryAction,
    };
  }

  const updated = await input.tx
    .update(communicationJobs)
    .set({
      status: "cancelled",
      lockedAt: null,
      completedAt: cancelledAt,
      lastErrorCode: null,
      updatedAt: cancelledAt,
    })
    .where(and(
      eq(communicationJobs.id, job.id),
      eq(communicationJobs.institutionId, input.institutionId),
      eq(communicationJobs.status, job.status)
    ))
    .returning({ id: communicationJobs.id });
  if (updated.length !== 1) throw new Error("job_cancellation_conflict");

  if (decision.deliveryAction === "cancel_pre_send_delivery") {
    if (!delivery || !PRE_SEND_STATUSES.has(delivery.status)) {
      throw new Error("delivery_cancellation_state_invalid");
    }
    const deliveryUpdated = await input.tx
      .update(communicationDeliveries)
      .set({ status: "cancelled", lastErrorCode: null, updatedAt: cancelledAt })
      .where(and(
        eq(communicationDeliveries.id, delivery.id),
        eq(communicationDeliveries.institutionId, input.institutionId),
        eq(communicationDeliveries.status, delivery.status)
      ))
      .returning({ id: communicationDeliveries.id });
    if (deliveryUpdated.length !== 1) throw new Error("delivery_cancellation_conflict");
  }

  await input.tx.insert(communicationEvents).values({
    institutionId: input.institutionId,
    communicationId: job.communicationId,
    resourceType: "job",
    resourceId: job.id,
    eventType: "job.cancelled",
    actorUserId: input.actorUserId,
    actorType: "user",
    summary: {
      reason: decision.reason,
      deliveryAction: decision.deliveryAction,
      cancelledAt: cancelledAt.toISOString(),
    },
  });

  return {
    allowed: true,
    cancelled: true,
    reason: decision.reason,
    deliveryAction: decision.deliveryAction,
  };
}
