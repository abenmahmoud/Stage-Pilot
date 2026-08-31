import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  isValidSupportAssistantPayload,
  SUPPORT_ASSISTANT_PAYLOAD_LIMITS,
} from "../shared/support-assistant-payload-policy.ts";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../api/support/assistant.ts", import.meta.url), "utf8");
const nowMs = Date.parse("2026-09-01T08:00:00.000Z");
const receipt = `${"a".repeat(70)}.${"b".repeat(43)}`;

const validPayload = {
  reply: "Je peux préparer votre demande d’accès ENT.",
  category: "ent",
  requesterType: "eleve",
  urgency: "normale",
  confidence: "high",
  missingInformation: ["Adresse email de contact"],
  suggestedDocuments: [],
  readyToCreate: true,
  safetyNotice: null,
  detectedLanguage: "français",
  internalSummaryFr: "Élève bloqué lors de la connexion à l’ENT.",
  usedAi: true,
  scope: "school_support",
  action: "offer_case",
  turnCount: 1,
  remainingTurns: 9,
  limitReached: false,
  sourceReferences: [{
    title: "Procédure ENT publique",
    updatedAt: "2026-08-31T08:00:00.000Z",
  }],
  routingReceipt: null,
  routingReceiptExpiresAt: null,
  requestActionAuthorized: false,
};

test("validates the assistant response before rendering it", () => {
  const assistantFunction = page.indexOf("async function askAssistant");
  const readUnknown = page.indexOf('apiFetch<unknown>("support/assistant"', assistantFunction);
  const validation = page.indexOf("if (!isAssistantApiResult(apiResult))", readUnknown);
  const resultAssignment = page.indexOf("result = assistantResult", validation);
  assert.notEqual(assistantFunction, -1);
  assert.ok(assistantFunction < readUnknown);
  assert.ok(readUnknown < validation);
  assert.ok(validation < resultAssignment);
});

test("accepts one exact, bounded and coherent assistant payload", () => {
  assert.deepEqual(SUPPORT_ASSISTANT_PAYLOAD_LIMITS, {
    reply: 1_500,
    listItems: 5,
    listItem: 180,
    safetyNotice: 500,
    detectedLanguage: 60,
    internalSummaryFr: 700,
    sources: 20,
    sourceTitle: 200,
    receipt: 2_048,
    receiptLifetimeMs: 16 * 60_000,
  });
  assert.equal(isValidSupportAssistantPayload(validPayload, nowMs), true);
});

test("rejects hidden fields at the root and inside sources", () => {
  assert.equal(isValidSupportAssistantPayload({ ...validPayload, model: "internal" }, nowMs), false);
  assert.equal(isValidSupportAssistantPayload({
    ...validPayload,
    sourceReferences: [{ ...validPayload.sourceReferences[0], sourceId: "hidden" }],
  }, nowMs), false);
  assert.equal(isValidSupportAssistantPayload({
    ...validPayload,
    sourceReferences: [{
      ...validPayload.sourceReferences[0],
      updatedAt: "September 1, 2026 08:00:00",
    }],
  }, nowMs), false);
});

test("rejects oversized, unknown and duplicated public values", () => {
  assert.equal(isValidSupportAssistantPayload({
    ...validPayload,
    reply: "x".repeat(SUPPORT_ASSISTANT_PAYLOAD_LIMITS.reply + 1),
  }, nowMs), false);
  assert.equal(isValidSupportAssistantPayload({ ...validPayload, category: "unknown" }, nowMs), false);
  assert.equal(isValidSupportAssistantPayload({
    ...validPayload,
    missingInformation: Array.from(
      { length: SUPPORT_ASSISTANT_PAYLOAD_LIMITS.listItems + 1 },
      (_, index) => `Élément ${index}`
    ),
  }, nowMs), false);
  assert.equal(isValidSupportAssistantPayload({
    ...validPayload,
    sourceReferences: [validPayload.sourceReferences[0], validPayload.sourceReferences[0]],
  }, nowMs), false);
});

test("requires coherent turn counters and actionable states", () => {
  assert.equal(isValidSupportAssistantPayload({ ...validPayload, remainingTurns: 8 }, nowMs), false);
  assert.equal(isValidSupportAssistantPayload({ ...validPayload, turnCount: 11, remainingTurns: 0 }, nowMs), false);
  assert.equal(isValidSupportAssistantPayload({
    ...validPayload,
    action: "offer_case",
    readyToCreate: false,
  }, nowMs), false);
  assert.equal(isValidSupportAssistantPayload({
    ...validPayload,
    action: "continue",
    routingReceipt: receipt,
    routingReceiptExpiresAt: "2026-09-01T08:15:00.000Z",
    requestActionAuthorized: true,
  }, nowMs), false);
});

test("accepts only a bounded short-lived receipt pair", () => {
  const authorized = {
    ...validPayload,
    routingReceipt: receipt,
    routingReceiptExpiresAt: "2026-09-01T08:15:00.000Z",
    requestActionAuthorized: true,
  };
  assert.equal(isValidSupportAssistantPayload(authorized, nowMs), true);
  assert.equal(isValidSupportAssistantPayload({
    ...authorized,
    routingReceiptExpiresAt: "2026-09-01T07:59:29.000Z",
  }, nowMs), false);
  assert.equal(isValidSupportAssistantPayload({
    ...authorized,
    routingReceiptExpiresAt: "2026-09-01T08:16:01.000Z",
  }, nowMs), false);
  assert.equal(isValidSupportAssistantPayload({ ...authorized, routingReceipt: "invalid" }, nowMs), false);
  assert.equal(isValidSupportAssistantPayload({
    ...validPayload,
    requestActionAuthorized: true,
  }, nowMs), false);
});

test("delegates the browser contract to the shared runtime policy", () => {
  assert.match(page, /function isAssistantApiResult\(value: unknown\): value is AssistantApiResult \{\s*return isValidSupportAssistantPayload\(value\);/);
  assert.doesNotMatch(page, /function isAssistantStringList\(/);
  assert.doesNotMatch(page, /function hasValidAssistantRoutingReceipt\(/);
});

test("projects and validates the server payload before returning it", () => {
  const payload = route.indexOf("const payload = {");
  const validation = route.indexOf("if (!isValidSupportAssistantPayload(payload))", payload);
  const returned = route.indexOf("return payload;", validation);
  assert.notEqual(payload, -1);
  assert.ok(payload < validation);
  assert.ok(validation < returned);
  assert.doesNotMatch(route, /\.\.\.result/);
  assert.match(route, /sourceReferences: result\.sourceReferences\.map\(\(\{ title, updatedAt \}\) => \(\{ title, updatedAt \}\)\)/);
});
