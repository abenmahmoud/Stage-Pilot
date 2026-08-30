import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../api/_shared/communication-recipient-persistence.ts", import.meta.url),
  "utf8"
);

test("locks the exact current approved communication version", () => {
  assert.match(source, /innerJoin\(communicationVersions/);
  assert.match(source, /eq\(communications\.institutionId, input\.resolution\.institutionId\)/);
  assert.match(source, /eq\(communicationVersions\.version, input\.resolution\.version\)/);
  assert.match(source, /\.for\("update"\)/);
  assert.match(source, /scope\.currentVersion !== input\.resolution\.version/);
  assert.match(source, /resolution_version_not_current_approved/);
});

test("persists only opaque prepared deliveries with the exact resolution hash", () => {
  assert.match(source, /prepareCommunicationDeliveryRows\(input\.resolution, input\.idempotencySecret\)/);
  assert.match(source, /resolutionHash: input\.resolution\.resolutionHash/);
  assert.match(source, /\.onConflictDoNothing\(\)/);
  assert.doesNotMatch(source, /recipientEmail|emailAddress|firstName|lastName/);
});

test("re-reads every idempotency key and rejects a conflicting replay", () => {
  assert.match(source, /inArray\(communicationDeliveries\.idempotencyKeyHash, hashes\)/);
  assert.match(source, /stored\.length !== prepared\.length/);
  assert.match(source, /row\.contactRef !== expected\.contactRef/);
  assert.match(source, /row\.resolutionHash !== input\.resolution\.resolutionHash/);
  assert.match(source, /delivery_resolution_conflict/);
});

test("accepts an identical replay independently of the delivery lifecycle", () => {
  const storedProjection = source.match(/const stored =([\s\S]*?)const expectedByHash/)?.[1] ?? "";
  assert.doesNotMatch(storedProjection, /communicationDeliveries\.status/);
  assert.doesNotMatch(source, /row\.status/);
});

test("audits aggregate page counts and returns no delivery identifiers", () => {
  const summary = source.match(/summary: \{([\s\S]*?)\n      \},/)?.[1] ?? "";
  assert.match(summary, /pageIndex/);
  assert.match(summary, /preparedCount/);
  assert.doesNotMatch(summary, /contactRef|idempotencyKeyHash|resolutionHash/);
  const returnBlock = source.match(/return \{\n    accepted: true,([\s\S]*?)\n  \};/)?.[1] ?? "";
  assert.match(returnBlock, /duplicateCount/);
  assert.doesNotMatch(returnBlock, /Id|Hash|contact|delivery/i);
});
