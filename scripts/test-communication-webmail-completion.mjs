import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createCommunicationWebmailDeliveryToken,
  verifyCommunicationWebmailDeliveryToken,
} from "../shared/communication-webmail-delivery.ts";
import {
  createCommunicationWebmailDeliveryReceiptToken,
  verifyCommunicationWebmailDeliveryReceiptToken,
} from "../shared/communication-webmail-receipt.ts";
import { planCommunicationWebmailCompletion } from "../shared/communication-webmail-completion.ts";

const root = new URL("../", import.meta.url);
const migration = readFileSync(new URL("supabase/migrations/20260830120000_add_communication_webmail_handshake.sql", root), "utf8");
const schema = readFileSync(new URL("db/schema.ts", root), "utf8");
const now = new Date("2026-08-30T14:00:00.000Z");
const institutionId = "11dc4154-9fe3-4624-93b7-34e7feb944b0";
const deliveryId = "90890f16-f354-484d-88e9-c75c37c64180";
const commandSecret = "webmail-command-test-secret-with-32-characters";
const receiptSecret = "webmail-receipt-test-secret-with-32-characters";
const providerHashingSecret = "provider-hashing-test-secret-with-32-characters";

function artifacts(outcome = "accepted") {
  const token = createCommunicationWebmailDeliveryToken({
    institutionId,
    secret: commandSecret,
    now,
    command: {
      v: 1,
      institutionId,
      deliveryId,
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
    },
  });
  const command = verifyCommunicationWebmailDeliveryToken({ token, institutionId, secret: commandSecret, now });
  assert.ok(command);
  const receiptToken = createCommunicationWebmailDeliveryReceiptToken({
    command,
    outcome,
    providerMessageId: "<outbound-message@example.invalid>",
    receiptSecret,
    providerHashingSecret,
    acceptedAt: now,
    now,
  });
  const receipt = verifyCommunicationWebmailDeliveryReceiptToken({ token: receiptToken, command, receiptSecret, now });
  assert.ok(receipt);
  return { command, receipt };
}

function state(command, overrides = {}) {
  return {
    delivery: {
      institutionId,
      deliveryId,
      status: "queued",
      resolutionHash: command.resolutionHash,
      commandHash: command.commandHash,
      idempotencyKeyHash: command.idempotencyKeyHash,
      providerMessageRef: null,
      webmailReceiptHash: null,
      sentAt: null,
      ...overrides.delivery,
    },
    job: {
      deliveryId,
      jobType: "send_delivery",
      status: "running",
      ...overrides.job,
    },
  };
}

test("turns an exact accepted receipt into one atomic completion decision", () => {
  const { command, receipt } = artifacts();
  const decision = planCommunicationWebmailCompletion({ state: state(command), command, receipt });
  assert.equal(decision.applyDelivery, true);
  assert.equal(decision.completeJob, true);
  assert.equal(decision.nextDeliveryStatus, "sent");
  assert.equal(decision.providerMessageRef, receipt.providerMessageRef);
  assert.equal(decision.webmailReceiptHash, receipt.receiptHash);
});

test("recovers a network timeout from an idempotent duplicate without a second identity", () => {
  const { command, receipt } = artifacts("duplicate");
  const decision = planCommunicationWebmailCompletion({
    state: state(command, { delivery: { status: "error" } }),
    command,
    receipt,
  });
  assert.equal(decision.applyDelivery, true);
  assert.equal(decision.duplicate, true);
  assert.equal(decision.eventType, "delivery.send_duplicate");
});

test("preserves an advanced delivery when the same provider receipt is replayed", () => {
  const { command, receipt } = artifacts("duplicate");
  const current = state(command, { delivery: {
    status: "delivered",
    providerMessageRef: receipt.providerMessageRef,
    webmailReceiptHash: "c".repeat(64),
    sentAt: receipt.acceptedAt,
  } });
  const decision = planCommunicationWebmailCompletion({ state: current, command, receipt });
  assert.equal(decision.applyDelivery, false);
  assert.equal(decision.nextDeliveryStatus, "delivered");
  assert.equal(decision.webmailReceiptHash, "c".repeat(64));
});

test("rejects substituted command state, provider reference and non-running jobs", () => {
  const { command, receipt } = artifacts();
  assert.throws(() => planCommunicationWebmailCompletion({
    state: state(command, { delivery: { commandHash: "d".repeat(64) } }), command, receipt,
  }), /command_state_mismatch/);
  assert.throws(() => planCommunicationWebmailCompletion({
    state: state(command, { delivery: {
      status: "sent",
      providerMessageRef: "e".repeat(64),
      webmailReceiptHash: receipt.receiptHash,
      sentAt: receipt.acceptedAt,
    } }), command, receipt,
  }), /post_send_state_mismatch/);
  assert.throws(() => planCommunicationWebmailCompletion({
    state: state(command, { job: { status: "completed" } }), command, receipt,
  }), /job_not_running/);
});

test("does not complete prepared or cancelled deliveries", () => {
  const { command, receipt } = artifacts();
  for (const status of ["prepared", "cancelled"]) {
    assert.throws(() => planCommunicationWebmailCompletion({
      state: state(command, { delivery: { status } }), command, receipt,
    }), /delivery_not_sendable/);
  }
});

test("persists only HMAC handshake fields with scoped unique indexes", () => {
  assert.match(migration, /add column resolution_hash text/);
  assert.match(migration, /add column command_hash text/);
  assert.match(migration, /add column webmail_receipt_hash text/);
  assert.match(migration, /communication_deliveries_scope_command_uidx[\s\S]*institution_id, command_hash/);
  assert.match(migration, /communication_deliveries_scope_webmail_receipt_uidx[\s\S]*institution_id, webmail_receipt_hash/);
  assert.match(migration, /status not in \('sent'[\s\S]*provider_message_ref is not null[\s\S]*sent_at is not null/);
  assert.doesNotMatch(migration, /recipient_email|first_name|last_name|provider_message_id/);
});

test("keeps handshake hashes immutable after their first assignment", () => {
  assert.match(migration, /old\.resolution_hash is not null and new\.resolution_hash is distinct from old\.resolution_hash/);
  assert.match(migration, /old\.command_hash is not null and new\.command_hash is distinct from old\.command_hash/);
  assert.match(migration, /old\.webmail_receipt_hash is not null and new\.webmail_receipt_hash is distinct from old\.webmail_receipt_hash/);
});

test("mirrors the three opaque fields and indexes in the Drizzle schema", () => {
  assert.match(schema, /resolutionHash: text\("resolution_hash"\)/);
  assert.match(schema, /commandHash: text\("command_hash"\)/);
  assert.match(schema, /webmailReceiptHash: text\("webmail_receipt_hash"\)/);
  assert.match(schema, /communication_deliveries_scope_command_uidx/);
  assert.match(schema, /communication_deliveries_scope_webmail_receipt_uidx/);
});
