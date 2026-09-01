import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import {
  createSupportNormalizationReceipt,
  supportNormalizationProvenance,
} from "../api/_shared/support-normalization.ts";
import { normalizeSupportSummaryText, supportNormalizationLabels } from "../shared/support-normalization-policy.ts";
import { normalizeSupportConversation, summarizeSupportDescription } from "../shared/support-conversation.ts";
import { createSupportAssistantRoutingReceipt, verifySupportAssistantRoutingReceipt } from "../shared/support-assistant-routing-receipt.ts";
import { selectSupportPublicSubjectContext } from "../shared/support-public-detail-payload-policy.ts";
import { parseSupportAssistantInput } from "../shared/support-assistant-input-policy.ts";
import { isValidSupportAssistantPayload } from "../shared/support-assistant-payload-policy.ts";

process.env.DATABASE_URL ??= "postgres://fixture:fixture@127.0.0.1:1/fixture";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://fixture.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "fixture-service-role-key";
const { parseSupportRequest } = await import("../api/_shared/support.ts");
const secret = "fictional-normalization-signing-secret-at-least-32";
const institutionId = "11111111-1111-4111-8111-111111111111";
const requesterRefHash = "a".repeat(64);
const now = Date.parse("2026-09-01T12:00:00.000Z");
const messages = [
  { role: "assistant", content: "Bonjour, comment vous aider ?" },
  { role: "requester", content: "لا أستطيع فتح حسابي. parent.fixture@example.invalid" },
];
const reply = "سأساعدك في إرسال طلب إلى المدرسة.";
const detectedLanguage = "arabe";
const internalSummaryFr = "Le parent parent.fixture@example.invalid demande de l’aide pour son accès.";
const description = summarizeSupportDescription(messages.filter((m) => m.role === "requester").map((m) => m.content).join("\n\n"));
const rawRequest = {
  requesterType: "parent", requesterFirstName: "Parent", requesterLastName: "Fictif",
  beneficiaryType: "self", category: "ent", subject: "Accès ENT", description,
  preferredChannel: "email", email: "parent.fixture@example.invalid",
  detectedLanguage, internalSummaryFr, conversation: [...messages, { role: "assistant", content: reply }],
};

