import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  hashCommunicationProviderOutboundMessageId,
  parseCommunicationBrevoInboundEnvelope,
} from "../shared/communication-brevo-inbound.ts";
import { matchCommunicationInboundToDelivery } from "../shared/communication-inbound-matching.ts";

const migration = readFileSync(new URL(
  "../supabase/migrations/20260830110000_secure_communication_reply_matching.sql",
  import.meta.url
), "utf8");
const schema = readFileSync(new URL("../db/schema.ts", import.meta.url), "utf8");
const previewRecipe = readFileSync(new URL(
  "../supabase/tests/communication_inbound_matching_security.test.sql",
  import.meta.url
), "utf8");
const hashingSecret = "reply-matching-test-secret-with-32-characters";
const institutionId = "00000000-0000-4000-8000-000000000001";
const deliveryId = "11111111-1111-4111-8111-111111111111";
const communicationId = "22222222-2222-4222-8222-222222222222";
const replyTo = "<outbound-001@example.test>";

function receipt(overrides = {}) {
  const [value] = parseCommunicationBrevoInboundEnvelope({ items: [{
    MessageId: "<inbound-001@example.test>",
    InReplyTo: replyTo,
    Recipients: ["communication+fictif@example.test"],
    ExtractedMarkdownMessage: "Réponse fictive",
    ...overrides,
  }] }, hashingSecret);
  return value;
}

function candidate(overrides = {}) {
  return {
    institutionId,
    deliveryId,
    communicationId,
    providerMessageRef: hashCommunicationProviderOutboundMessageId(replyTo, hashingSecret),
    ...overrides,
  };
}

test("uses the exact outbound HMAC for an inbound In-Reply-To reference", () => {
  assert.equal(
    receipt().inReplyToHash,
    hashCommunicationProviderOutboundMessageId(replyTo, hashingSecret)
  );
});

test("matches exactly one scoped delivery without using an address fallback", () => {
  assert.deepEqual(matchCommunicationInboundToDelivery(receipt(), [candidate()], institutionId), {
    status: "matched",
    reason: "in_reply_to_exact",
    deliveryId,
    communicationId,
  });
  const noReference = receipt({ InReplyTo: undefined });
  assert.equal(noReference.recipientAliasHashes.length, 1);
  assert.deepEqual(matchCommunicationInboundToDelivery(noReference, [candidate()], institutionId), {
    status: "unmatched",
    reason: "missing_reply_reference",
    deliveryId: null,
    communicationId: null,
  });
});

test("keeps unknown and ambiguous references in manual review", () => {
  const unknown = candidate({ providerMessageRef: "a".repeat(64) });
  assert.equal(
    matchCommunicationInboundToDelivery(receipt(), [unknown], institutionId).reason,
    "delivery_not_found"
  );
  const duplicate = { ...candidate(), deliveryId: "33333333-3333-4333-8333-333333333333" };
  assert.deepEqual(matchCommunicationInboundToDelivery(
    receipt(),
    [candidate(), duplicate],
    institutionId
  ), {
    status: "ambiguous",
    reason: "multiple_deliveries",
    deliveryId: null,
    communicationId: null,
  });
});

test("rejects unbounded or contact-bearing database projections", () => {
  assert.throws(() => matchCommunicationInboundToDelivery(receipt(), [
    candidate({ recipientEmail: "private@example.test" }),
  ], institutionId), /candidate_unknown_field/);
  assert.throws(() => matchCommunicationInboundToDelivery(receipt(), [
    candidate(), candidate(), candidate(),
  ], institutionId), /candidates_invalid/);
  assert.throws(() => matchCommunicationInboundToDelivery(receipt(), [
    candidate({ providerMessageRef: replyTo }),
  ], institutionId), /candidate_invalid/);
  assert.throws(() => matchCommunicationInboundToDelivery(receipt(), [
    candidate({ institutionId: "99999999-9999-4999-8999-999999999999" }),
  ], institutionId), /candidate_scope_mismatch/);
});

test("enforces a unique HMAC reference per institution in SQL and Drizzle", () => {
  assert.match(migration, /provider_message_ref !~ '\^\[a-f0-9\]\{64\}\$'/);
  assert.match(migration, /group by institution_id, provider_message_ref/);
  assert.match(migration, /having count\(\*\) > 1/);
  assert.match(migration, /create unique index communication_deliveries_institution_provider_message_uidx/);
  assert.match(migration, /on public\.communication_deliveries \(institution_id, provider_message_ref\)/);
  assert.match(schema, /uniqueIndex\("communication_deliveries_institution_provider_message_uidx"\)/);
  assert.match(schema, /\.on\(table\.institutionId, table\.providerMessageRef\)/);
});

test("keeps the preview matching recipe scoped, private and residue-free", () => {
  assert.match(previewRecipe, /^begin;[\s\S]*rollback;/);
  assert.match(previewRecipe, /same_scope_provider_duplicate_blocked/);
  assert.match(previewRecipe, /cross_scope_inbound_blocked/);
  assert.match(previewRecipe, /on conflict do nothing/);
  assert.match(previewRecipe, /provider_message_ref = repeat\('a', 64\)\) <> 2/);
  assert.match(previewRecipe, /has_table_privilege\(role_name, table_name, privilege_name\)/);
  assert.match(previewRecipe, /auth_residue[\s\S]*institution_residue[\s\S]*communication_residue[\s\S]*delivery_residue[\s\S]*inbound_residue[\s\S]*event_residue/);
});
