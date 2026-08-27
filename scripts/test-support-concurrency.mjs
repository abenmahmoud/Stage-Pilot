import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSupportRevision,
  supportRevisionMatches,
} from "../shared/support-concurrency.ts";

test("accepts a valid ISO support revision", () => {
  const revision = parseSupportRevision("2026-08-27T10:15:30.123Z");
  assert.ok(revision);
  assert.equal(revision.toISOString(), "2026-08-27T10:15:30.123Z");
});

test("rejects missing and malformed revisions", () => {
  assert.equal(parseSupportRevision(undefined), null);
  assert.equal(parseSupportRevision("not-a-date"), null);
  assert.equal(parseSupportRevision("1".repeat(81)), null);
});

test("detects a stale support revision", () => {
  const current = new Date("2026-08-27T10:15:31.000Z");
  assert.equal(supportRevisionMatches(current, "2026-08-27T10:15:31.000Z"), true);
  assert.equal(supportRevisionMatches(current, "2026-08-27T10:15:30.000Z"), false);
});