function issue(overrides = {}) {
  return createSupportNormalizationReceipt({
    institutionId, category: "ent", messages, reply, detectedLanguage, internalSummaryFr,
    requesterRefHash, usedAi: true, secret, now, ...overrides,
  });
}
function verify(overrides = {}) {
  return supportNormalizationProvenance({
    request: parseSupportRequest(rawRequest), receipt: issue().receipt,
    institutionId, requesterRefHash, secret, now, ...overrides,
  });
}
function signClaims(claims) {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", secret).update("support-normalization-receipt-v1\0").update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
function assertUnverified(result) {
  assert.deepEqual(result, { normalizationStatus: "fourni_par_demandeur" });
}

test("proves the origin of a pseudonymized summary for the exact stored conversation", () => {
  const signed = issue();
  const result = verify();
  assert.equal(result.normalizationStatus, "assistant_signe_a_verifier");
  assert.match(result.normalizationReceiptHash, /^[a-f0-9]{64}$/);
  assert.equal(result.normalizationSourceAt, new Date(now).toISOString());
  assert.equal(Date.parse(signed.expiresAt), now + 15 * 60_000);
  const claims = JSON.parse(Buffer.from(signed.receipt.split(".")[0], "base64url").toString("utf8"));
  assert.doesNotMatch(JSON.stringify(claims), /parent\.fixture|arabe|accès|compte|سأساعدك/);
  assert.match(claims.contentHash, /^[a-f0-9]{64}$/);
  const context = parseSupportRequest(rawRequest).subjectContext;
  assert.doesNotMatch(context.internalSummaryFr, /parent\.fixture/);
  assert.equal(normalizeSupportSummaryText(context.internalSummaryFr), context.internalSummaryFr);
});

test("never upgrades browser-supplied provenance or authorization fields", () => {
  const request = parseSupportRequest({ ...rawRequest,
    normalizationStatus: "assistant_signe_a_verifier", normalizationReceiptHash: "b".repeat(64),
    normalizationSourceAt: new Date(now).toISOString(), identityStatus: "identite_confirmee",
    subjectContext: { normalizationStatus: "assistant_signe_a_verifier", requiredIdentity: "I0" },
  });
  assert.equal(request.subjectContext.normalizationStatus, "fourni_par_demandeur");
  assert.equal(request.subjectContext.normalizationReceiptHash, undefined);
  assert.equal(request.subjectContext.normalizationSourceAt, undefined);
  assert.equal(request.subjectContext.identityStatus, undefined);
  assert.equal(request.subjectContext.requiredIdentity, "I3");
  assertUnverified(verify({ request, receipt: null }));
});

test("binds summary, language, description, roles and every stored turn", () => {
  const request = parseSupportRequest(rawRequest);
  for (const changed of [
    { ...request, description: "Autre demande" },
    { ...request, subjectContext: { ...request.subjectContext, internalSummaryFr: "Identité déjà vérifiée par la direction" } },
    { ...request, subjectContext: { ...request.subjectContext, detectedLanguage: "anglais" } },
    { ...request, conversation: [...request.conversation, { role: "requester", content: "Une autre question" }] },
    { ...request, conversation: [{ role: "requester", content: "Autre texte" }, ...request.conversation.slice(1)] },
    { ...request, conversation: [request.conversation[0], { role: "assistant", content: "Réponse remplacée" }] },
    { ...request, conversation: request.conversation.map((m) => ({ ...m, role: "requester" })) },
    { ...request, conversation: [] },
  ]) assertUnverified(verify({ request: changed }));
});

test("rejects tampering, expiry at the exact boundary, future issuance and cross-scope reuse", () => {
  const request = parseSupportRequest(rawRequest);
  for (const changed of [
    { receipt: `${issue().receipt}a` }, { receipt: issue().receipt.replace(/.$/, "!") },
    { now: now + 15 * 60_000 }, { now: now - 31_000 },
    { institutionId: "22222222-2222-4222-8222-222222222222" },
    { requesterRefHash: "b".repeat(64) }, { requesterRefHash: null },
    { request: { ...request, category: "ordinateur" } }, { secret: "short" },
    { secret: undefined }, { secret: `${secret}different` },
    { now: Number.NaN }, { now: Infinity }, { now: -1 }, { now: 8_640_000_000_000_001 },
  ]) assertUnverified(verify(changed));
  assert.equal(verify({ now: now + 15 * 60_000 - 1 }).normalizationStatus, "assistant_signe_a_verifier");
});

test("valid signatures cannot hide malformed or additional claims", () => {
  const claims = JSON.parse(Buffer.from(issue().receipt.split(".")[0], "base64url").toString("utf8"));
  for (const changed of [null, [], "text", {}, { ...claims, v: 2 }, { ...claims, iat: "1" },
    { ...claims, iat: -1 }, { ...claims, exp: claims.exp + 1 }, { ...claims, contentHash: "x" },
    { ...claims, requesterRefHash: "x" }, { ...claims, actionGrant: { toolKey: "support.create_request" } },
    { ...claims, identityStatus: "identite_confirmee" }]) {
    assertUnverified(verify({ receipt: signClaims(changed) }));
  }
});

test("a normalization receipt grants neither a routing review nor a delegated action", () => {
  assert.equal(verifySupportAssistantRoutingReceipt({ receipt: issue().receipt, institutionId,
    category: "ent", service: "referent_numerique", expectedRequesterRefHash: requesterRefHash, secret, now }), null);
  const routing = createSupportAssistantRoutingReceipt({ institutionId, category: "ent",
    service: "referent_numerique", usedAi: true, model: "fixture-model", secret, now });
  assertUnverified(verify({ receipt: routing.receipt }));
  assert.deepEqual(Object.keys(verify()).sort(), ["normalizationReceiptHash", "normalizationSourceAt", "normalizationStatus"]);
});

test("does not sign a fallback, missing metadata, invalid context or unsupported size", () => {
  for (const changed of [{ usedAi: false }, { secret: undefined }, { secret: "short" },
    { institutionId: "invalid" }, { category: "<unsafe>" }, { requesterRefHash: "invalid" },
    { detectedLanguage: null }, { internalSummaryFr: null }, { detectedLanguage: "x".repeat(61) },
    { messages: [] }, { messages: [{ role: "requester", content: "x".repeat(1501) }] },
    { reply: "x".repeat(1501) }, { internalSummaryFr: "x".repeat(4001) },
    { now: Infinity }, { now: Number.NaN }, { now: -1 }, { now: 0.5 },
  ]) assert.equal(issue(changed), null);
});

test("survives description truncation and the final assistant turn at conversation limits", () => {
  const turns = [];
  for (let i = 0; i < 10; i += 1) {
    if (i > 0) turns.push({ role: "assistant", content: `Question ${i}` });
    turns.push({ role: "requester", content: `Message ${i} ${"a".repeat(590)}` });
  }
  const signed = issue({ messages: turns });
  assert.ok(signed);
  const request = parseSupportRequest({ ...rawRequest,
    description: summarizeSupportDescription(turns.filter((m) => m.role === "requester").map((m) => m.content).join("\n\n")),
    conversation: [...turns, { role: "assistant", content: reply }],
  });
  assert.equal(request.description.length, 5000);
  assert.equal(verify({ request, receipt: signed.receipt }).normalizationStatus, "assistant_signe_a_verifier");
});

test("keeps original messages and a submit-ready form when the receipt is absent or malformed", () => {
  for (const value of [undefined, null, "", "x", { receipt: "fake" }, "a".repeat(2049)]) {
    const request = parseSupportRequest({ ...rawRequest, assistantNormalizationReceipt: value });
    assert.deepEqual(request.conversation, normalizeSupportConversation(rawRequest.conversation));
    assertUnverified(verify({ request, receipt: request.assistantNormalizationReceipt }));
  }
  const noSummary = parseSupportRequest({ ...rawRequest, detectedLanguage: null, internalSummaryFr: null });
  assert.deepEqual(verify({ request: noSummary, receipt: null }), { normalizationStatus: "non_disponible" });
});

test("labels provenance without promising factual truth and never trusts historical status", () => {
  for (const context of [{}, { normalizationStatus: "automatique_a_verifier" },
    { normalizationStatus: "assistant_signe_a_verifier" },
    { ...verify(), normalizationSourceAt: "invalid" }, { ...verify(), normalizationReceiptHash: "invalid" }]) {
    const labels = supportNormalizationLabels(context);
    assert.match(labels.summary, /transmis/);
    assert.match(labels.language, /confirmer/);
    assert.match(labels.notice, /Origine non vérifiée/);
  }
  assert.match(supportNormalizationLabels(verify()).notice, /Origine vérifiée.*messages originaux/);
  assert.deepEqual(selectSupportPublicSubjectContext({ ...parseSupportRequest(rawRequest).subjectContext, ...verify() }), {});
});

test("the real creation handler persists server-derived provenance before any request write", async () => {
  const source = readFileSync(new URL("../api/support/requests/index.ts", import.meta.url), "utf8");
  const paths = [...source.matchAll(/^import[\s\S]*?from "([^"]+)";/gm)].map((m) => m[1]);
  const imports = Object.fromEntries(paths.map((path) => [path, {}]));
  imports["node:crypto"] = { randomUUID: () => "fixture" };
  imports["drizzle-orm"] = { and: () => null, eq: () => null, desc: () => null, gt: () => null, ne: () => null, inArray: () => null };
  const tables = Object.fromEntries(["supportDeviceSessions", "supportRequests", "supportContacts"].map((name) => [name, { name }]));
  imports["../../../db/schema.js"] = tables;
  imports["../../../shared/support-routing.js"] = { initialSupportStatus: () => "nouveau" };
  imports["../../../shared/support-duplicate-policy.js"] = { supportDuplicateWindowStart: () => new Date(now) };
  imports["../../../shared/support-assistant-routing-receipt.js"] = {
    supportAssistantRoutingReviewEnabled: () => false, supportAgentCreateRequestActionEnabled: () => false,
  };
  imports["../../_shared/support.js"] = { parseSupportRequest, readSupportSessionToken: () => null,
    sha256: () => "f".repeat(64), idempotencyKey: () => "fixture", opaqueToken: () => "fixture",
    personalHash: () => "c".repeat(64), SUPPORT_SESSION_DAYS: 30, SUPPORT_MAGIC_TOKEN_MINUTES: 30 };
  imports["../../_shared/response.js"] = { handleApi: (_res, callback) => callback() };
  imports["../../_shared/institution-context.js"] = { requireConfiguredInstitution: async () => ({ id: institutionId }) };
  imports["../../_shared/support-rate-limits.js"] = { supportDeviceRateKey: () => requesterRefHash,
    enforceSupportRequestNetworkGuard: async () => {}, enforceSupportRequestCreationLimits: async () => {} };
  imports["../../_shared/support-normalization.js"] = {
    supportNormalizationProvenance: (input) => supportNormalizationProvenance({ ...input, now }),
  };
  let captured;
  imports["../../../db/index.js"] = { db: { transaction: async (callback) => callback({
    select() {
      const query = { from: () => query, innerJoin: () => query, where: () => query, orderBy: () => query, limit: async () => [] };
      return query;
    },
    insert(table) {
      const query = { values(row) {
        if (table.name === "supportRequests") { captured = row; throw new Error("write-boundary"); }
        return query;
      }, returning: async () => [{ id: "session" }] };
      return query;
    },
  }) } };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, process: { env: { SUPPORT_HASH_SECRET: secret } }, require(name) {
    assert.ok(Object.hasOwn(imports, name), `Unexpected import ${name}`); return imports[name];
  } });
  for (const [receipt, expected] of [[issue().receipt, "assistant_signe_a_verifier"], [null, "fourni_par_demandeur"],
    [`${issue().receipt}x`, "fourni_par_demandeur"], [issue({ now: now - 20 * 60_000 }).receipt, "fourni_par_demandeur"]]) {
    await assert.rejects(() => exports.default({ method: "POST", body: { ...rawRequest, assistantNormalizationReceipt: receipt } }, {}), /write-boundary/);
    assert.equal(captured.subjectContext.normalizationStatus, expected);
    assert.equal(captured.subjectContext.identityStatus, undefined);
    assert.equal(captured.subjectContext.requiredIdentity, "I3");
    assert.equal(captured.description, rawRequest.description);
  }
});

