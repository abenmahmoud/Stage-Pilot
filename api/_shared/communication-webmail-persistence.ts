import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  communicationDeliveries,
  communicationEvents,
  communicationJobs,
} from "../../db/schema.js";
import {
  planCommunicationWebmailCompletion,
  type CommunicationWebmailCompletionState,
} from "../../shared/communication-webmail-completion.js";
import type { StoredCommunicationDeliveryStatus } from "../../shared/communication-delivery-transition.js";
import type { VerifiedCommunicationWebmailDeliveryCommand } from "../../shared/communication-webmail-delivery.js";
import type { VerifiedCommunicationWebmailDeliveryReceipt } from "../../shared/communication-webmail-receipt.js";

type CommunicationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type PersistedCommunicationWebmailCompletion = {
  accepted: true;
  duplicate: boolean;
  deliveryStatus: StoredCommunicationDeliveryStatus;
  jobStatus: "completed";
};

export async function persistCommunicationWebmailCompletion(input: {
  tx: CommunicationTransaction;
  institutionId: string;
  jobId: string;
  command: VerifiedCommunicationWebmailDeliveryCommand;
  receipt: VerifiedCommunicationWebmailDeliveryReceipt;
  completedAt?: Date;
}): Promise<PersistedCommunicationWebmailCompletion> {
  const completedAt = input.completedAt ?? new Date();
  if (!Number.isFinite(completedAt.getTime())) throw new Error("completion_time_invalid");

  const [row] = await input.tx
    .select({
      deliveryId: communicationDeliveries.id,
      deliveryInstitutionId: communicationDeliveries.institutionId,
      deliveryStatus: communicationDeliveries.status,
      resolutionHash: communicationDeliveries.resolutionHash,
      commandHash: communicationDeliveries.commandHash,
      deliveryIdempotencyKeyHash: communicationDeliveries.idempotencyKeyHash,
      providerMessageRef: communicationDeliveries.providerMessageRef,
      webmailReceiptHash: communicationDeliveries.webmailReceiptHash,
      sentAt: communicationDeliveries.sentAt,
      communicationId: communicationDeliveries.communicationId,
      jobDeliveryId: communicationJobs.deliveryId,
      jobType: communicationJobs.jobType,
      jobStatus: communicationJobs.status,
    })
    .from(communicationJobs)
    .innerJoin(communicationDeliveries, and(
      eq(communicationJobs.deliveryId, communicationDeliveries.id),
      eq(communicationJobs.institutionId, communicationDeliveries.institutionId)
    ))
    .where(and(
      eq(communicationJobs.id, input.jobId),
      eq(communicationJobs.institutionId, input.institutionId),
      eq(communicationDeliveries.id, input.command.deliveryId),
      eq(communicationDeliveries.institutionId, input.institutionId)
    ))
    .limit(1)
    .for("update");
  if (!row || !row.resolutionHash || !row.commandHash || !row.jobDeliveryId) {
    throw new Error("completion_state_missing");
  }

  const state: CommunicationWebmailCompletionState = {
    delivery: {
      institutionId: row.deliveryInstitutionId,
      deliveryId: row.deliveryId,
      status: row.deliveryStatus as StoredCommunicationDeliveryStatus,
      resolutionHash: row.resolutionHash,
      commandHash: row.commandHash,
      idempotencyKeyHash: row.deliveryIdempotencyKeyHash,
      providerMessageRef: row.providerMessageRef,
      webmailReceiptHash: row.webmailReceiptHash,
      sentAt: row.sentAt?.toISOString() ?? null,
    },
    job: {
      deliveryId: row.jobDeliveryId,
      jobType: row.jobType as "send_delivery" | "retry_delivery",
      status: row.jobStatus as "running",
    },
  };
  const decision = planCommunicationWebmailCompletion({
    state,
    command: input.command,
    receipt: input.receipt,
  });

  await input.tx
    .insert(communicationEvents)
    .values({
      institutionId: input.institutionId,
      communicationId: row.communicationId,
      resourceType: "delivery",
      resourceId: row.deliveryId,
      eventType: decision.eventType,
      actorType: "webmail",
      externalEventHash: input.receipt.receiptHash,
      summary: {
        provider: input.receipt.provider,
        outcome: input.receipt.outcome,
        acceptedAt: input.receipt.acceptedAt,
      },
    })
    .onConflictDoNothing();

  if (decision.applyDelivery) {
    const updated = await input.tx
      .update(communicationDeliveries)
      .set({
        status: decision.nextDeliveryStatus,
        providerMessageRef: decision.providerMessageRef,
        webmailReceiptHash: decision.webmailReceiptHash,
        sentAt: new Date(decision.sentAt),
        attemptCount: sql`${communicationDeliveries.attemptCount} + 1`,
        lastErrorCode: null,
        updatedAt: completedAt,
      })
      .where(and(
        eq(communicationDeliveries.id, row.deliveryId),
        eq(communicationDeliveries.institutionId, input.institutionId),
        eq(communicationDeliveries.commandHash, decision.commandHash),
        eq(communicationDeliveries.idempotencyKeyHash, input.command.idempotencyKeyHash),
        eq(communicationDeliveries.status, row.deliveryStatus)
      ))
      .returning({ id: communicationDeliveries.id });
    if (updated.length !== 1) throw new Error("delivery_completion_conflict");
  }

  const completed = await input.tx
    .update(communicationJobs)
    .set({
      status: "completed",
      completedAt,
      lockedAt: null,
      lastErrorCode: null,
      updatedAt: completedAt,
    })
    .where(and(
      eq(communicationJobs.id, input.jobId),
      eq(communicationJobs.institutionId, input.institutionId),
      eq(communicationJobs.deliveryId, row.deliveryId),
      eq(communicationJobs.status, "running")
    ))
    .returning({ id: communicationJobs.id });
  if (completed.length !== 1) throw new Error("job_completion_conflict");

  return {
    accepted: true,
    duplicate: decision.duplicate,
    deliveryStatus: decision.nextDeliveryStatus,
    jobStatus: "completed",
  };
}
