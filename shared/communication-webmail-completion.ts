import type { StoredCommunicationDeliveryStatus } from "./communication-delivery-transition.js";
import type { VerifiedCommunicationWebmailDeliveryCommand } from "./communication-webmail-delivery.js";
import type { VerifiedCommunicationWebmailDeliveryReceipt } from "./communication-webmail-receipt.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const ELIGIBLE_JOB_TYPES = new Set(["send_delivery", "retry_delivery"]);
const PRE_SEND_STATUSES = new Set<StoredCommunicationDeliveryStatus>(["queued", "error"]);
const POST_SEND_STATUSES = new Set<StoredCommunicationDeliveryStatus>([
  "sent",
  "delivered",
  "deferred",
  "rejected",
  "spam",
  "unsubscribed",
]);

export type CommunicationWebmailCompletionState = {
  delivery: {
    institutionId: string;
    deliveryId: string;
    status: StoredCommunicationDeliveryStatus;
    resolutionHash: string;
    commandHash: string;
    idempotencyKeyHash: string;
    providerMessageRef: string | null;
    webmailReceiptHash: string | null;
    sentAt: string | null;
  };
  job: {
    deliveryId: string;
    jobType: "send_delivery" | "retry_delivery";
    status: "running";
  };
};

export type CommunicationWebmailCompletionDecision = {
  applyDelivery: boolean;
  completeJob: true;
  duplicate: boolean;
  nextDeliveryStatus: StoredCommunicationDeliveryStatus;
  providerMessageRef: string;
  commandHash: string;
  resolutionHash: string;
  webmailReceiptHash: string;
  sentAt: string;
  eventType: "delivery.sent" | "delivery.send_duplicate";
};

function hash(value: unknown, reason: string): string {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) throw new Error(reason);
  return value;
}

function timestamp(value: unknown, reason: string): string {
  if (typeof value !== "string") throw new Error(reason);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(reason);
  return value;
}

function validateState(state: CommunicationWebmailCompletionState): void {
  if (!state || !state.delivery || !state.job) throw new Error("state_invalid");
  if (!UUID_PATTERN.test(state.delivery.institutionId) || !UUID_PATTERN.test(state.delivery.deliveryId)) {
    throw new Error("delivery_scope_invalid");
  }
  if (state.job.deliveryId !== state.delivery.deliveryId) throw new Error("job_delivery_mismatch");
  if (!ELIGIBLE_JOB_TYPES.has(state.job.jobType)) throw new Error("job_type_invalid");
  if (state.job.status !== "running") throw new Error("job_not_running");
  hash(state.delivery.resolutionHash, "resolution_hash_invalid");
  hash(state.delivery.commandHash, "command_hash_invalid");
  hash(state.delivery.idempotencyKeyHash, "idempotency_hash_invalid");
  if (state.delivery.providerMessageRef !== null) hash(state.delivery.providerMessageRef, "provider_message_ref_invalid");
  if (state.delivery.webmailReceiptHash !== null) hash(state.delivery.webmailReceiptHash, "receipt_hash_invalid");
  if (state.delivery.sentAt !== null) timestamp(state.delivery.sentAt, "sent_at_invalid");
}

export function planCommunicationWebmailCompletion(input: {
  state: CommunicationWebmailCompletionState;
  command: VerifiedCommunicationWebmailDeliveryCommand;
  receipt: VerifiedCommunicationWebmailDeliveryReceipt;
}): CommunicationWebmailCompletionDecision {
  validateState(input.state);
  const { delivery } = input.state;
  const { command, receipt } = input;
  if (
    command.institutionId !== delivery.institutionId ||
    command.deliveryId !== delivery.deliveryId ||
    command.resolutionHash !== delivery.resolutionHash ||
    command.commandHash !== delivery.commandHash ||
    command.idempotencyKeyHash !== delivery.idempotencyKeyHash
  ) {
    throw new Error("command_state_mismatch");
  }
  if (
    receipt.institutionId !== command.institutionId ||
    receipt.deliveryId !== command.deliveryId ||
    receipt.commandHash !== command.commandHash ||
    receipt.idempotencyKeyHash !== command.idempotencyKeyHash
  ) {
    throw new Error("receipt_command_mismatch");
  }
  hash(receipt.providerMessageRef, "provider_message_ref_invalid");
  hash(receipt.receiptHash, "receipt_hash_invalid");
  const acceptedAt = timestamp(receipt.acceptedAt, "accepted_at_invalid");

  if (PRE_SEND_STATUSES.has(delivery.status)) {
    if (delivery.providerMessageRef !== null || delivery.webmailReceiptHash !== null || delivery.sentAt !== null) {
      throw new Error("pre_send_state_inconsistent");
    }
    return {
      applyDelivery: true,
      completeJob: true,
      duplicate: receipt.outcome === "duplicate",
      nextDeliveryStatus: "sent",
      providerMessageRef: receipt.providerMessageRef,
      commandHash: command.commandHash,
      resolutionHash: command.resolutionHash,
      webmailReceiptHash: receipt.receiptHash,
      sentAt: acceptedAt,
      eventType: receipt.outcome === "duplicate" ? "delivery.send_duplicate" : "delivery.sent",
    };
  }

  if (POST_SEND_STATUSES.has(delivery.status)) {
    if (
      delivery.providerMessageRef !== receipt.providerMessageRef ||
      delivery.webmailReceiptHash === null ||
      delivery.sentAt === null
    ) {
      throw new Error("post_send_state_mismatch");
    }
    return {
      applyDelivery: false,
      completeJob: true,
      duplicate: true,
      nextDeliveryStatus: delivery.status,
      providerMessageRef: delivery.providerMessageRef,
      commandHash: delivery.commandHash,
      resolutionHash: delivery.resolutionHash,
      webmailReceiptHash: delivery.webmailReceiptHash,
      sentAt: delivery.sentAt,
      eventType: "delivery.send_duplicate",
    };
  }

  throw new Error("delivery_not_sendable");
}
