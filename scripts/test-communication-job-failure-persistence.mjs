import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../api/_shared/communication-job-failure.ts", import.meta.url),
  "utf8"
);

test("locks the scoped job and delivery before planning failure", () => {
  assert.match(source, /\.from\(communicationJobs\)[\s\S]*\.innerJoin\(communicationDeliveries/);
  assert.match(source, /eq\(communicationJobs\.id, input\.jobId\)/);
  assert.match(source, /eq\(communicationJobs\.institutionId, input\.institutionId\)/);
  assert.match(source, /\.for\("update"\)[\s\S]*planCommunicationJobFailure/);
});

test("updates exactly the still-running job at the observed attempt", () => {
  assert.match(source, /status: decision\.nextStatus/);
  assert.match(source, /attemptCount: decision\.attemptCount/);
  assert.match(source, /lastErrorCode: decision\.failureCode/);
  assert.match(source, /eq\(communicationJobs\.status, "running"\)/);
  assert.match(source, /eq\(communicationJobs\.attemptCount, row\.attemptCount\)/);
  assert.match(source, /if \(updated\.length !== 1\) throw new Error\("job_failure_conflict"\)/);
});

test("marks only a pre-send delivery error and never regresses an advanced state", () => {
  assert.match(source, /PRE_SEND_STATUSES = new Set<StoredCommunicationDeliveryStatus>\(\["prepared", "queued", "error"\]\)/);
  assert.match(source, /PRE_SEND_STATUSES\.has\(row\.deliveryStatus/);
  assert.match(source, /\.update\(communicationDeliveries\)[\s\S]*status: "error"/);
  assert.match(source, /eq\(communicationDeliveries\.status, row\.deliveryStatus\)/);
  assert.doesNotMatch(source, /status: "error"[\s\S]{0,500}delivered|status: "error"[\s\S]{0,500}unsubscribed/);
});

test("writes only a closed failure code and bounded scheduling metadata", () => {
  assert.match(source, /eventType: decision\.nextStatus === "dead" \? "job\.dead" : "job\.retry_scheduled"/);
  assert.match(source, /summary: \{[\s\S]*failureCode:[\s\S]*attemptCount:[\s\S]*runAfter:/);
  assert.doesNotMatch(source, /providerMessage|providerText|errorMessage|recipientEmail|contactRef/);
});

test("returns the inbox decision without identifiers or provider details", () => {
  const returnBlock = source.slice(source.lastIndexOf("return {"));
  assert.match(returnBlock, /jobStatus: decision\.nextStatus/);
  assert.match(returnBlock, /showInFailureInbox: decision\.showInFailureInbox/);
  assert.doesNotMatch(returnBlock, /jobId|deliveryId|institutionId|communicationId|provider|contact/);
});
