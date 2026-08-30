import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");

test("validates the assistant response before rendering it", () => {
  const assistantFunction = page.indexOf("async function askAssistant");
  const readUnknown = page.indexOf('apiFetch<unknown>("support/assistant"', assistantFunction);
  const validation = page.indexOf("if (!isAssistantApiResult(apiResult))", readUnknown);
  const resultAssignment = page.indexOf("result = assistantResult", validation);
  assert.notEqual(assistantFunction, -1);
  assert.ok(assistantFunction < readUnknown);
  assert.ok(readUnknown < validation);
  assert.ok(validation < resultAssignment);
});

test("bounds assistant fields, actions, sources and turns", () => {
  assert.match(page, /isBoundedString\(value\.reply, 1_500\)/);
  assert.match(page, /supportCategories\.some\(\(category\) => category\.value === value\.category\)/);
  assert.match(page, /\["continue", "offer_case", "human_transfer", "stop"\]/);
  assert.match(page, /value\.turnCount <= 10/);
  assert.match(page, /value\.remainingTurns <= 10/);
  assert.match(page, /value\.sourceReferences\.length <= 20/);
  assert.match(page, /value\.sourceReferences\.every\(isAssistantSourceReference\)/);
});

test("accepts only an absent receipt pair or a bounded short-lived signed receipt", () => {
  assert.match(page, /value\.routingReceipt === null && value\.routingReceiptExpiresAt === null/);
  assert.match(page, /value\.routingReceipt\.length > 2_048/);
  assert.match(page, /hasValidAssistantRoutingReceipt\(value\)/);
  assert.match(page, /expiresAt <= Date\.now\(\) \+ \(16 \* 60_000\)/);
});
