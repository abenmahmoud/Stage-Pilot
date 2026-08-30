import assert from "node:assert/strict";
import test from "node:test";
import {
  createCommunicationRecipientResolutionToken,
  prepareCommunicationDeliveryRows,
  verifyCommunicationRecipientResolutionToken,
} from "../shared/communication-recipient-resolution.ts";

const secret = "recipient-resolution-test-secret-32-characters";
const idempotencySecret = "delivery-idempotency-test-secret-32-characters";
const now = new Date("2026-08-30T11:00:00.000Z");
const expected = {
  institutionId: "cb0fef11-fb59-45fa-ae96-ae8579f7d7d3",
  communicationId: "255b58ae-7443-4dad-a3dd-135cb0c2ef8f",
  versionId: "23f8c1a0-f3df-4e0f-a183-a14ed3a49d42",
  version: 3,
  snapshotHash: "a".repeat(64),
  groupRefs: ["group:personnels", "group:professeurs"],
};
const contacts = Array.from({ length: 200 }, (_, index) => ({
  contactRef: `contact:${String(index + 1).padStart(8, "0")}`,
  eligibility: "active_validated_email",
}));
const resolution = {
  v: 1,
  ...expected,
  resolutionId: "f993e296-521c-4761-82fa-71b58eb1961e",
  generatedAt: now.toISOString(),
  expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
  pageIndex: 0,
  pageCount: 1,
  contacts,
};

function reasonIs(reason) {
  return (error) => error?.reason === reason;
}

function token(value = resolution, context = expected, signingSecret = secret) {
  return createCommunicationRecipientResolutionToken({
    resolution: value,
    expected: context,
    secret: signingSecret,
    now,
  });
}

test("verifies 200 opaque eligible recipients and prepares one row per contact", () => {
  const verified = verifyCommunicationRecipientResolutionToken({
    token: token(),
    expected,
    secret,
    now,
  });
  assert.ok(verified);
  const rows = prepareCommunicationDeliveryRows(verified, idempotencySecret);
  assert.equal(rows.length, 200);
  assert.equal(new Set(rows.map((row) => row.contactRef)).size, 200);
  assert.equal(new Set(rows.map((row) => row.idempotencyKeyHash)).size, 200);
  assert.equal(rows.every((row) => row.status === "prepared" && row.channel === "email"), true);
});

test("produces stable delivery idempotency keys across a signed replay", () => {
  const signed = token();
  const first = verifyCommunicationRecipientResolutionToken({ token: signed, expected, secret, now });
  const second = verifyCommunicationRecipientResolutionToken({ token: signed, expected, secret, now });
  assert.ok(first && second);
  assert.deepEqual(
    prepareCommunicationDeliveryRows(first, idempotencySecret),
    prepareCommunicationDeliveryRows(second, idempotencySecret)
  );
});

test("rejects duplicate, inactive, locating and unknown contact fields", () => {
  assert.throws(() => token({ ...resolution, contacts: [contacts[0], contacts[0]] }), reasonIs("contact_ref_duplicate"));
  assert.throws(() => token({ ...resolution, contacts: [{ ...contacts[0], eligibility: "inactive" }] }), reasonIs("contact_not_eligible"));
  assert.throws(() => token({ ...resolution, contacts: [{ ...contacts[0], contactRef: "person@example.invalid" }] }), reasonIs("contact_ref_invalid"));
  assert.throws(() => token({ ...resolution, contacts: [{ ...contacts[0], email: "person@example.invalid" }] }), reasonIs("unknown_field"));
});

test("rejects a cross-scope, expired, future or tampered resolution", () => {
  const signed = token();
  assert.equal(verifyCommunicationRecipientResolutionToken({
    token: signed,
    expected: { ...expected, version: 4 },
    secret,
    now,
  }), null);
  assert.equal(verifyCommunicationRecipientResolutionToken({
    token: signed,
    expected: { ...expected, snapshotHash: "b".repeat(64) },
    secret,
    now,
  }), null);
  assert.equal(verifyCommunicationRecipientResolutionToken({
    token: signed,
    expected,
    secret,
    now: new Date(now.getTime() + 11 * 60 * 1000),
  }), null);
  assert.equal(verifyCommunicationRecipientResolutionToken({
    token: `${signed.slice(0, -1)}x`,
    expected,
    secret,
    now,
  }), null);
  assert.throws(() => token({ ...resolution, generatedAt: new Date(now.getTime() + 60_000).toISOString() }), reasonIs("resolution_from_future"));
});

test("binds the exact approved groups and page range", () => {
  assert.throws(() => token({ ...resolution, groupRefs: ["group:personnels"] }), reasonIs("scope_mismatch"));
  assert.throws(() => token({ ...resolution, pageIndex: 1, pageCount: 1 }), reasonIs("page_range_invalid"));
  assert.throws(() => token({ ...resolution, contacts: Array.from({ length: 501 }, (_, index) => ({
    contactRef: `contact:${String(index + 1).padStart(8, "0")}`,
    eligibility: "active_validated_email",
  })) }), reasonIs("contacts_invalid"));
});

test("keeps prepared rows free of addresses, names and signed tokens", () => {
  const verified = verifyCommunicationRecipientResolutionToken({ token: token(), expected, secret, now });
  assert.ok(verified);
  const serialized = JSON.stringify(prepareCommunicationDeliveryRows(verified, idempotencySecret));
  assert.doesNotMatch(serialized, /@|example|firstName|lastName|snapshotHash|resolutionHash/i);
  assert.throws(() => prepareCommunicationDeliveryRows(verified, "weak"), reasonIs("idempotency_secret_invalid"));
});
