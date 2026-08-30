import assert from "node:assert/strict";
import test from "node:test";
import {
  communicationDeliveryWebhookEnabled,
  parseCommunicationBrevoDeliveryEvent,
  verifyCommunicationDeliveryBearerHeader,
} from "../shared/communication-delivery-event.ts";

const secret = "delivery-event-test-secret-with-32-chars";
const now = new Date("2026-08-30T08:00:00.000Z");
const base = {
  event: "delivered",
  email: "recipient@example.invalid",
  subject: "Information privée fictive",
  reason: "Texte fournisseur à ne pas conserver",
  sending_ip: "192.0.2.10",
  tags: ["internal-test"],
  "message-id": "<outbound-001@example.invalid>",
  ts_epoch: now.getTime(),
};

test("returns only a bounded delivery receipt without recipient or provider prose", () => {
  const result = parseCommunicationBrevoDeliveryEvent(base, secret, now);
  assert.deepEqual(Object.keys(result).sort(), [
    "eventHash",
    "occurredAt",
    "provider",
    "providerMessageRef",
    "status",
  ]);
  assert.deepEqual(result, {
    provider: "brevo_transactional",
    providerMessageRef: result.providerMessageRef,
    eventHash: result.eventHash,
    status: "delivered",
    occurredAt: now.toISOString(),
  });
  assert.match(result.providerMessageRef, /^[a-f0-9]{64}$/);
  assert.match(result.eventHash, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(result), /recipient|subject|fournisseur|192\.0\.2\.10/i);
});

test("maps only the five governed delivery states", () => {
  const cases = {
    delivered: "delivered",
    deferred: "deferred",
    soft_bounce: "deferred",
    softBounce: "deferred",
    hard_bounce: "rejected",
    hardBounce: "rejected",
    blocked: "rejected",
    invalid_email: "rejected",
    invalid: "rejected",
    error: "rejected",
    spam: "spam",
    unsubscribed: "unsubscribed",
  };
  for (const [event, status] of Object.entries(cases)) {
    assert.equal(parseCommunicationBrevoDeliveryEvent({ ...base, event }, secret, now).status, status);
  }
  for (const event of ["sent", "opened", "click", "uniqueOpened", "request"]) {
    assert.throws(() => parseCommunicationBrevoDeliveryEvent({ ...base, event }, secret, now), /event_unsupported/);
  }
});

test("builds stable event replay keys separated by status and timestamp", () => {
  const first = parseCommunicationBrevoDeliveryEvent(base, secret, now);
  assert.equal(first.eventHash, parseCommunicationBrevoDeliveryEvent({ ...base }, secret, now).eventHash);
  assert.notEqual(first.eventHash, parseCommunicationBrevoDeliveryEvent({ ...base, event: "spam" }, secret, now).eventHash);
  assert.notEqual(first.eventHash, parseCommunicationBrevoDeliveryEvent({ ...base, ts_epoch: now.getTime() - 1 }, secret, now).eventHash);
});

test("rejects weak secrets, missing message ids and timestamps outside the replay window", () => {
  assert.throws(() => parseCommunicationBrevoDeliveryEvent(base, "weak", now), /hashing_secret_invalid/);
  assert.throws(() => parseCommunicationBrevoDeliveryEvent({ ...base, "message-id": undefined }, secret, now), /provider_message_id_missing/);
  assert.throws(() => parseCommunicationBrevoDeliveryEvent({ ...base, ts_epoch: String(now.getTime()) }, secret, now), /event_time_invalid/);
  assert.throws(() => parseCommunicationBrevoDeliveryEvent({ ...base, ts_epoch: now.getTime() - 31 * 86400000 }, secret, now), /event_time_out_of_range/);
  assert.throws(() => parseCommunicationBrevoDeliveryEvent({ ...base, ts_epoch: now.getTime() + 6 * 60000 }, secret, now), /event_time_out_of_range/);
});

test("requires one exact strong Bearer token", () => {
  assert.equal(verifyCommunicationDeliveryBearerHeader(`Bearer ${secret}`, secret), true);
  assert.equal(verifyCommunicationDeliveryBearerHeader(`Bearer ${secret}x`, secret), false);
  assert.equal(verifyCommunicationDeliveryBearerHeader([`Bearer ${secret}`], secret), false);
  assert.equal(verifyCommunicationDeliveryBearerHeader(`Bearer ${secret}`, "weak"), false);
});

test("keeps the delivery webhook closed unless its exact flag is enabled", () => {
  assert.equal(communicationDeliveryWebhookEnabled({}), false);
  assert.equal(communicationDeliveryWebhookEnabled({ COMMUNICATION_DELIVERY_WEBHOOK_ENABLED: "TRUE" }), false);
  assert.equal(communicationDeliveryWebhookEnabled({ COMMUNICATION_DELIVERY_WEBHOOK_ENABLED: "true" }), true);
});
