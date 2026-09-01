const CATEGORIES = [
  "inscription",
  "affectation_classe",
  "documents_scolarite",
  "ent",
  "email_academique",
  "ordinateur",
  "logiciel",
  "restauration_bourse",
  "orientation_formation",
  "vie_scolaire",
  "autre",
] as const;
const REQUESTER_TYPES = ["eleve", "parent", "professeur", "personnel", "autre", "inconnu"] as const;
const URGENCIES = ["faible", "normale", "urgente"] as const;
const CONFIDENCES = ["high", "medium", "low"] as const;
const SCOPES = [
  "school_support",
  "education_help",
  "wellbeing",
  "privacy_request",
  "out_of_scope",
  "unknown",
] as const;
const ACTIONS = ["continue", "offer_case", "human_transfer", "stop"] as const;

const MAX_CONVERSATION_TURNS = 10;
const RECEIPT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const PAYLOAD_FIELDS = new Set([
  "reply",
  "category",
  "requesterType",
  "urgency",
  "confidence",
  "missingInformation",
  "suggestedDocuments",
  "readyToCreate",
  "safetyNotice",
  "detectedLanguage",
  "internalSummaryFr",
  "usedAi",
  "scope",
  "action",
  "turnCount",
  "remainingTurns",
  "limitReached",
  "sourceReferences",
  "routingReceipt",
  "routingReceiptExpiresAt",
  "normalizationReceipt",
  "normalizationReceiptExpiresAt",
  "requestActionAuthorized",
]);
const SOURCE_FIELDS = new Set(["title", "updatedAt"]);

export const SUPPORT_ASSISTANT_PAYLOAD_LIMITS = Object.freeze({
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

function isKnownValue<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && allowed.includes(value as T[number]);
}

function isBoundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function isNullableBoundedText(value: unknown, maximum: number): value is string | null {
  return value === null || isBoundedText(value, maximum);
}

function isBoundedTextList(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length <= SUPPORT_ASSISTANT_PAYLOAD_LIMITS.listItems
    && value.every((item) => isBoundedText(item, SUPPORT_ASSISTANT_PAYLOAD_LIMITS.listItem));
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string"
    && ISO_DATE_PATTERN.test(value)
    && Number.isFinite(Date.parse(value));
}

function isValidSourceReference(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, SOURCE_FIELDS)
    && isBoundedText(value.title, SUPPORT_ASSISTANT_PAYLOAD_LIMITS.sourceTitle)
    && isIsoDate(value.updatedAt);
}

function hasValidReceiptPair(value: Record<string, unknown>, nowMs: number): boolean {
  if (value.routingReceipt === null && value.routingReceiptExpiresAt === null) {
    return value.requestActionAuthorized === false;
  }
  if (typeof value.routingReceipt !== "string"
    || value.routingReceipt.length < 80
    || value.routingReceipt.length > SUPPORT_ASSISTANT_PAYLOAD_LIMITS.receipt
    || !RECEIPT_PATTERN.test(value.routingReceipt)
    || !isIsoDate(value.routingReceiptExpiresAt)) {
    return false;
  }
  const expiresAt = Date.parse(value.routingReceiptExpiresAt);
  return expiresAt >= nowMs - 30_000
    && expiresAt <= nowMs + SUPPORT_ASSISTANT_PAYLOAD_LIMITS.receiptLifetimeMs;
}

function hasValidNormalizationReceipt(value: Record<string, unknown>, nowMs: number): boolean {
  if (value.normalizationReceipt === null && value.normalizationReceiptExpiresAt === null) return true;
  if (value.usedAi !== true || !value.internalSummaryFr || !value.detectedLanguage
    || typeof value.normalizationReceipt !== "string"
    || value.normalizationReceipt.length < 80 || value.normalizationReceipt.length > SUPPORT_ASSISTANT_PAYLOAD_LIMITS.receipt
    || !RECEIPT_PATTERN.test(value.normalizationReceipt) || !isIsoDate(value.normalizationReceiptExpiresAt)) return false;
  const expiresAt = Date.parse(value.normalizationReceiptExpiresAt);
  return expiresAt >= nowMs - 30_000
    && expiresAt <= nowMs + SUPPORT_ASSISTANT_PAYLOAD_LIMITS.receiptLifetimeMs;
}

export function isValidSupportAssistantPayload(value: unknown, nowMs = Date.now()): boolean {
  if (!isRecord(value)
    || !hasOnlyKeys(value, PAYLOAD_FIELDS)
    || !Number.isFinite(nowMs)
    || !isBoundedText(value.reply, SUPPORT_ASSISTANT_PAYLOAD_LIMITS.reply)
    || !isKnownValue(value.category, CATEGORIES)
    || !isKnownValue(value.requesterType, REQUESTER_TYPES)
    || !isKnownValue(value.urgency, URGENCIES)
    || !isKnownValue(value.confidence, CONFIDENCES)
    || !isBoundedTextList(value.missingInformation)
    || !isBoundedTextList(value.suggestedDocuments)
    || typeof value.readyToCreate !== "boolean"
    || !isNullableBoundedText(value.safetyNotice, SUPPORT_ASSISTANT_PAYLOAD_LIMITS.safetyNotice)
    || !isNullableBoundedText(value.detectedLanguage, SUPPORT_ASSISTANT_PAYLOAD_LIMITS.detectedLanguage)
    || !isNullableBoundedText(value.internalSummaryFr, SUPPORT_ASSISTANT_PAYLOAD_LIMITS.internalSummaryFr)
    || typeof value.usedAi !== "boolean"
    || !isKnownValue(value.scope, SCOPES)
    || !isKnownValue(value.action, ACTIONS)
    || !Number.isSafeInteger(value.turnCount)
    || Number(value.turnCount) < 0
    || Number(value.turnCount) > MAX_CONVERSATION_TURNS
    || !Number.isSafeInteger(value.remainingTurns)
    || Number(value.remainingTurns) !== Math.max(0, MAX_CONVERSATION_TURNS - Number(value.turnCount))
    || typeof value.limitReached !== "boolean"
    || !Array.isArray(value.sourceReferences)
    || value.sourceReferences.length > SUPPORT_ASSISTANT_PAYLOAD_LIMITS.sources
    || !value.sourceReferences.every(isValidSourceReference)
    || typeof value.requestActionAuthorized !== "boolean"
    || !hasValidReceiptPair(value, nowMs)
    || !hasValidNormalizationReceipt(value, nowMs)
  ) {
    return false;
  }

  const sourceKeys = value.sourceReferences.map((source) => {
    const record = source as Record<string, unknown>;
    return `${String(record.title)}\0${String(record.updatedAt)}`;
  });
  if (new Set(sourceKeys).size !== sourceKeys.length) return false;

  if (value.action === "offer_case" || value.action === "human_transfer") {
    if (!value.readyToCreate) return false;
  }
  if (value.requestActionAuthorized) {
    return value.readyToCreate
      && (value.action === "offer_case" || value.action === "human_transfer");
  }
  return true;
}
