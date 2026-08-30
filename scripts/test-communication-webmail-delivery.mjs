import assert from "node:assert/strict";
import test from "node:test";
import {
  createCommunicationWebmailDeliveryToken,
  verifyCommunicationWebmailDeliveryToken,
} from "../shared/communication-webmail-delivery.ts";

const secret = "webmail-delivery-test-secret-with-32-characters";
const now = new Date("2026-08-30T12:00:00.000Z");
const institutionId = "11dc4154-9fe3-4624-93b7-34e7feb944b0";
const base = {
  v: 1,
  institutionId,
  deliveryId: "90890f16-f354-484d-88e9-c75c37c64180",
  communicationId: "2423e6c2-bf87-43df-8149-c6ef6f168622",
  versionId: "b8f4c471-105c-456b-ab22-2e46dfb90b3c",
  version: 2,
  contactRef: "contact:00000001",
  resolutionHash: "a".repeat(64),
  idempotencyKeyHash: "b".repeat(64),
  visibility: "internal",
  canonicalPath: "/informations/rentree-professeurs",
  linkMode: "authenticated",
  subject: "Informations de rentrée",
  preheader: "Les informations utiles sont disponibles.",
  bodyText: "Bonjour,\n\nConsultez la version à jour sur le portail du lycée.",
  replyRef: "reply:communication-0001",
  issuedAt: now.toISOString(),
  expiresAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
};

function create(command = base, scope = institutionId) {
  return createCommunicationWebmailDeliveryToken({ command, institutionId: scope, secret, now });
}

function reasonIs(reason) {
  return (error) => error?.reason === reason;
}

test("signs and verifies one opaque individual delivery command", () => {
  const verified = verifyCommunicationWebmailDeliveryToken({
    token: create(),
    institutionId,
    secret,
    now,
  });
  assert.ok(verified);
  assert.equal(verified.contactRef, base.contactRef);
  assert.equal(verified.linkMode, "authenticated");
  assert.match(verified.commandHash, /^[a-f0-9]{64}$/);
});

test("simulates 200 separate commands without constructing a recipient list", () => {
  const tokens = Array.from({ length: 200 }, (_, index) => {
    const suffix = String(index + 1).padStart(8, "0");
    return create({
      ...base,
      deliveryId: `90890f16-f354-484d-88e9-${suffix.padStart(12, "0")}`,
      contactRef: `contact:${suffix}`,
      idempotencyKeyHash: index.toString(16).padStart(64, "0"),
    });
  });
  assert.equal(tokens.length, 200);
  assert.equal(new Set(tokens).size, 200);
  assert.equal(tokens.every((entry) => !entry.includes("@")), true);
  assert.equal(tokens.every((entry) => {
    const verified = verifyCommunicationWebmailDeliveryToken({ token: entry, institutionId, secret, now });
    return verified && !Array.isArray(verified.contactRef);
  }), true);
});

test("requires authenticated links for internal or targeted content", () => {
  assert.throws(() => create({ ...base, linkMode: "public" }), reasonIs("link_mode_invalid"));
  const publicToken = create({ ...base, visibility: "public", linkMode: "public" });
  assert.equal(verifyCommunicationWebmailDeliveryToken({ token: publicToken, institutionId, secret, now })?.linkMode, "public");
});

test("rejects absolute URLs, query tokens and locating contact values", () => {
  assert.throws(() => create({ ...base, canonicalPath: "https://example.invalid/informations/x" }), reasonIs("canonical_path_invalid"));
  assert.throws(() => create({ ...base, canonicalPath: "/informations/rentree?token=secret" }), reasonIs("canonical_path_invalid"));
  assert.throws(() => create({ ...base, contactRef: "person@example.invalid" }), reasonIs("contact_ref_invalid"));
});

test("rejects batches, recipient fields and unbounded content", () => {
  assert.throws(() => create({ ...base, contacts: [base.contactRef] }), reasonIs("unknown_field"));
  assert.throws(() => create({ ...base, email: "person@example.invalid" }), reasonIs("unknown_field"));
  assert.throws(() => create({ ...base, subject: "x".repeat(181) }), reasonIs("subject_invalid"));
  assert.throws(() => create({ ...base, bodyText: "x".repeat(20_001) }), reasonIs("body_invalid"));
});

test("rejects cross-scope, expiry, tampering and weak secrets", () => {
  const signed = create();
  assert.equal(verifyCommunicationWebmailDeliveryToken({
    token: signed,
    institutionId: "4b6909c8-ef44-4172-9028-2dc9a2e91212",
    secret,
    now,
  }), null);
  assert.equal(verifyCommunicationWebmailDeliveryToken({
    token: signed,
    institutionId,
    secret,
    now: new Date(now.getTime() + 6 * 60 * 1000),
  }), null);
  assert.equal(verifyCommunicationWebmailDeliveryToken({
    token: `${signed}x`,
    institutionId,
    secret,
    now,
  }), null);
  assert.throws(() => createCommunicationWebmailDeliveryToken({ command: base, institutionId, secret: "weak", now }), reasonIs("secret_invalid"));
});

test("keeps the decoded command free of addresses, names and provider credentials", () => {
  const verified = verifyCommunicationWebmailDeliveryToken({ token: create(), institutionId, secret, now });
  assert.ok(verified);
  assert.doesNotMatch(JSON.stringify(verified), /@|recipientEmail|firstName|lastName|apiKey|providerMessageId/i);
});
