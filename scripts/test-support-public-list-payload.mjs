import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");

test("validates the public request list before side effects", () => {
  const validation = page.indexOf("if (!isPublicSupportRequestListPayload(payload))");
  const notification = page.indexOf("const receivedCodes = new Set(payload.requests.map", validation);
  const memory = page.indexOf("await rememberSupportRequests(payload.requests)", validation);
  assert.notEqual(validation, -1);
  assert.ok(validation < notification);
  assert.ok(validation < memory);
});

test("bounds and validates every public request summary", () => {
  assert.match(page, /value\.requests\.length <= 200/);
  assert.match(page, /value\.requests\.every\(isPublicSupportRequestSummary\)/);
  assert.match(page, /\^BC-\\d\{4\}-\\d\{6\}\$/);
  assert.match(page, /Object\.hasOwn\(supportStatusLabels/);
  assert.match(page, /Object\.hasOwn\(priorityLabels/);
  assert.match(page, /Date\.parse\(value\.createdAt\) <= Date\.parse\(value\.updatedAt\)/);
});

test("rejects duplicate codes and stale refreshes", () => {
  assert.match(page, /new Set\(value\.requests\.map\(\(request\) => request\.publicCode\)\)\.size === value\.requests\.length/);
  assert.match(page, /const loadId = \+\+requestsLoadIdRef\.current/);
  assert.match(page, /if \(loadId !== requestsLoadIdRef\.current\) return;/);
});
