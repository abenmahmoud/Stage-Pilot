import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
  "utf8"
);

test("separates queue-only and detail-only request fields", () => {
  assert.match(source, /type AgentRequestCore = \{/);
  assert.match(source, /type AgentQueueRequest = AgentRequestCore & \{[\s\S]*callbackPending: boolean;[\s\S]*duplicatePending: boolean;/);
  assert.match(source, /type AgentRequest = AgentRequestCore & \{[\s\S]*description: string;[\s\S]*identityStatus: IdentityStatus;/);
});

test("validates the complete request and staff access", () => {
  assert.match(source, /isAgentRequest\(value\.request\)/);
  assert.match(source, /isAgentAccess\(value\.access\)/);
  assert.match(source, /isStringOrNull\(record\.identityVerifiedAt\)/);
});

test("validates every visible detail collection", () => {
  for (const validator of ["isAgentContact", "isAgentMessage", "isAgentAttachment", "isAgentCallback"]) {
    assert.match(source, new RegExp(`\\.every\\(${validator}\\)`), `${validator} must protect its collection`);
  }
});

test("validates both optional review objects", () => {
  assert.match(source, /isAgentDuplicateReview\(value\.duplicateReview\)/);
  assert.match(source, /isAgentRoutingReview\(value\.routingReview\)/);
  assert.match(source, /\["pending", "confirmed", "corrected"\]\.includes/);
});

test("routes every detail refresh through the runtime validator", () => {
  assert.match(source, /async function fetchAgentRequestDetail\(code: string\)/);
  assert.match(source, /const payload = await apiFetch<unknown>\(`/);
  assert.match(source, /if \(!isAgentRequestDetail\(payload\)\)/);
  assert.doesNotMatch(source, /apiFetch<AgentRequestDetail>/);
  assert.doesNotMatch(source, /setDetail\(await apiFetch/);
});
