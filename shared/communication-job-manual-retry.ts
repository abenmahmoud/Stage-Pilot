import { createHmac } from "node:crypto";
import {
  COMMUNICATION_JOB_FAILURE_CODES,
  COMMUNICATION_JOB_TYPES,
  type CommunicationDeliveryLifecycleStatus,
  type CommunicationJobFailureCode,
  type CommunicationJobStatus,
  type CommunicationJobType,
} from "./communication-job-policy.js";

export type CommunicationManualRetryActorRole =
  | "superadmin"
  | "proviseur"
  | "administration"
  | "agent";

export type CommunicationManualRetryDecision = {
  allowed: boolean;
  reason:
    | "manual_retry_allowed"
    | "role_forbidden"
    | "mfa_required"
    | "job_not_dead"
    | "operator_confirmation_required"
    | "new_version_or_contact_required"
    | "delivery_state_required"
    | "delivery_terminal";
  successorJobType: CommunicationJobType | null;
  successorStatus: "pending" | null;
  successorAttemptCount: 0 | null;
  runAfter: string | null;
  preserveOriginalJob: true;
  auditEvent: "job.manual_retry_requested" | null;
};

const INPUT_FIELDS = new Set([
  "actorRole",
  "authenticatorLevel",
  "jobType",
  "status",
  "attemptCount",
  "failureCode",
  "deliveryStatus",
  "operatorConfirmedReady",
]);
const ACTOR_ROLES = new Set<CommunicationManualRetryActorRole>([
  "superadmin",
  "proviseur",
  "administration",
  "agent",
]);
const MANAGER_ROLES = new Set<CommunicationManualRetryActorRole>(["superadmin", "proviseur"]);
const JOB_TYPES = new Set<string>(COMMUNICATION_JOB_TYPES);
const JOB_STATUSES = new Set<CommunicationJobStatus>([
  "pending",
  "running",
  "retry",
  "completed",
  "dead",
  "cancelled",
]);
const FAILURE_CODES = new Set<string>(COMMUNICATION_JOB_FAILURE_CODES);
const DELIVERY_STATUSES = new Set<CommunicationDeliveryLifecycleStatus>([
  "prepared",
  "queued",
  "sent",
  "delivered",
  "deferred",
  "rejected",
  "unsubscribed",
  "error",
  "cancelled",
]);
const DELIVERY_TERMINAL_STATUSES = new Set<CommunicationDeliveryLifecycleStatus>([
  "sent",
  "delivered",
  "rejected",
  "unsubscribed",
  "cancelled",
]);
const REQUIRES_SOURCE_CHANGE = new Set<CommunicationJobFailureCode>([
  "scope_invalid",
  "content_missing",
  "provider_rejected",
]);
const REQUIRES_DELIVERY_STATE = new Set<CommunicationJobType>([
  "send_delivery",
  "retry_delivery",
  "cancel_delivery",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function exactInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("input_invalid");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !INPUT_FIELDS.has(key))) throw new Error("unknown_field");
  return input;
}

function deny(reason: Exclude<CommunicationManualRetryDecision["reason"], "manual_retry_allowed">): CommunicationManualRetryDecision {
  return {
    allowed: false,
    reason,
    successorJobType: null,
    successorStatus: null,
    successorAttemptCount: null,
    runAfter: null,
    preserveOriginalJob: true,
    auditEvent: null,
  };
}

function successorType(jobType: CommunicationJobType): CommunicationJobType {
  return jobType === "send_delivery" || jobType === "retry_delivery"
    ? "retry_delivery"
    : jobType;
}

export function planCommunicationManualRetry(
  value: unknown,
  serverNow = new Date()
): CommunicationManualRetryDecision {
  const input = exactInput(value);
  if (typeof input.actorRole !== "string" || !ACTOR_ROLES.has(input.actorRole as CommunicationManualRetryActorRole)) {
    throw new Error("actor_role_invalid");
  }
  const actorRole = input.actorRole as CommunicationManualRetryActorRole;
  if (input.authenticatorLevel !== "aal1" && input.authenticatorLevel !== "aal2") {
    throw new Error("authenticator_level_invalid");
  }
  if (typeof input.jobType !== "string" || !JOB_TYPES.has(input.jobType)) throw new Error("job_type_invalid");
  const jobType = input.jobType as CommunicationJobType;
  if (typeof input.status !== "string" || !JOB_STATUSES.has(input.status as CommunicationJobStatus)) {
    throw new Error("job_status_invalid");
  }
  const status = input.status as CommunicationJobStatus;
  if (!Number.isInteger(input.attemptCount) || Number(input.attemptCount) < 1 || Number(input.attemptCount) > 20) {
    throw new Error("attempt_count_invalid");
  }
  if (typeof input.failureCode !== "string" || !FAILURE_CODES.has(input.failureCode)) {
    throw new Error("failure_code_invalid");
  }
  const failureCode = input.failureCode as CommunicationJobFailureCode;
  const deliveryStatus = input.deliveryStatus == null
    ? null
    : input.deliveryStatus as CommunicationDeliveryLifecycleStatus;
  if (deliveryStatus !== null && !DELIVERY_STATUSES.has(deliveryStatus)) {
    throw new Error("delivery_status_invalid");
  }
  if (typeof input.operatorConfirmedReady !== "boolean") throw new Error("operator_confirmation_invalid");
  if (!Number.isFinite(serverNow.getTime())) throw new Error("server_time_invalid");

  if (!MANAGER_ROLES.has(actorRole)) return deny("role_forbidden");
  if (input.authenticatorLevel !== "aal2") return deny("mfa_required");
  if (status !== "dead") return deny("job_not_dead");
  if (!input.operatorConfirmedReady) return deny("operator_confirmation_required");
  if (REQUIRES_SOURCE_CHANGE.has(failureCode)) return deny("new_version_or_contact_required");
  if (REQUIRES_DELIVERY_STATE.has(jobType) && deliveryStatus === null) {
    return deny("delivery_state_required");
  }
  if (deliveryStatus !== null && DELIVERY_TERMINAL_STATUSES.has(deliveryStatus)) {
    return deny("delivery_terminal");
  }

  return {
    allowed: true,
    reason: "manual_retry_allowed",
    successorJobType: successorType(jobType),
    successorStatus: "pending",
    successorAttemptCount: 0,
    runAfter: serverNow.toISOString(),
    preserveOriginalJob: true,
    auditEvent: "job.manual_retry_requested",
  };
}

export function communicationManualRetryIdempotencyHash(input: {
  institutionId: string;
  originalJobId: string;
  secret: string;
}): string {
  if (!UUID_PATTERN.test(input.institutionId) || !UUID_PATTERN.test(input.originalJobId)) {
    throw new Error("retry_scope_invalid");
  }
  if (input.secret.length < 32) throw new Error("retry_secret_too_short");
  return createHmac("sha256", input.secret)
    .update(`communication-manual-retry:v1:${input.institutionId}:${input.originalJobId}`)
    .digest("hex");
}