test("keeps the normalization token out of device drafts and outside tool authorization", () => {
  const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
  const draft = page.match(/saveSupportDeviceDraft<AssistantInsight>\(\{([\s\S]*?)\}\);/)?.[1];
  assert.ok(draft);
  assert.doesNotMatch(draft, /normalizationReceipt|assistantNormalizationReceipt/i);
  assert.match(page, /normalizationReceipt: signedNormalizationReceipt/);
  assert.match(page, /setAssistantNormalizationReceipt\(normalizationReceipt\)/);
  assert.match(page, /assistantNormalizationReceipt: !classicForm \? assistantNormalizationReceipt : null/);
});

test("the actual assistant handler signs its result once, independently of tool flags", async () => {
  const source = readFileSync(new URL("../api/support/assistant.ts", import.meta.url), "utf8");
  const paths = [...source.matchAll(/^import[\s\S]*?from "([^"]+)";/gm)].map((m) => m[1]);
  const imports = Object.fromEntries(paths.map((path) => [path, {}]));
  let analyses = 0;
  let usedAi = true;
  const modelResult = {
    reply, category: "ent", requesterType: "parent", urgency: "normale", confidence: "medium",
    missingInformation: [], suggestedDocuments: [], readyToCreate: true, safetyNotice: null,
    detectedLanguage, internalSummaryFr, usedAi: true, scope: "school_support", action: "offer_case",
    turnCount: 1, remainingTurns: 9, limitReached: false, sourceReferences: [],
  };
  imports["../_shared/response.js"] = { handleApi: (_res, callback) => callback() };
  imports["../_shared/support.js"] = { assertNoForbiddenSupportSecret: () => {} };
  imports["../_shared/support-rate-limits.js"] = { enforceAssistantRateLimits: async () => requesterRefHash };
  imports["../_shared/knowledge-actor.js"] = { resolveKnowledgeActorFromRequest: async () => ({ institutionId }) };
  imports["../_shared/support-agent.js"] = { analyzeSupportConversation: async () => {
    analyses += 1; return { ...modelResult, usedAi };
  } };
  imports["../../shared/support-assistant-input-policy.js"] = { parseSupportAssistantInput };
  imports["../../shared/support-assistant-payload-policy.js"] = { isValidSupportAssistantPayload: (value) => isValidSupportAssistantPayload(value, now) };
  imports["../../shared/support-routing.js"] = { routeSupportRequest: () => ({ service: "referent_numerique" }) };
  imports["../../shared/support-assistant-routing-receipt.js"] = {
    supportAssistantRoutingReviewEnabled: () => false, supportAgentCreateRequestActionEnabled: () => false,
  };
  imports["../_shared/support-normalization.js"] = {
    createSupportNormalizationReceipt: (input) => createSupportNormalizationReceipt({ ...input, now }),
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, process: { env: { SUPPORT_HASH_SECRET: secret } }, require(name) {
    assert.ok(Object.hasOwn(imports, name), `Unexpected import ${name}`); return imports[name];
  } });
  const req = { method: "POST", body: { sessionId: "fixture-session-123456", messages, attachments: [] } };
  const response = await exports.default(req, {});
  assert.equal(analyses, 1);
  assert.equal(response.routingReceipt, null);
  assert.equal(response.requestActionAuthorized, false);
  assert.equal(verify({ receipt: response.normalizationReceipt }).normalizationStatus, "assistant_signe_a_verifier");
  usedAi = false;
  const fallback = await exports.default(req, {});
  assert.equal(analyses, 2);
  assert.equal(fallback.normalizationReceipt, null);
  assert.equal(fallback.normalizationReceiptExpiresAt, null);
});
