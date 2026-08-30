import assert from "node:assert/strict";
import test from "node:test";
import {
  createSupportAssistantRoutingReceipt,
  supportAssistantRoutingReviewEnabled,
  verifySupportAssistantRoutingReceipt,
} from "../shared/support-assistant-routing-receipt.ts";

const secret = "test-secret-that-is-long-enough-for-hmac-2026";
const institutionId = "11111111-1111-4111-8111-111111111111";
const nonce = "22222222-2222-4222-8222-222222222222";
const now = Date.parse("2026-08-30T08:00:00.000Z");

function create(overrides = {}) {
  return createSupportAssistantRoutingReceipt({
    institutionId,
    category: "ent",
    service: "referent_numerique",
    usedAi: true,
    model: "gpt-test",
    secret,
    now,
    nonce,
    ...overrides,
  });
}

test("creates and verifies a bounded routing receipt without user content", () => {
  const signed = create();
  assert.ok(signed);
  const verified = verifySupportAssistantRoutingReceipt({
    receipt: signed.receipt,
    institutionId,
    category: "ent",
    service: "referent_numerique",
    secret,
    now: now + 60_000,
  });
  assert.deepEqual(verified && {
    institutionId: verified.institutionId,
    category: verified.category,
    service: verified.service,
    usedAi: verified.usedAi,
    model: verified.model,
  }, {
    institutionId,
    category: "ent",
    service: "referent_numerique",
    usedAi: true,
    model: "gpt-test",
  });
  assert.match(verified.receiptHash, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(signed.receipt, /email|telephone|message|description|session/i);
});

test("rejects tampering, expiry, cross-scope use and a short secret", () => {
  const signed = create();
  assert.ok(signed);
  const base = {
    receipt: signed.receipt,
    institutionId,
    category: "ent",
    service: "referent_numerique",
    secret,
    now: now + 60_000,
  };
  assert.equal(verifySupportAssistantRoutingReceipt({ ...base, receipt: `${signed.receipt}x` }), null);
  assert.equal(verifySupportAssistantRoutingReceipt({ ...base, now: now + 16 * 60_000 }), null);
  assert.equal(verifySupportAssistantRoutingReceipt({ ...base, category: "ordinateur" }), null);
  assert.equal(verifySupportAssistantRoutingReceipt({ ...base, institutionId: "33333333-3333-4333-8333-333333333333" }), null);
  assert.equal(verifySupportAssistantRoutingReceipt({ ...base, secret: "short" }), null);
});

test("fails closed for inconsistent model metadata", () => {
  assert.equal(create({ usedAi: true, model: null }), null);
  assert.equal(create({ usedAi: false, model: "gpt-test" }), null);
  assert.ok(create({ usedAi: false, model: null }));
});

test("keeps routing review disabled unless the server flag is explicit", () => {
  const previous = process.env.SUPPORT_ASSISTANT_ROUTING_REVIEW_ENABLED;
  try {
    delete process.env.SUPPORT_ASSISTANT_ROUTING_REVIEW_ENABLED;
    assert.equal(supportAssistantRoutingReviewEnabled(), false);
    process.env.SUPPORT_ASSISTANT_ROUTING_REVIEW_ENABLED = "TRUE";
    assert.equal(supportAssistantRoutingReviewEnabled(), false);
    process.env.SUPPORT_ASSISTANT_ROUTING_REVIEW_ENABLED = "true";
    assert.equal(supportAssistantRoutingReviewEnabled(), true);
  } finally {
    if (previous === undefined) delete process.env.SUPPORT_ASSISTANT_ROUTING_REVIEW_ENABLED;
    else process.env.SUPPORT_ASSISTANT_ROUTING_REVIEW_ENABLED = previous;
  }
});
