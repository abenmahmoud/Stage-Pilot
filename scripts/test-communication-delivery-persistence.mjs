import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { planCommunicationDeliveryTransition } from "../shared/communication-delivery-transition.ts";

test("advances ordinary delivery events and preserves the delivered timestamp", () => {
  assert.deepEqual(planCommunicationDeliveryTransition("sent", "delivered"), {
    apply: true,
    currentStatus: "sent",
    nextStatus: "delivered",
    reason: "advanced",
    deliveredAtAction: "set_if_empty",
  });
  assert.equal(planCommunicationDeliveryTransition("deferred", "rejected").apply, true);
});

test("never regresses delivered or terminal delivery states", () => {
  assert.deepEqual(planCommunicationDeliveryTransition("delivered", "deferred"), {
    apply: false,
    currentStatus: "delivered",
    nextStatus: "delivered",
    reason: "stale_event",
    deliveredAtAction: "preserve",
  });
  assert.equal(planCommunicationDeliveryTransition("rejected", "delivered").apply, false);
  assert.equal(planCommunicationDeliveryTransition("unsubscribed", "delivered").reason, "terminal_status");
  assert.equal(planCommunicationDeliveryTransition("cancelled", "spam").reason, "terminal_status");
});

test("allows abuse and consent signals to supersede a prior outcome", () => {
  assert.equal(planCommunicationDeliveryTransition("delivered", "spam").nextStatus, "spam");
  assert.equal(planCommunicationDeliveryTransition("spam", "unsubscribed").nextStatus, "unsubscribed");
});

test("keeps exact repeats idempotent and rejects unknown states", () => {
  assert.equal(planCommunicationDeliveryTransition("delivered", "delivered").reason, "same_status");
  assert.throws(() => planCommunicationDeliveryTransition("opened", "delivered"), /current_status_invalid/);
  assert.throws(() => planCommunicationDeliveryTransition("sent", "click"), /incoming_status_invalid/);
});

test("adds a private scoped event fingerprint and the governed spam state", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260830090000_add_communication_delivery_event_dedupe.sql", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  assert.match(migration, /external_event_hash ~ '\^\[a-f0-9\]\{64\}\$'/);
  assert.match(migration, /unique index communication_events_scope_external_event_uidx[\s\S]*institution_id, external_event_hash/);
  assert.match(migration, /'rejected', 'spam', 'unsubscribed'/);
  assert.match(schema, /externalEventHash: text\("external_event_hash"\)/);
  assert.match(schema, /communication_events_scope_external_event_uidx/);
});

test("keeps the webhook closed, scoped, authenticated and idempotent", async () => {
  const route = await readFile(new URL("../api/webhooks/brevo/communications-delivery.ts", import.meta.url), "utf8");
  assert.match(route, /communicationDeliveryWebhookEnabled\(\)/);
  assert.match(route, /verifyCommunicationDeliveryBearerHeader/);
  assert.match(route, /COMMUNICATION_DELIVERY_WEBHOOK_TOKEN/);
  assert.match(route, /COMMUNICATION_PROVIDER_MESSAGE_HMAC_SECRET/);
  assert.match(route, /requireConfiguredInstitution\(\)/);
  assert.match(route, /eq\(communicationDeliveries\.institutionId, institution\.id\)/);
  assert.match(route, /\.for\("update"\)/);
  assert.match(route, /externalEventHash: event\.eventHash/);
  assert.match(route, /\.onConflictDoNothing\(\)/);
  assert.doesNotMatch(route, /recipient|contactRef|email|subject|tags/i);
});

test("does not expose delivery, provider or tenant identifiers in its response", async () => {
  const route = await readFile(new URL("../api/webhooks/brevo/communications-delivery.ts", import.meta.url), "utf8");
  const returns = [...route.matchAll(/return \{([^}]+)\}/g)].map((match) => match[1]).join("\n");
  assert.match(returns, /accepted/);
  assert.doesNotMatch(returns, /deliveryId|communicationId|institutionId|providerMessageRef|eventHash/);
});
