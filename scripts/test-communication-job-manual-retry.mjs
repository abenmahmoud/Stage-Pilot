import assert from "node:assert/strict";
import test from "node:test";
import {
  communicationManualRetryIdempotencyHash,
  planCommunicationManualRetry,
} from "../shared/communication-job-manual-retry.ts";

const now = new Date("2026-08-30T10:00:00.000Z");
const allowedInput = {
  actorRole: "superadmin",
  authenticatorLevel: "aal2",
  jobType: "send_delivery",
  status: "dead",
  attemptCount: 5,
  failureCode: "provider_timeout",
  deliveryStatus: "error",
  operatorConfirmedReady: true,
};

test("creates a fresh idempotent retry job while preserving the failed job", () => {
  assert.deepEqual(planCommunicationManualRetry(allowedInput, now), {
    allowed: true,
    reason: "manual_retry_allowed",
    successorJobType: "retry_delivery",
    successorStatus: "pending",
    successorAttemptCount: 0,
    runAfter: "2026-08-30T10:00:00.000Z",
    preserveOriginalJob: true,
    auditEvent: "job.manual_retry_requested",
  });
});

test("requires a direction role and MFA", () => {
  assert.equal(planCommunicationManualRetry({ ...allowedInput, actorRole: "administration" }, now).reason, "role_forbidden");
  assert.equal(planCommunicationManualRetry({ ...allowedInput, authenticatorLevel: "aal1" }, now).reason, "mfa_required");
});

test("requires a dead job and an explicit operator confirmation", () => {
  assert.equal(planCommunicationManualRetry({ ...allowedInput, status: "retry" }, now).reason, "job_not_dead");
  assert.equal(planCommunicationManualRetry({ ...allowedInput, operatorConfirmedReady: false }, now).reason, "operator_confirmation_required");
});

test("does not retry a source error or a terminal delivery", () => {
  assert.equal(planCommunicationManualRetry({ ...allowedInput, failureCode: "content_missing" }, now).reason, "new_version_or_contact_required");
  assert.equal(planCommunicationManualRetry({ ...allowedInput, deliveryStatus: null }, now).reason, "delivery_state_required");
  for (const deliveryStatus of ["sent", "delivered", "rejected", "unsubscribed", "cancelled"]) {
    assert.equal(planCommunicationManualRetry({ ...allowedInput, deliveryStatus }, now).reason, "delivery_terminal");
  }
});

test("rejects unbounded input and provider prose", () => {
  assert.throws(() => planCommunicationManualRetry({ ...allowedInput, providerMessage: "recipient@example.invalid" }, now), /unknown_field/);
  assert.throws(() => planCommunicationManualRetry({ ...allowedInput, failureCode: "provider says timeout for user@example.invalid" }, now), /failure_code_invalid/);
  assert.throws(() => planCommunicationManualRetry({ ...allowedInput, attemptCount: 0 }, now), /attempt_count_invalid/);
});

test("derives a stable institution-scoped retry key without exposing identifiers", () => {
  const input = {
    institutionId: "a40f7fc7-cd6a-4d4d-bf3b-1a57efb39f6d",
    originalJobId: "f7af2cf7-9845-4cb8-a7c7-94a758b5fd82",
    secret: "preview-only-fictitious-secret-32-bytes-minimum",
  };
  const first = communicationManualRetryIdempotencyHash(input);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, communicationManualRetryIdempotencyHash(input));
  assert.notEqual(first, communicationManualRetryIdempotencyHash({
    ...input,
    institutionId: "9d4b7990-0a41-440b-a262-1f174c278580",
  }));
  assert.equal(first.includes(input.originalJobId), false);
  assert.throws(() => communicationManualRetryIdempotencyHash({ ...input, secret: "too-short" }), /retry_secret_too_short/);
});
