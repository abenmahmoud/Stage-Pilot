import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");

test("distinguishes queue rows from complete request details", () => {
  assert.match(page, /type AgentQueueRequest = \{/);
  assert.match(page, /type AgentRequest = AgentQueueRequest & \{/);
  assert.match(page, /useState<AgentQueueRequest\[]>\(\[]\)/);
});

test("validates every row and nested queue section", () => {
  assert.match(page, /value\.requests\.every\(isAgentQueueRequest\)/);
  assert.match(page, /isAgentQueueStats\(value\.stats\)/);
  assert.match(page, /value\.serviceStats\.every\(isAgentServiceStats\)/);
  assert.match(page, /isAgentQueuePagination\(value\.pagination\)/);
  assert.match(page, /isAgentAccess\(value\.access\)/);
});

test("rejects malformed counters, access flags and subject context", () => {
  assert.match(page, /function isNonNegativeInteger\(/);
  assert.match(page, /Object\.values\(value\.subjectContext\)\.every\(\(item\) => typeof item === "string"\)/);
  assert.match(page, /typeof value\.canViewAll === "boolean"/);
  assert.match(page, /typeof value\.canRoute === "boolean"/);
  assert.match(page, /typeof value\.canManageTemplates === "boolean"/);
});

test("validates before replacing the visible queue", () => {
  const validation = page.indexOf("if (!isAgentQueuePayload(payload))");
  const replacement = page.indexOf("setRequests(payload.requests)");
  assert.notEqual(validation, -1);
  assert.notEqual(replacement, -1);
  assert.ok(validation < replacement);
});
