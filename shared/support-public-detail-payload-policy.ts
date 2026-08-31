import {
  isKnownSupportQueueCategory,
  isSupportQueueDate,
  isSupportQueuePublicCode,
  isSupportQueueUuid,
} from "./support-queue-payload-policy.js";
import { SUPPORT_PUBLIC_DETAIL_LIMITS } from "./support-public-detail-limits.js";

const REQUESTER_TYPES = ["eleve", "parent", "professeur", "personnel", "autre"] as const;
const BENEFICIARY_TYPES = ["self", "eleve", "professeur", "personnel", "autre"] as const;
const REQUEST_STATUSES = [
  "nouveau", "a_qualifier", "assigne", "en_cours", "attente_demandeur",
  "attente_interne", "resolu", "clos", "indesirable",
] as const;
const PRIORITIES = ["p1", "p2", "p3", "p4"] as const;
const IDENTITY_STATUSES = ["non_verifiee", "contact_verifie", "identite_confirmee"] as const;
const IDENTITY_METHODS = ["email_magic_link", "phone_callback", "official_roster"] as const;
const MESSAGE_DIRECTIONS = ["inbound", "outbound"] as const;
const MESSAGE_CHANNELS = ["email", "phone", "web"] as const;
const MESSAGE_DELIVERY_STATUSES = [
  "stored", "received", "queued", "callback_required", "sent", "delivered",
  "opened", "clicked", "deferred", "soft_bounce", "hard_bounce", "blocked",
  "spam", "invalid",
] as const;
const ATTACHMENT_DIRECTIONS = ["requester", "agent"] as const;
const ATTACHMENT_SCAN_STATUSES = [
  "awaiting_upload", "quarantine", "clean", "blocked", "scan_error", "removal_pending",
] as const;
const REMOVABLE_REQUESTER_STATUSES = [
  "awaiting_upload", "blocked", "scan_error", "removal_pending",
] as const;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PUBLIC_CONTEXT_KEYS = [
  "className",
  "subjectArea",
  "schoolTrack",
  "languagePreference",
  "communicationSupport",
] as const;
const PUBLIC_CONTEXT_KEY_SET = new Set<string>(PUBLIC_CONTEXT_KEYS);

const DETAIL_FIELDS = new Set(["request", "messages", "attachments"]);
const REQUEST_FIELDS = new Set([
  "publicCode", "requesterType", "beneficiaryType", "subjectContext", "category",
  "subject", "status", "priority", "preferredChannel", "createdAt", "updatedAt",
  "resolvedAt", "identityStatus", "identityMethod", "identityVerifiedAt",
]);
const MESSAGE_FIELDS = new Set([
  "id", "direction", "channel", "authorLabel", "bodyText", "deliveryStatus", "createdAt",
]);
const ATTACHMENT_FIELDS = new Set([
  "id", "messageId", "direction", "documentType", "originalName", "detectedMime",
  "sizeBytes", "scanStatus", "canRemoveDraft", "createdAt",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

function isBoundedText(value: unknown, maximum: number, allowEmpty = false): value is string {
  return typeof value === "string"
    && value.length <= maximum
    && (allowEmpty || value.trim().length > 0);
}

function isKnownValue<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && allowed.includes(value as T[number]);
}

function isNullableDate(value: unknown): value is string | null {
  return value === null || isSupportQueueDate(value);
}

function isChronological(rows: Array<{ createdAt: string }>): boolean {
  return rows.every((row, index) => (
    index === 0 || Date.parse(rows[index - 1].createdAt) <= Date.parse(row.createdAt)
  ));
}

function hasUniqueIds(rows: Array<{ id: string }>): boolean {
  return new Set(rows.map((row) => row.id)).size === rows.length;
}

function isPublicContext(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= PUBLIC_CONTEXT_KEYS.length
    && entries.every(([key, item]) => (
      PUBLIC_CONTEXT_KEY_SET.has(key) && isBoundedText(item, 700, true)
    ));
}

export function selectSupportPublicSubjectContext(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const selected: Record<string, string> = {};
  for (const key of PUBLIC_CONTEXT_KEYS) {
    const item = value[key];
    if (isBoundedText(item, 700, true)) selected[key] = item;
  }
  return selected;
}

function isValidPublicRequest(value: unknown): boolean {
  if (!isRecord(value)
    || !hasOnlyKeys(value, REQUEST_FIELDS)
    || !isSupportQueuePublicCode(value.publicCode)
    || !isKnownValue(value.requesterType, REQUESTER_TYPES)
    || !isKnownValue(value.beneficiaryType, BENEFICIARY_TYPES)
    || !isPublicContext(value.subjectContext)
    || !isKnownSupportQueueCategory(value.category)
    || !isBoundedText(value.subject, 180)
    || !isKnownValue(value.status, REQUEST_STATUSES)
    || !isKnownValue(value.priority, PRIORITIES)
    || !isKnownValue(value.preferredChannel, MESSAGE_CHANNELS)
    || !isSupportQueueDate(value.createdAt)
    || !isSupportQueueDate(value.updatedAt)
    || !isNullableDate(value.resolvedAt)
    || !isKnownValue(value.identityStatus, IDENTITY_STATUSES)
    || !(value.identityMethod === null || isKnownValue(value.identityMethod, IDENTITY_METHODS))
    || !isNullableDate(value.identityVerifiedAt)
    || Date.parse(value.createdAt) > Date.parse(value.updatedAt)
    || (value.resolvedAt !== null && Date.parse(value.resolvedAt) < Date.parse(value.createdAt))
  ) {
    return false;
  }
  if (value.identityStatus === "non_verifiee") {
    return value.identityMethod === null && value.identityVerifiedAt === null;
  }
  if (value.identityStatus === "contact_verifie") {
    return value.identityMethod === "email_magic_link" || value.identityMethod === "phone_callback";
  }
  return value.identityMethod === "official_roster" && value.identityVerifiedAt !== null;
}

function isValidPublicMessage(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, MESSAGE_FIELDS)
    && isSupportQueueUuid(value.id)
    && isKnownValue(value.direction, MESSAGE_DIRECTIONS)
    && isKnownValue(value.channel, MESSAGE_CHANNELS)
    && (value.authorLabel === null || isBoundedText(value.authorLabel, 180))
    && isBoundedText(value.bodyText, 5_000)
    && isKnownValue(value.deliveryStatus, MESSAGE_DELIVERY_STATUSES)
    && isSupportQueueDate(value.createdAt);
}

