import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = await Promise.all([
  readFile(new URL("../supabase/migrations/20260830090500_create_support_assistant_routing_reviews.sql", import.meta.url), "utf8"),
  readFile(new URL("../api/support/assistant.ts", import.meta.url), "utf8"),
  readFile(new URL("../api/support/requests/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../api/support/agent/requests/[code].ts", import.meta.url), "utf8"),
  readFile(new URL("../api/support/agent/metrics.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8"),
]);

const [migration, assistantRoute, requestRoute, agentRoute, metricsRoute, page] = files;

test("keeps routing reviews private, scoped and terminal after a human decision", () => {
  assert.match(migration, /foreign key \(request_id, institution_id\)[\s\S]+support_requests\(id, institution_id\)/i);
  assert.match(migration, /unique \(request_id\)/i);
  assert.match(migration, /unique \(institution_id, receipt_hash\)/i);
  assert.match(migration, /status in \('pending', 'confirmed', 'corrected'\)/i);
  assert.match(migration, /used_ai = \(model is not null\)/i);
  assert.match(migration, /Resolved assistant routing review is immutable/i);
  assert.match(migration, /force row level security/i);
  assert.match(migration, /revoke all on table public\.support_assistant_routing_reviews[\s\S]+public, anon, authenticated/i);
  assert.match(migration, /grant select, insert, update on table public\.support_assistant_routing_reviews[\s\S]+service_role/i);
  assert.doesNotMatch(migration, /grant[^;]*delete/i);
  assert.doesNotMatch(migration, /body_text|description|email|phone|telephone|first_name|last_name/i);
});

test("attaches only a verified short-lived assistant receipt without blocking request creation", () => {
  assert.match(assistantRoute, /supportAssistantRoutingReviewEnabled\(\)/);
  assert.match(assistantRoute, /createSupportAssistantRoutingReceipt/);
  assert.match(assistantRoute, /knowledgeActor\.institutionId/);
  assert.match(requestRoute, /verifySupportAssistantRoutingReceipt/);
  assert.match(requestRoute, /supportAssistantRoutingReviewEnabled\(\)/);
  assert.match(requestRoute, /receipt: input\.assistantRoutingReceipt/);
  assert.match(requestRoute, /institutionId: institution\.id/);
  assert.match(requestRoute, /category: input\.category/);
  assert.match(requestRoute, /service: input\.routing\.service/);
  assert.match(requestRoute, /assistantRoutingAttached: Boolean\(attachedRoutingReview\)/);
  assert.doesNotMatch(requestRoute, /toValue:[\s\S]{0,500}routingReceipt/);
});

test("requires an explicit human outcome and records corrections atomically", () => {
  assert.match(agentRoute, /routingDecision === "confirmed"[\s\S]+requireAal2\(req\)/);
  assert.match(agentRoute, /eq\(supportAssistantRoutingReviews\.status, "pending"\)/);
  assert.match(agentRoute, /reviewStatus = teamChanged \? "corrected" : "confirmed"/);
  assert.match(agentRoute, /request\.routing_confirmed/);
  assert.match(agentRoute, /request\.routing_corrected/);
  assert.doesNotMatch(agentRoute, /receiptHash:[\s\S]{0,300}supportEvents/);
  assert.match(metricsRoute, /routingReviewCompletionRate/);
  assert.match(metricsRoute, /routingReviewCorrectionRate/);
});

test("keeps the signed receipt out of the device draft and shows the human decision", () => {
  const saveDraft = page.match(/saveSupportDeviceDraft<AssistantInsight>\(\{([\s\S]*?)\}\);/)?.[1] ?? "";
  assert.ok(saveDraft);
  assert.doesNotMatch(saveDraft, /assistantRoutingReceipt/);
  assert.match(page, /setAssistantRoutingReceipt\(routingReceipt\)/);
  assert.match(page, /assistantRoutingReceipt: !classicForm \? assistantRoutingReceipt : null/);
  assert.match(page, /Classement à confirmer/);
  assert.match(page, /Classement confirmé/);
  assert.match(page, /Classement corrigé/);
  assert.match(page, /routingDecision: "confirmed"/);
});
