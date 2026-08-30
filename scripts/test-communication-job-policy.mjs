import assert from "node:assert/strict";
import test from "node:test";
import {
  planCommunicationJobCancellation,
  planCommunicationJobFailure,
} from "../shared/communication-job-policy.ts";

const now = new Date("2026-08-30T09:00:00.000Z");

test("retries temporary failures with bounded deterministic backoff", () => {
  assert.deepEqual(planCommunicationJobFailure({
    jobType: "send_delivery",
    status: "running",
    attemptCount: 0,
    failureCode: "provider_timeout",
  }, now), {
    nextStatus: "retry",
    attemptCount: 1,
    runAfter: "2026-08-30T09:01:00.000Z",
    failureCode: "provider_timeout",
    showInFailureInbox: false,
  });
  assert.equal(planCommunicationJobFailure({
    jobType: "send_delivery",
    status: "running",
    attemptCount: 3,
    failureCode: "provider_rate_limited",
  }, now).runAfter, "2026-08-30T10:00:00.000Z");
});

test("moves permanent or exhausted failures to the visible dead-letter inbox", () => {
  const permanent = planCommunicationJobFailure({
    jobType: "prepare_delivery",
    status: "running",
    attemptCount: 0,
    failureCode: "scope_invalid",
  }, now);
  assert.deepEqual({ status: permanent.nextStatus, runAfter: permanent.runAfter, visible: permanent.showInFailureInbox }, {
    status: "dead",
    runAfter: null,
    visible: true,
  });
  assert.equal(planCommunicationJobFailure({
    jobType: "publish",
    status: "running",
    attemptCount: 2,
    failureCode: "network_error",
  }, now).nextStatus, "dead");
  assert.equal(planCommunicationJobFailure({
    jobType: "retry_delivery",
    status: "running",
    attemptCount: 20,
    failureCode: "network_error",
  }, now).attemptCount, 20);
});

test("accepts only bounded failure codes and a currently running job", () => {
  const base = { jobType: "send_delivery", status: "running", attemptCount: 0, failureCode: "network_error" };
  assert.throws(() => planCommunicationJobFailure({ ...base, errorMessage: "private provider prose" }, now), /unknown_field/);
  assert.throws(() => planCommunicationJobFailure({ ...base, status: "pending" }, now), /job_not_running/);
  assert.throws(() => planCommunicationJobFailure({ ...base, failureCode: "provider said recipient@example.invalid" }, now), /failure_code_invalid/);
  assert.throws(() => planCommunicationJobFailure({ ...base, attemptCount: 21 }, now), /attempt_count_invalid/);
});

test("cancels pending work and distinguishes delivery compensation from recall", () => {
  assert.deepEqual(planCommunicationJobCancellation({
    jobType: "send_delivery",
    status: "pending",
    deliveryStatus: "queued",
  }), {
    canCancelJob: true,
    nextStatus: "cancelled",
    deliveryAction: "enqueue_cancel_delivery",
    reason: "cancelled_before_execution",
  });
  assert.equal(planCommunicationJobCancellation({
    jobType: "retry_delivery",
    status: "retry",
    deliveryStatus: "delivered",
  }).deliveryAction, "cannot_recall");
});

test("never mutates running or terminal work through the cancellation command", () => {
  assert.deepEqual(planCommunicationJobCancellation({
    jobType: "publish",
    status: "running",
    deliveryStatus: null,
  }), {
    canCancelJob: false,
    nextStatus: "running",
    deliveryAction: "none",
    reason: "running_requires_worker_checkpoint",
  });
  const completed = planCommunicationJobCancellation({
    jobType: "send_delivery",
    status: "completed",
    deliveryStatus: "sent",
  });
  assert.equal(completed.reason, "job_already_terminal");
  assert.equal(completed.deliveryAction, "cannot_recall");
});
