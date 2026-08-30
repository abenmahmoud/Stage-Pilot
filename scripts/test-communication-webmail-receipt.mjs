import assert from "node:assert/strict";
import test from "node:test";
import {
  createCommunicationWebmailDeliveryToken,
  verifyCommunicationWebmailDeliveryToken,
} from "../shared/communication-webmail-delivery.ts";
import {
  createCommunicationWebmailDeliveryReceiptToken,
  verifyCommunicationWebmailDeliveryReceiptToken,
} from "../shared/communication-webmail-receipt.ts";

const commandSecret = "webmail-command-test-secret-with-32-characters";
const receiptSecret = "webmail-receipt-test-secret-with-32-characters";
const providerHashingSecret = "provider-hashing-test-secret-with-32-characters";
const providerMessageId = "<20260830.1234567890@smtp-relay.example.invalid>";
const now = new Date("2026-08-30T13:00:00.000Z");
const institutionId = "11dc4154-9fe3-4624-93b7-34e7feb944b0";
const commandInput = {
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

function command(overrides = {}) {
  const input = { ...commandInput, ...overrides };
  const token = createCommunicationWebmailDeliveryToken({
    command: input,
    institutionId: input.institutionId,
    secret: commandSecret,
    now,
  });
  const verified = verifyCommunicationWebmailDeliveryToken({
    token,
    institutionId: input.institutionId,
    secret: commandSecret,
    now,
  });
  assert.ok(verified);
  return verified;
}

function receipt(commandValue = command(), overrides = {}) {
  return createCommunicationWebmailDeliveryReceiptToken({
    command: commandValue,
    outcome: "accepted",
    providerMessageId,
    receiptSecret,
    providerHashingSecret,
    acceptedAt: now,
    now,
    ...overrides,
  });
}

test("accepts one signed receipt bound to the exact command", () => {
  const expected = command();
  const verified = verifyCommunicationWebmailDeliveryReceiptToken({
    token: receipt(expected),
    command: expected,
    receiptSecret,
    now,
  });
  assert.ok(verified);
  assert.equal(verified.outcome, "accepted");
  assert.match(verified.providerMessageRef, /^[a-f0-9]{64}$/);
  assert.match(verified.receiptHash, /^[a-f0-9]{64}$/);
});

test("returns the same provider reference for an idempotent duplicate", () => {
  const expected = command();
  const first = verifyCommunicationWebmailDeliveryReceiptToken({
    token: receipt(expected),
    command: expected,
    receiptSecret,
    now,
  });
  const duplicate = verifyCommunicationWebmailDeliveryReceiptToken({
    token: receipt(expected, { outcome: "duplicate" }),
    command: expected,
    receiptSecret,
    now,
  });
  assert.ok(first && duplicate);
  assert.equal(duplicate.outcome, "duplicate");
  assert.equal(duplicate.providerMessageRef, first.providerMessageRef);
  assert.equal(duplicate.idempotencyKeyHash, first.idempotencyKeyHash);
});

test("never exposes the raw provider id or recipient information", () => {
  const expected = command();
  const token = receipt(expected);
  const verified = verifyCommunicationWebmailDeliveryReceiptToken({
    token,
    command: expected,
    receiptSecret,
    now,
  });
  assert.ok(verified);
  assert.equal(token.includes(providerMessageId), false);
  assert.doesNotMatch(JSON.stringify(verified), /@|recipient|contactRef|firstName|lastName|providerMessageId|apiKey/i);
});

test("rejects a receipt replayed for another delivery or command", () => {
  const expected = command();
  const token = receipt(expected);
  const otherDelivery = command({ deliveryId: "b44c1eae-602b-4749-9120-208e474eef96" });
  const otherContent = command({ bodyText: "Une autre version validée." });
  assert.equal(verifyCommunicationWebmailDeliveryReceiptToken({ token, command: otherDelivery, receiptSecret, now }), null);
  assert.equal(verifyCommunicationWebmailDeliveryReceiptToken({ token, command: otherContent, receiptSecret, now }), null);
});

test("rejects tampering, expiry and the wrong receipt key", () => {
  const expected = command();
  const token = receipt(expected);
  assert.equal(verifyCommunicationWebmailDeliveryReceiptToken({
    token: `${token}x`,
    command: expected,
    receiptSecret,
    now,
  }), null);
  assert.equal(verifyCommunicationWebmailDeliveryReceiptToken({
    token,
    command: expected,
    receiptSecret,
    now: new Date(now.getTime() + 6 * 60 * 1000),
  }), null);
  assert.equal(verifyCommunicationWebmailDeliveryReceiptToken({
    token,
    command: expected,
    receiptSecret: "another-receipt-test-secret-with-32-characters",
    now,
  }), null);
});

test("requires separate strong receipt and provider hashing keys", () => {
  const expected = command();
  assert.throws(() => receipt(expected, { receiptSecret: "weak" }), /invalide/);
  assert.throws(() => receipt(expected, {
    receiptSecret: providerHashingSecret,
    providerHashingSecret,
  }), /invalide/);
});

test("simulates 200 bounded receipts without addresses or provider identifiers", () => {
  const receipts = Array.from({ length: 200 }, (_, index) => {
    const suffix = String(index + 1).padStart(12, "0");
    const expected = command({
      deliveryId: `90890f16-f354-484d-88e9-${suffix}`,
      contactRef: `contact:${String(index + 1).padStart(8, "0")}`,
      idempotencyKeyHash: index.toString(16).padStart(64, "0"),
    });
    const token = receipt(expected, { providerMessageId: `<message-${index + 1}@example.invalid>` });
    return verifyCommunicationWebmailDeliveryReceiptToken({ token, command: expected, receiptSecret, now });
  });
  assert.equal(receipts.every(Boolean), true);
  assert.equal(new Set(receipts.map((entry) => entry.providerMessageRef)).size, 200);
  assert.equal(receipts.every((entry) => !JSON.stringify(entry).includes("@")), true);
});
