import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../api/support/requests/index.ts", import.meta.url), "utf8");

test("validates creation before remembering or displaying the dossier", () => {
  const submit = page.indexOf("async function submitRequest");
  const readUnknown = page.indexOf("const payload = await readApiResponse<unknown>(response)", submit);
  const validation = page.indexOf(
    "if (!isSupportRequestCreationPayload(",
    readUnknown
  );
  const remember = page.indexOf("rememberSupportRequests", validation);
  const ticket = page.indexOf("setTicketCode(publicCode)", validation);
  assert.notEqual(submit, -1);
  assert.ok(submit < readUnknown);
  assert.ok(readUnknown < validation);
  assert.ok(validation < ticket);
  assert.ok(validation < remember);
});

test("requires a complete, linked persistence confirmation", () => {
  assert.match(page, /function isSupportRequestCreationPayload/);
  assert.match(page, /\^BC-\\d\{4\}-\\d\{6\}\$/);
  assert.match(page, /Object\.hasOwn\(supportStatusLabels, String\(value\.request\.status\)\)/);
  assert.match(page, /typeof value\.duplicate !== "boolean"/);
  assert.match(page, /verifySupportRequestPersistenceConfirmation/);
  assert.match(page, /verifySupportCreateRequestActionConfirmation/);
  assert.match(page, /createdTime <= confirmedTime/);
});

test("rejects implausible future persistence timestamps", () => {
  assert.match(page, /createdTime <= Date\.now\(\) \+ \(5 \* 60_000\)/);
  assert.match(page, /confirmedTime <= Date\.now\(\) \+ \(5 \* 60_000\)/);
});

test("uses the unique insertion as the first idempotency decision", () => {
  const transaction = route.indexOf("const result = await db.transaction");
  const duplicateLookup = route.indexOf("const [duplicateCandidate]", transaction);
  const insertion = route.indexOf("const [created]", duplicateLookup);
  const racedLookup = route.indexOf("const [racedRequest]", insertion);
  const recovery = route.indexOf("duplicate: true", racedLookup);
  assert.ok(transaction >= 0 && transaction < duplicateLookup && duplicateLookup < insertion);
  assert.ok(insertion < racedLookup && racedLookup < recovery);
  assert.doesNotMatch(route.slice(transaction), /const \[existing\] = await tx/);
  assert.match(route, /onConflictDoNothing\(\{[\s\S]*supportRequests\.idempotencyKeyHash/);
});
