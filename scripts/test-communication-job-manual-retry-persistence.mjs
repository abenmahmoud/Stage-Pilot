import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../api/_shared/communication-job-manual-retry-persistence.ts", import.meta.url),
  "utf8"
);

test("locks the scoped original job and delivery before authorizing", () => {
  assert.match(source, /\.from\(communicationJobs\)[\s\S]*\.innerJoin\(communicationDeliveries/);
  assert.match(source, /eq\(communicationJobs\.id, input\.originalJobId\)/);
  assert.match(source, /eq\(communicationJobs\.institutionId, input\.institutionId\)/);
  assert.match(source, /\.for\("update"\)[\s\S]*planCommunicationManualRetry/);
});

test("passes the nominative role, MFA and explicit confirmation to the policy", () => {
  assert.match(source, /actorRole: input\.actorRole/);
  assert.match(source, /authenticatorLevel: input\.authenticatorLevel/);
  assert.match(source, /operatorConfirmedReady: input\.operatorConfirmedReady/);
  assert.match(source, /if \(!decision\.allowed[\s\S]*return \{ allowed: false/);
});

test("creates one fresh pending successor with a derived idempotency hash", () => {
  assert.match(source, /communicationManualRetryIdempotencyHash\(\{/);
  assert.match(source, /originalJobId: input\.originalJobId/);
  assert.match(source, /\.insert\(communicationJobs\)[\s\S]*jobType: decision\.successorJobType/);
  assert.match(source, /status: "pending"[\s\S]*attemptCount: 0/);
  assert.match(source, /\.onConflictDoNothing\(\)[\s\S]*created = inserted\.length === 1/);
});

test("preserves the original and audits only the first successful request", () => {
  assert.doesNotMatch(source, /\.update\(communicationJobs\)/);
  assert.match(source, /if \(created\) \{[\s\S]*\.insert\(communicationEvents\)/);
  assert.match(source, /eventType: "job\.manual_retry_requested"/);
  assert.match(source, /actorUserId: input\.actorUserId/);
  assert.doesNotMatch(source, /providerText|providerMessage|recipientEmail|contactRef/);
});

test("returns no job id, contact or secret", () => {
  const returnBlock = source.slice(source.lastIndexOf("return {"));
  assert.match(returnBlock, /allowed: true/);
  assert.match(returnBlock, /created,/);
  assert.match(returnBlock, /duplicate: !created/);
  assert.doesNotMatch(returnBlock, /jobId|deliveryId|institutionId|idempotency|secret|contact|provider/);
});
