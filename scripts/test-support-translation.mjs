import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SupportTranslationFailure,
  createSupportTranslationReceipt,
  prepareSupportTranslation,
  verifySupportTranslationReceipt,
} from "../api/_shared/support-translation.ts";
import {
  normalizeSupportReplyText,
  supportTranslationTargetLanguage,
} from "../shared/support-reply-policy.ts";

const translateRoute = readFileSync(
  new URL("../api/support/agent/requests/[code]/translate.ts", import.meta.url),
  "utf8"
);
const replyRoute = readFileSync(
  new URL("../api/support/agent/requests/[code]/reply.ts", import.meta.url),
  "utf8"
);
const agentPage = readFileSync(
  new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
  "utf8"
);

const originalApiKey = process.env.OPENAI_API_KEY;
const originalHashSecret = process.env.SUPPORT_HASH_SECRET;
process.env.OPENAI_API_KEY = "test-openai-key";
process.env.SUPPORT_HASH_SECRET = "test-support-hash-secret-which-is-at-least-thirty-two-characters";

test.after(() => {
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
  if (originalHashSecret === undefined) delete process.env.SUPPORT_HASH_SECRET;
  else process.env.SUPPORT_HASH_SECRET = originalHashSecret;
});

test("masks known personal data before translation and restores only the known marker", async () => {
  let modelBody;
  const draft = await prepareSupportTranslation({
    sourceMessage: "Bonjour Nadia, écrivez à parent.test@example.com si le problème continue.",
    targetLanguage: "arabe",
    safetyIdentifier: "test-translation-agent",
    knownNames: [{ value: "Nadia", marker: "[PRENOM_DEMANDEUR]" }],
    fetchImpl: async (_url, init) => {
      modelBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        output: [{
          content: [{
            type: "output_text",
            text: JSON.stringify({
              translatedText: "مرحبًا [PRENOM_DEMANDEUR]، اكتب إلى [EMAIL_MASQUE] إذا استمرت المشكلة.",
              backTranslationFr: "Bonjour [PRENOM_DEMANDEUR], écrivez à [EMAIL_MASQUE] si le problème continue.",
              warnings: [],
            }),
          }],
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  assert.equal(modelBody.store, false);
  assert.match(modelBody.input, /\[PRENOM_DEMANDEUR\]/);
  assert.match(modelBody.input, /\[EMAIL_MASQUE\]/);
  assert.doesNotMatch(modelBody.input, /Nadia|parent\.test@example\.com/);
  assert.match(draft.translatedText, /Nadia/);
  assert.doesNotMatch(draft.translatedText, /parent\.test@example\.com/);
  assert.match(draft.translatedText, /\[EMAIL_MASQUE\]/);
});

test("binds a short-lived receipt to the request, agent, source, target and exact translation", () => {
  const now = Date.parse("2026-08-29T12:00:00.000Z");
  const input = {
    requestId: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    sourceMessage: "Bonjour, votre demande est prise en charge.",
    translatedMessage: "مرحبًا، تم تسجيل طلبكم.",
    targetLanguage: "arabe",
  };
  const signed = createSupportTranslationReceipt({ ...input, now });
  assert.equal(verifySupportTranslationReceipt({ ...input, receipt: signed.receipt, now }), true);
  assert.equal(verifySupportTranslationReceipt({
    ...input,
    translatedMessage: `${input.translatedMessage} Modifié`,
    receipt: signed.receipt,
    now,
  }), false);
  assert.equal(verifySupportTranslationReceipt({
    ...input,
    userId: "33333333-3333-4333-8333-333333333333",
    receipt: signed.receipt,
    now,
  }), false);
  assert.equal(verifySupportTranslationReceipt({
    ...input,
    receipt: signed.receipt,
    now: now + 16 * 60 * 1000,
  }), false);
});

test("rejects a model response that drops a protected marker", async () => {
  await assert.rejects(
    () => prepareSupportTranslation({
      sourceMessage: "Bonjour Nadia, votre demande est prise en charge.",
      targetLanguage: "arabe",
      safetyIdentifier: "test-missing-marker",
      knownNames: [{ value: "Nadia", marker: "[PRENOM_DEMANDEUR]" }],
      fetchImpl: async () => new Response(JSON.stringify({
        output: [{ content: [{ type: "output_text", text: JSON.stringify({
          translatedText: "مرحبًا، تم تسجيل طلبكم.",
          backTranslationFr: "Bonjour, votre demande est prise en charge.",
          warnings: [],
        }) }] }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    }),
    (error) => error instanceof SupportTranslationFailure && error.code === "invalid_output"
  );
});

test("accepts only a useful non-French target language and preserves reply paragraphs", () => {
  assert.equal(supportTranslationTargetLanguage(" arabe "), "arabe");
  assert.equal(supportTranslationTargetLanguage("français"), null);
  assert.equal(supportTranslationTargetLanguage("indéterminée"), null);
  assert.equal(supportTranslationTargetLanguage("arabe<script>"), null);
  assert.equal(normalizeSupportReplyText("Bonjour\n\nVotre demande est reçue."), "Bonjour\n\nVotre demande est reçue.");
});

test("requires an authenticated scoped agent and keeps sensitive translations deterministic", () => {
  assert.match(translateRoute, /requireSupportAgent\(req\)/);
  assert.match(translateRoute, /assertSupportRequestAccess\(access, request\.assignedTeam\)/);
  assert.match(translateRoute, /scope: "agent_translation_user"/);
  assert.match(translateRoute, /sourceMessage !== SUPPORT_IDENTITY_VERIFICATION_MESSAGE/);
  assert.match(translateRoute, /personalHash\(`support-translation:\$\{user\.id\}`\)/);
});

test("never sends a generated translation without an exact receipt and human validation", () => {
  assert.match(replyRoute, /translation\.validated !== true/);
  assert.match(replyRoute, /verifySupportTranslationReceipt/);
  assert.match(replyRoute, /translatedReply\.sourceMessage !== SUPPORT_IDENTITY_VERIFICATION_MESSAGE/);
  assert.match(replyRoute, /translationHumanValidated: Boolean\(translatedReply\)/);
  assert.match(agentPage, /J’ai comparé les deux versions/);
  assert.match(agentPage, /translationNeedsDecision/);
  assert.match(agentPage, /validated: true/);
  assert.match(agentPage, /Contrôle du sens en français/);
});
