import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  deriveSupportDuplicateReview,
  supportDuplicateWindowStart,
} from "../shared/support-duplicate-policy.ts";

const creationRoute = readFileSync(new URL("../api/support/requests/index.ts", import.meta.url), "utf8");
const publicDetailRoute = readFileSync(new URL("../api/support/requests/[code].ts", import.meta.url), "utf8");
const agentDetailRoute = readFileSync(new URL("../api/support/agent/requests/[code].ts", import.meta.url), "utf8");
const agentQueueRoute = readFileSync(new URL("../api/support/agent/requests/index.ts", import.meta.url), "utf8");
const duplicatePolicy = readFileSync(new URL("../shared/support-duplicate-policy.ts", import.meta.url), "utf8");

const candidateRequestId = "123e4567-e89b-12d3-a456-426614174000";

test("uses a bounded seven-day detection window", () => {
  const now = new Date("2026-08-29T12:00:00.000Z");
  assert.equal(supportDuplicateWindowStart(now).toISOString(), "2026-08-22T12:00:00.000Z");
});

test("derives pending, confirmed and dismissed human decisions", () => {
  const suspected = {
    eventType: "request.duplicate_suspected",
    toValue: { candidateRequestId, reason: "same_contact_category_7_days" },
    createdAt: "2026-08-29T10:00:00.000Z",
  };
  assert.equal(deriveSupportDuplicateReview([suspected])?.status, "pending");
  assert.equal(deriveSupportDuplicateReview([
    suspected,
    { ...suspected, eventType: "request.duplicate_confirmed", createdAt: "2026-08-29T10:05:00.000Z" },
  ])?.status, "confirmed");
  assert.equal(deriveSupportDuplicateReview([
    suspected,
    { ...suspected, eventType: "request.duplicate_dismissed", createdAt: "2026-08-29T10:06:00.000Z" },
  ])?.status, "dismissed");
});

test("ignores malformed audit payloads", () => {
  assert.equal(deriveSupportDuplicateReview([{
    eventType: "request.duplicate_suspected",
    toValue: { candidateRequestId: "not-a-uuid" },
    createdAt: "2026-08-29T10:00:00.000Z",
  }]), null);
});

test("detects from hashed contacts and never exposes duplicate metadata publicly", () => {
  assert.match(creationRoute, /supportContacts\.normalizedHash, contactHashes/);
  assert.match(creationRoute, /supportRequests\.category, input\.category/);
  assert.match(creationRoute, /supportDuplicateWindowStart\(\)/);
  assert.match(agentDetailRoute, /SUPPORT_DUPLICATE_EVENT_TYPES/);
  assert.match(agentDetailRoute, /assertSupportRequestAccess\(access, candidate\.assignedTeam\)/);
  assert.match(agentQueueRoute, /duplicatePending: hasPendingDuplicateReview\(\)/);
  assert.match(agentQueueRoute, /duplicateOnly/);
  assert.match(duplicatePolicy, /request\.duplicate_suspected/);
  assert.match(duplicatePolicy, /request\.duplicate_confirmed/);
  assert.match(duplicatePolicy, /request\.duplicate_dismissed/);
  assert.doesNotMatch(publicDetailRoute, /duplicateReview|duplicate_suspected|candidatePublicCode/);
});
