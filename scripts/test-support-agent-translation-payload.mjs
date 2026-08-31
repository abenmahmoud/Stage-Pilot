import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isSupportAgentTranslationInput,
  isValidSupportAgentTranslationPayload,
} from "../shared/support-agent-translation-payload-policy.ts";

const route = readFileSync(
  new URL("../api/support/agent/requests/[code]/translate.ts", import.meta.url),
  "utf8"
);
const client = readFileSync(
  new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
  "utf8"
);
const now = Date.parse("2026-09-01T10:00:00.000Z");

function validPayload() {
  return {
    translation: {
      translatedText: "مرحبًا، تم تسجيل طلبكم.",
      backTranslationFr: "Bonjour, votre demande est enregistrée.",
      warnings: [],
      targetLanguage: "arabe",
      receipt: `${"a".repeat(80)}.${"b".repeat(43)}`,
      expiresAt: new Date(now + 15 * 60_000).toISOString(),
    },
  };
}

test("accepts only one exact bounded translation command", () => {
  assert.equal(isSupportAgentTranslationInput({ sourceMessage: "Bonjour" }), true);
  assert.equal(isSupportAgentTranslationInput({ sourceMessage: "Bonjour", targetLanguage: "arabe" }), false);
  assert.equal(isSupportAgentTranslationInput({ sourceMessage: "" }), false);
  assert.equal(isSupportAgentTranslationInput({ sourceMessage: 42 }), false);
  assert.equal(isSupportAgentTranslationInput({ sourceMessage: "x".repeat(5_001) }), false);
});

test("accepts one exact bounded translation response for the expected language", () => {
  assert.equal(isValidSupportAgentTranslationPayload(validPayload(), {
    expectedTargetLanguage: "arabe",
    now,
  }), true);
});

test("rejects hidden fields, language substitution and oversized content", () => {
  const base = validPayload();
  for (const candidate of [
    { ...base, internalPrompt: "hidden" },
    { translation: { ...base.translation, provider: "hidden" } },
    { translation: { ...base.translation, targetLanguage: "anglais" } },
    { translation: { ...base.translation, translatedText: "x".repeat(10_001) } },
    { translation: { ...base.translation, warnings: ["A", "A"] } },
    { translation: { ...base.translation, receipt: "not-signed" } },
  ]) {
    assert.equal(isValidSupportAgentTranslationPayload(candidate, {
      expectedTargetLanguage: "arabe",
      now,
    }), false);
  }
});

test("rejects expired, implausibly distant and non-canonical expiry dates", () => {
  const base = validPayload();
  for (const expiresAt of [
    new Date(now - 1).toISOString(),
    new Date(now + 17 * 60_000).toISOString(),
    "2026-09-01T12:15:00+02:00",
    "invalid",
  ]) {
    assert.equal(isValidSupportAgentTranslationPayload({
      translation: { ...base.translation, expiresAt },
    }, { expectedTargetLanguage: "arabe", now }), false);
  }
});

test("validates route parameters and input before translation work", () => {
  assert.match(route, /typeof req\.query\.code === "string" \? req\.query\.code : null/);
  assert.doesNotMatch(route, /Array\.isArray\(req\.query\.code\).*\[0\]/);
  assert.match(route, /isSupportAgentTranslationInput\(req\.body\)[\s\S]*normalizeSupportReplyText\(req\.body\.sourceMessage/);
  assert.match(route, /isValidSupportAgentTranslationPayload\(payload,[\s\S]*return payload/);
});

test("validates the browser response against the language of the current request", () => {
  assert.match(client, /supportTranslationTargetLanguage\([\s\S]*request\?\.subjectContext\.detectedLanguage/);
  assert.match(client, /isValidSupportAgentTranslationPayload\(payload, \{ expectedTargetLanguage \}\)/);
  assert.doesNotMatch(client, /function isAgentTranslationPayload/);
});
