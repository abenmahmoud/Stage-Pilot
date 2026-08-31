import { supportTranslationTargetLanguage } from "./support-reply-policy.js";

const INPUT_FIELDS = new Set(["sourceMessage"]);
const PAYLOAD_FIELDS = new Set(["translation"]);
const TRANSLATION_FIELDS = new Set([
  "translatedText",
  "backTranslationFr",
  "warnings",
  "targetLanguage",
  "receipt",
  "expiresAt",
]);
const RECEIPT_PATTERN = /^[A-Za-z0-9_-]{1,1800}\.[A-Za-z0-9_-]{16,200}$/;

export type SupportAgentTranslationInput = {
  sourceMessage: string;
};

export type SupportAgentTranslationPayload = {
  translation: {
    translatedText: string;
    backTranslationFr: string;
    warnings: string[];
    targetLanguage: string;
    receipt: string;
    expiresAt: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactFields(value: Record<string, unknown>, fields: Set<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === fields.size && keys.every((key) => fields.has(key));
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isCanonicalDate(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 40) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export function isSupportAgentTranslationInput(
  value: unknown
): value is SupportAgentTranslationInput {
  return isRecord(value)
    && hasExactFields(value, INPUT_FIELDS)
    && isBoundedText(value.sourceMessage, 5_000);
}

export function isValidSupportAgentTranslationPayload(
  value: unknown,
  options: { expectedTargetLanguage: string; now?: number }
): value is SupportAgentTranslationPayload {
  if (!isRecord(value)
    || !hasExactFields(value, PAYLOAD_FIELDS)
    || !isRecord(value.translation)
    || !hasExactFields(value.translation, TRANSLATION_FIELDS)) {
    return false;
  }
  const translation = value.translation;
  const targetLanguage = supportTranslationTargetLanguage(translation.targetLanguage);
  if (!targetLanguage
    || targetLanguage !== translation.targetLanguage
    || targetLanguage !== options.expectedTargetLanguage
    || !isBoundedText(translation.translatedText, 10_000)
    || !isBoundedText(translation.backTranslationFr, 10_000)
    || !Array.isArray(translation.warnings)
    || translation.warnings.length > 4
    || translation.warnings.some((warning) => !isBoundedText(warning, 180))
    || new Set(translation.warnings).size !== translation.warnings.length
    || typeof translation.receipt !== "string"
    || !RECEIPT_PATTERN.test(translation.receipt)
    || !isCanonicalDate(translation.expiresAt)) {
    return false;
  }
  const now = options.now ?? Date.now();
  const expiresAt = Date.parse(translation.expiresAt);
  return expiresAt >= now && expiresAt <= now + (16 * 60_000);
}
