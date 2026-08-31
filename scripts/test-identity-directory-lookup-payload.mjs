import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  IDENTITY_LOOKUP_PAYLOAD_LIMITS,
  isIdentityLookupAvailabilityPayload,
  isIdentityLookupCreationPayload,
  isIdentityLookupStatusPayload,
} from "../shared/identity-directory-lookup-payload-policy.ts";

const page = readFileSync(
  new URL("../src/pages/admin/IdentityDirectoryLookupPanel.tsx", import.meta.url),
  "utf8"
);
const createRoute = readFileSync(
  new URL("../api/identity/admin/lookups/index.ts", import.meta.url),
  "utf8"
);
const statusRoute = readFileSync(
  new URL("../api/identity/admin/lookups/[id].ts", import.meta.url),
  "utf8"
);

const nowMs = Date.parse("2026-09-01T08:00:00.000Z");
const requestId = "11111111-1111-4111-8111-111111111111";
const receipt = `v1.${"a".repeat(16)}.${"b".repeat(22)}.${"c".repeat(60)}`;
const expiresAt = "2026-09-01T08:05:00.000Z";
const result = {
  firstName: "Camille",
  lastName: "Martin",
  personType: "student",
  classRef: "2GT-TEST",
  serviceCode: null,
  personRef: "TEST-STUDENT-001",
  matchedBy: "academic_email",
  directoryVersionId: "55555555-5555-4555-8555-555555555555",
  directoryActivatedAt: "2026-09-01T07:30:00.000Z",
};

test("accepts one exact and coherent availability payload", () => {
  assert.deepEqual(IDENTITY_LOOKUP_PAYLOAD_LIMITS, {
    ttlSeconds: 300,
    receipt: 2_048,
    receiptLifetimeMs: 330_000,
    name: 200,
  });
  assert.equal(isIdentityLookupAvailabilityPayload({
    available: true,
    configured: true,
    hasActiveDirectory: true,
    ttlSeconds: 300,
  }), true);
  assert.equal(isIdentityLookupAvailabilityPayload({
    available: false,
    configured: true,
    hasActiveDirectory: false,
    ttlSeconds: 300,
  }), true);
});

test("rejects hidden and contradictory availability fields", () => {
  assert.equal(isIdentityLookupAvailabilityPayload({
    available: true,
    configured: false,
    hasActiveDirectory: true,
    ttlSeconds: 300,
  }), false);
  assert.equal(isIdentityLookupAvailabilityPayload({
    available: true,
    configured: true,
    hasActiveDirectory: true,
    ttlSeconds: 300,
    activeDirectoryId: "hidden",
  }), false);
});

test("accepts only a short-lived exact creation receipt", () => {
  const payload = { requestId, status: "queued", receipt, expiresAt };
  assert.equal(isIdentityLookupCreationPayload(payload, nowMs), true);
  assert.equal(isIdentityLookupCreationPayload({ ...payload, actorId: "hidden" }, nowMs), false);
  assert.equal(isIdentityLookupCreationPayload({ ...payload, status: "completed" }, nowMs), false);
  assert.equal(isIdentityLookupCreationPayload({ ...payload, receipt: "invalid" }, nowMs), false);
  assert.equal(isIdentityLookupCreationPayload({
    ...payload,
    expiresAt: "2026-09-01T08:05:31.000Z",
  }, nowMs), false);
  assert.equal(isIdentityLookupCreationPayload({
    ...payload,
    expiresAt: "2026-09-01T07:59:59.000Z",
  }, nowMs), false);
});

test("accepts every minimal non-completed status", () => {
  for (const status of ["queued", "processing", "not_found", "ambiguous", "failed", "expired"]) {
    assert.equal(isIdentityLookupStatusPayload({ requestId, status, expiresAt }, requestId), true);
  }
});

test("accepts one exact completed result", () => {
  assert.equal(isIdentityLookupStatusPayload({
    requestId,
    status: "completed",
    result,
    expiresAt,
  }, requestId), true);
});

test("rejects mismatched ids, malformed dates and result leaks", () => {
  const completed = { requestId, status: "completed", result, expiresAt };
  assert.equal(isIdentityLookupStatusPayload(completed, "22222222-2222-4222-8222-222222222222"), false);
  assert.equal(isIdentityLookupStatusPayload({ ...completed, expiresAt: "2026-02-30T08:00:00.000Z" }), false);
  assert.equal(isIdentityLookupStatusPayload({ ...completed, actorId: "hidden" }), false);
  assert.equal(isIdentityLookupStatusPayload({
    ...completed,
    result: { ...result, personalEmail: "camille@example.test" },
  }), false);
  assert.equal(isIdentityLookupStatusPayload({
    ...completed,
    result: { ...result, directoryVersionId: "not-a-uuid" },
  }), false);
  assert.equal(isIdentityLookupStatusPayload({
    ...completed,
    result: { ...result, classRef: null },
  }), false);
  assert.equal(isIdentityLookupStatusPayload({
    requestId,
    status: "not_found",
    result,
    expiresAt,
  }), false);
});

test("validates all browser responses before updating state", () => {
  const availabilityRead = page.indexOf('apiFetch<unknown>("identity/admin/lookups")');
  const availabilityCheck = page.indexOf("isIdentityLookupAvailabilityPayload(value)", availabilityRead);
  const availabilityWrite = page.indexOf("setAvailability(value)", availabilityCheck);
  assert.ok(availabilityRead !== -1 && availabilityRead < availabilityCheck && availabilityCheck < availabilityWrite);

  const pollRead = page.indexOf("apiFetch<unknown>(`identity/admin/lookups/${request.requestId}`");
  const pollCheck = page.indexOf("isIdentityLookupStatusPayload(next, request.requestId)", pollRead);
  const pollWrite = page.indexOf("setRequest(next)", pollCheck);
  assert.ok(pollRead !== -1 && pollRead < pollCheck && pollCheck < pollWrite);

  const creationRead = page.indexOf('apiFetch<unknown>("identity/admin/lookups", {');
  const creationCheck = page.indexOf("isIdentityLookupCreationPayload(next)", creationRead);
  const receiptWrite = page.indexOf("setReceipt(next.receipt)", creationCheck);
  assert.ok(creationRead !== -1 && creationRead < creationCheck && creationCheck < receiptWrite);
});

test("validates projected API payloads and emits canonical dates", () => {
  const availabilityPayload = createRoute.indexOf("const payload = {", createRoute.indexOf('req.method === "GET"'));
  const availabilityCheck = createRoute.indexOf("isIdentityLookupAvailabilityPayload(payload)", availabilityPayload);
  const creationPayload = createRoute.indexOf("const payload = {", availabilityPayload + 1);
  const creationCheck = createRoute.indexOf("isIdentityLookupCreationPayload(payload", creationPayload);
  assert.ok(availabilityPayload !== -1 && availabilityPayload < availabilityCheck);
  assert.ok(creationPayload !== -1 && creationPayload < creationCheck);
  assert.match(statusRoute, /function verifiedPayload\(/);
  assert.match(statusRoute, /isIdentityLookupStatusPayload\(value, requestId\)/);
  assert.equal(statusRoute.match(/lookup\.expiresAt\.toISOString\(\)/g)?.length, 6);
  assert.doesNotMatch(statusRoute, /return \{ requestId: id, status:/);
});