function isValidPublicAttachment(value: unknown): boolean {
  if (!isRecord(value)
    || !hasOnlyKeys(value, ATTACHMENT_FIELDS)
    || !isSupportQueueUuid(value.id)
    || !(value.messageId === null || isSupportQueueUuid(value.messageId))
    || !isKnownValue(value.direction, ATTACHMENT_DIRECTIONS)
    || !isBoundedText(value.documentType, 100)
    || !isBoundedText(value.originalName, 255)
    || !(value.detectedMime === null || isBoundedText(value.detectedMime, 150))
    || !Number.isSafeInteger(value.sizeBytes)
    || Number(value.sizeBytes) < 1
    || Number(value.sizeBytes) > MAX_FILE_BYTES
    || !isKnownValue(value.scanStatus, ATTACHMENT_SCAN_STATUSES)
    || typeof value.canRemoveDraft !== "boolean"
    || !isSupportQueueDate(value.createdAt)
  ) {
    return false;
  }
  if (value.direction === "agent") {
    return value.messageId !== null && value.scanStatus === "clean" && !value.canRemoveDraft;
  }
  if (value.canRemoveDraft) {
    return value.messageId === null
      && isKnownValue(value.scanStatus, REMOVABLE_REQUESTER_STATUSES);
  }
  return true;
}

export function isValidSupportPublicDetailPayload(value: unknown): boolean {
  if (!isRecord(value)
    || !hasOnlyKeys(value, DETAIL_FIELDS)
    || !isValidPublicRequest(value.request)
    || !Array.isArray(value.messages)
    || value.messages.length > SUPPORT_PUBLIC_DETAIL_LIMITS.messages
    || !value.messages.every(isValidPublicMessage)
    || !Array.isArray(value.attachments)
    || value.attachments.length > SUPPORT_PUBLIC_DETAIL_LIMITS.attachments
    || !value.attachments.every(isValidPublicAttachment)
  ) {
    return false;
  }
  const messages = value.messages as Array<{ id: string; createdAt: string }>;
  const attachments = value.attachments as Array<{
    id: string;
    messageId: string | null;
    createdAt: string;
  }>;
  const messageIds = new Set(messages.map((message) => message.id));
  return hasUniqueIds(messages)
    && hasUniqueIds(attachments)
    && isChronological(messages)
    && isChronological(attachments)
    && attachments.every((attachment) => (
      attachment.messageId === null || messageIds.has(attachment.messageId)
    ));
}
