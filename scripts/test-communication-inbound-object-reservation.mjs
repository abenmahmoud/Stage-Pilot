import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  COMMUNICATION_INBOUND_CONTENT_LIMITS,
  CommunicationInboundContentPolicyError,
  assertCommunicationInboundObjectAggregate,
  communicationInboundObjectStoragePath,
  parseCommunicationInboundObjectDescriptors,
  parseCommunicationInboundQuarantineConfirmation,
} from "../shared/communication-inbound-content-policy.ts";

const persistence = readFileSync(new URL(
  "../api/_shared/communication-inbound-object-persistence.ts",
  import.meta.url
), "utf8");
const route = readFileSync(new URL(
  "../api/webhooks/brevo/communications-inbound.ts",
  import.meta.url
), "utf8");
const recipe = readFileSync(new URL(
  "../supabase/tests/communication_inbound_object_reservation_security.test.sql",
  import.meta.url
), "utf8");

const ids = {
  institutionId: "00000000-0000-4000-8000-000000009101",
  inboundId: "00000000-0000-4000-8000-000000009110",
  objectId: "00000000-0000-4000-8000-000000009120",
};
const descriptor = {
  objectKind: "attachment",
  objectRefHash: "a".repeat(64),
  mediaType: "application/pdf",
  sizeBytes: 4096,
};

test("accepts only bounded opaque object descriptors", () => {
  assert.deepEqual(parseCommunicationInboundObjectDescriptors([descriptor]), [descriptor]);
  assert.deepEqual(COMMUNICATION_INBOUND_CONTENT_LIMITS, {
    objects: 21,
    objectBytes: 10 * 1024 * 1024,
    totalBytes: 26 * 1024 * 1024,
  });
  for (const invalid of [
    [],
    Array.from({ length: 22 }, (_, index) => ({
      ...descriptor,
      objectRefHash: index.toString(16).padStart(64, "0"),
    })),
    [{ ...descriptor, originalName: "secret.pdf" }],
    [{ ...descriptor, downloadToken: "must-not-cross-policy" }],
    [{ ...descriptor, objectKind: "unknown" }],
    [{ ...descriptor, objectRefHash: "weak" }],
    [{ ...descriptor, mediaType: "application/octet-stream" }],
    [{ ...descriptor, sizeBytes: 4096.5 }],
    [{ ...descriptor, sizeBytes: 0 }],
    [{ ...descriptor, sizeBytes: COMMUNICATION_INBOUND_CONTENT_LIMITS.objectBytes + 1 }],
    [descriptor, descriptor],
    Array.from({ length: 3 }, (_, index) => ({
      ...descriptor,
      objectRefHash: String(index + 1).repeat(64),
      sizeBytes: 9 * 1024 * 1024,
    })),
  ]) {
    assert.throws(
      () => parseCommunicationInboundObjectDescriptors(invalid),
      CommunicationInboundContentPolicyError
    );
  }
});

test("binds quarantine confirmation to exact storage metadata", () => {
  const confirmation = {
    ...ids,
    mediaType: "application/pdf",
    sizeBytes: 4096,
    sha256: "b".repeat(64),
  };
  assert.deepEqual(parseCommunicationInboundQuarantineConfirmation(confirmation), confirmation);
  for (const invalid of [
    { ...confirmation, storagePath: "hidden" },
    { ...confirmation, mediaType: "application/octet-stream" },
    { ...confirmation, sizeBytes: 4096.5 },
    { ...confirmation, sha256: "weak" },
    { ...confirmation, objectId: "not-a-uuid" },
  ]) {
    assert.throws(
      () => parseCommunicationInboundQuarantineConfirmation(invalid),
      CommunicationInboundContentPolicyError
    );
  }
});

test("enforces aggregate limits across repeated reservations", () => {
  const existing = Array.from({ length: 20 }, (_, index) => ({
    ...descriptor,
    objectRefHash: index.toString(16).padStart(64, "0"),
    sizeBytes: 1024,
  }));
  const replay = { ...existing[0] };
  assert.doesNotThrow(() => assertCommunicationInboundObjectAggregate(existing, [replay]));
  assert.throws(
    () => assertCommunicationInboundObjectAggregate(existing, [
      { ...descriptor, objectRefHash: "f".repeat(64) },
      { ...descriptor, objectRefHash: "e".repeat(64) },
    ]),
    CommunicationInboundContentPolicyError
  );
  assert.throws(
    () => assertCommunicationInboundObjectAggregate([
      { ...descriptor, sizeBytes: 9 * 1024 * 1024 },
      { ...descriptor, objectRefHash: "b".repeat(64), sizeBytes: 9 * 1024 * 1024 },
    ], [{ ...descriptor, objectRefHash: "c".repeat(64), sizeBytes: 9 * 1024 * 1024 }]),
    CommunicationInboundContentPolicyError
  );
  assert.throws(
    () => assertCommunicationInboundObjectAggregate(existing, [{
      ...replay,
      mediaType: "image/png",
    }]),
    CommunicationInboundContentPolicyError
  );
});

test("derives a private path without provider or contact data", () => {
  const path = communicationInboundObjectStoragePath(
    ids.institutionId,
    ids.inboundId,
    ids.objectId
  );
  assert.equal(
    path,
    `institutions/${ids.institutionId}/inbound/${ids.inboundId}/objects/${ids.objectId}`
  );
  assert.doesNotMatch(path, /@|download|token|filename|subject/i);
});

test("persists reservation and queues quarantine atomically", () => {
  assert.match(persistence, /parseCommunicationInboundObjectDescriptors/);
  assert.match(persistence, /\.for\("update"\)/);
  assert.match(persistence, /assertCommunicationInboundObjectAggregate/);
  assert.match(persistence, /\.insert\(communicationInboundObjects\)/);
  assert.match(persistence, /\.onConflictDoNothing\(\)/);
  assert.match(persistence, /eventType: "object\.reserved"/);
  assert.match(persistence, /eq\(communicationInboundObjects\.status, "reserved"\)/);
  assert.match(persistence, /eventType: "object\.quarantined"/);
  assert.match(persistence, /select pgmq\.send\(/);
  assert.match(persistence, /'scan_communication_inbound_object'/);
  assert.match(persistence, /status: "quarantine"/);
  assert.doesNotMatch(
    persistence,
    /DownloadToken|downloadToken|originalName|sender|recipient|subject|bodyText|emailAddress/
  );
});

test("keeps the live webhook disconnected from content persistence", () => {
  assert.doesNotMatch(route, /communication-inbound-object-persistence/);
  assert.doesNotMatch(route, /reserveCommunicationInboundObjects/);
  assert.doesNotMatch(route, /confirmCommunicationInboundObjectQuarantine/);
});

test("proves replay, rollback, minimal queue payload and zero residue", () => {
  assert.match(recipe, /^begin;/);
  assert.match(recipe, /on conflict do nothing/);
  assert.match(recipe, /forced_inbound_quarantine_rollback/);
  assert.match(recipe, /scan_communication_inbound_object/);
  assert.match(recipe, /download_token/);
  assert.match(recipe, /message \?\| array/);
  assert.match(recipe, /rollback;[\s\S]*institution_residue[\s\S]*queue_residue/);
  assert.doesNotMatch(recipe, /@ac-creteil\.fr|lycee-blaise-cendrars-sevran\.fr/);
});
