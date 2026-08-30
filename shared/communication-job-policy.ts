export const COMMUNICATION_JOB_TYPES = [
  "publish",
  "prepare_delivery",
  "send_delivery",
  "retry_delivery",
  "cancel_delivery",
  "weekly_digest",
] as const;

export const COMMUNICATION_JOB_FAILURE_CODES = [
  "provider_timeout",
  "provider_unavailable",
  "provider_rate_limited",
  "network_error",
  "worker_interrupted",
  "configuration_missing",
  "authorization_failed",
  "scope_invalid",
  "content_missing",
  "provider_rejected",
  "unknown_failure",
] as const;

export type CommunicationJobType = (typeof COMMUNICATION_JOB_TYPES)[number];
export type CommunicationJobFailureCode = (typeof COMMUNICATION_JOB_FAILURE_CODES)[number];
export type CommunicationJobStatus = "pending" | "running" | "retry" | "completed" | "dead" | "cancelled";
export type CommunicationDeliveryLifecycleStatus =
  | "prepared"
  | "queued"
  | "sent"
  | "delivered"
  | "deferred"
  | "rejected"
  | "spam"
  | "unsubscribed"
  | "error"
  | "cancelled";

export type CommunicationJobFailureDecision = {
  nextStatus: "retry" | "dead";
  attemptCount: number;
  runAfter: string | null;
  failureCode: CommunicationJobFailureCode;
  showInFailureInbox: boolean;
};

export type CommunicationJobCancellationDecision = {
  canCancelJob: boolean;
  nextStatus: CommunicationJobStatus;
  deliveryAction: "none" | "enqueue_cancel_delivery" | "cannot_recall";
  reason:
    | "cancelled_before_execution"
    | "running_requires_worker_checkpoint"
    | "job_already_terminal";
};

const FAILURE_INPUT_FIELDS = new Set(["jobType", "status", "attemptCount", "failureCode"]);
const CANCELLATION_INPUT_FIELDS = new Set(["jobType", "status", "deliveryStatus"]);
const JOB_TYPE_SET = new Set<string>(COMMUNICATION_JOB_TYPES);
const FAILURE_CODE_SET = new Set<string>(COMMUNICATION_JOB_FAILURE_CODES);
const STATUS_SET = new Set<CommunicationJobStatus>([
  "pending",
  "running",
  "retry",
  "completed",
  "dead",
  "cancelled",
]);
const DELIVERY_STATUS_SET = new Set<CommunicationDeliveryLifecycleStatus>([
  "prepared",
  "queued",
  "sent",
  "delivered",
  "deferred",
  "rejected",
  "spam",
  "unsubscribed",
  "error",
  "cancelled",
]);
const PERMANENT_FAILURES = new Set<CommunicationJobFailureCode>([
  "configuration_missing",
  "authorization_failed",
  "scope_invalid",
  "content_missing",
  "provider_rejected",
]);
const MAX_ATTEMPTS: Record<CommunicationJobType, number> = {
  publish: 3,
  prepare_delivery: 5,
  send_delivery: 5,
  retry_delivery: 5,
  cancel_delivery: 5,
  weekly_digest: 3,
};
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];

function exactObject(value: unknown, fields: Set<string>): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("input_invalid");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !fields.has(key))) throw new Error("unknown_field");
  return input;
}

function jobType(value: unknown): CommunicationJobType {
  if (typeof value !== "string" || !JOB_TYPE_SET.has(value)) throw new Error("job_type_invalid");
  return value as CommunicationJobType;
}

function jobStatus(value: unknown): CommunicationJobStatus {
  if (typeof value !== "string" || !STATUS_SET.has(value as CommunicationJobStatus)) {
    throw new Error("job_status_invalid");
  }
  return value as CommunicationJobStatus;
}

function attemptCount(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 20) {
    throw new Error("attempt_count_invalid");
  }
  return Number(value);
}

export function planCommunicationJobFailure(
  value: unknown,
  serverNow = new Date()
): CommunicationJobFailureDecision {
  const input = exactObject(value, FAILURE_INPUT_FIELDS);
  const parsedType = jobType(input.jobType);
  const status = jobStatus(input.status);
  if (status !== "running") throw new Error("job_not_running");
  const previousAttempts = attemptCount(input.attemptCount);
  if (typeof input.failureCode !== "string" || !FAILURE_CODE_SET.has(input.failureCode)) {
    throw new Error("failure_code_invalid");
  }
  if (!Number.isFinite(serverNow.getTime())) throw new Error("server_time_invalid");

  const failureCode = input.failureCode as CommunicationJobFailureCode;
  const nextAttempt = Math.min(previousAttempts + 1, 20);
  const terminal = PERMANENT_FAILURES.has(failureCode) || nextAttempt >= MAX_ATTEMPTS[parsedType];
  if (terminal) {
    return {
      nextStatus: "dead",
      attemptCount: nextAttempt,
      runAfter: null,
      failureCode,
      showInFailureInbox: true,
    };
  }
  const delay = RETRY_DELAYS_MS[Math.min(nextAttempt - 1, RETRY_DELAYS_MS.length - 1)];
  return {
    nextStatus: "retry",
    attemptCount: nextAttempt,
    runAfter: new Date(serverNow.getTime() + delay).toISOString(),
    failureCode,
    showInFailureInbox: false,
  };
}

export function planCommunicationJobCancellation(value: unknown): CommunicationJobCancellationDecision {
  const input = exactObject(value, CANCELLATION_INPUT_FIELDS);
  jobType(input.jobType);
  const status = jobStatus(input.status);
  const deliveryStatus = input.deliveryStatus == null
    ? null
    : input.deliveryStatus as CommunicationDeliveryLifecycleStatus;
  if (deliveryStatus !== null && !DELIVERY_STATUS_SET.has(deliveryStatus)) {
    throw new Error("delivery_status_invalid");
  }

  if (status === "running") {
    return {
      canCancelJob: false,
      nextStatus: "running",
      deliveryAction: "none",
      reason: "running_requires_worker_checkpoint",
    };
  }
  if (status !== "pending" && status !== "retry") {
    return {
      canCancelJob: false,
      nextStatus: status,
      deliveryAction: deliveryStatus && [
        "sent", "delivered", "deferred", "rejected", "spam", "unsubscribed",
      ].includes(deliveryStatus)
        ? "cannot_recall"
        : "none",
      reason: "job_already_terminal",
    };
  }

  const deliveryAction = deliveryStatus && [
    "sent", "delivered", "deferred", "rejected", "spam", "unsubscribed",
  ].includes(deliveryStatus)
    ? "cannot_recall"
    : deliveryStatus && ["prepared", "queued", "error"].includes(deliveryStatus)
      ? "enqueue_cancel_delivery"
      : "none";
  return {
    canCancelJob: true,
    nextStatus: "cancelled",
    deliveryAction,
    reason: "cancelled_before_execution",
  };
}
