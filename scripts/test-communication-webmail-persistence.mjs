import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../api/_shared/communication-webmail-persistence.ts", import.meta.url),
  "utf8"
);

test("locks the scoped job and delivery before recomputing the decision", () => {
  assert.match(source, /\.from\(communicationJobs\)[\s\S]*\.innerJoin\(communicationDeliveries/);
  assert.match(source, /eq\(communicationJobs\.id, input\.jobId\)/);
  assert.match(source, /eq\(communicationJobs\.institutionId, input\.institutionId\)/);
  assert.match(source, /eq\(communicationDeliveries\.id, input\.command\.deliveryId\)/);
  assert.match(source, /eq\(communicationDeliveries\.institutionId, input\.institutionId\)/);
  assert.match(source, /\.for\("update"\)[\s\S]*planCommunicationWebmailCompletion/);
});

test("records a bounded idempotent event without recipient or provider prose", () => {
  assert.match(source, /\.insert\(communicationEvents\)[\s\S]*externalEventHash: input\.receipt\.receiptHash/);
  assert.match(source, /summary: \{[\s\S]*provider:[\s\S]*outcome:[\s\S]*acceptedAt:/);
  assert.match(source, /\.onConflictDoNothing\(\)/);
  assert.doesNotMatch(source, /recipientEmail|firstName|lastName|providerMessageId|providerText/);
});

test("updates the delivery only under the locked command and status", () => {
  assert.match(source, /\.update\(communicationDeliveries\)[\s\S]*providerMessageRef: decision\.providerMessageRef/);
  assert.match(source, /webmailReceiptHash: decision\.webmailReceiptHash/);
  assert.match(source, /attemptCount: sql`\$\{communicationDeliveries\.attemptCount\} \+ 1`/);
  assert.match(source, /eq\(communicationDeliveries\.commandHash, decision\.commandHash\)/);
  assert.match(source, /eq\(communicationDeliveries\.idempotencyKeyHash, input\.command\.idempotencyKeyHash\)/);
  assert.match(source, /eq\(communicationDeliveries\.status, row\.deliveryStatus\)/);
});

test("completes the exact running job in the same caller transaction", () => {
  assert.match(source, /\.update\(communicationJobs\)[\s\S]*status: "completed"/);
  assert.match(source, /completedAt,[\s\S]*lockedAt: null[\s\S]*lastErrorCode: null/);
  assert.match(source, /eq\(communicationJobs\.deliveryId, row\.deliveryId\)/);
  assert.match(source, /eq\(communicationJobs\.status, "running"\)/);
  assert.match(source, /if \(completed\.length !== 1\) throw new Error\("job_completion_conflict"\)/);
});

test("returns only bounded completion metadata", () => {
  const returnBlock = source.slice(source.lastIndexOf("return {"));
  assert.match(returnBlock, /accepted: true/);
  assert.match(returnBlock, /duplicate: decision\.duplicate/);
  assert.match(returnBlock, /deliveryStatus: decision\.nextDeliveryStatus/);
  assert.match(returnBlock, /jobStatus: "completed"/);
  assert.doesNotMatch(returnBlock, /receiptHash|providerMessageRef|commandHash|institutionId|communicationId/);
});
