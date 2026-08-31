import { SUPPORT_CALLBACK_STATUSES } from "./support-callback-policy.js";
import {
  isKnownSupportQueueCategory,
  isKnownSupportQueueService,
  isSupportQueueDate,
  isSupportQueuePublicCode,
  isSupportQueueUuid,
  isValidSupportQueueAccess,
  isValidSupportQueueCoreRow,
} from "./support-queue-payload-policy.js";

const IDENTITY_STATUSES = ["non_verifiee", "contact_verifie", "identite_confirmee"] as const;
const IDENTITY_METHODS = ["email_magic_link", "phone_callback", "official_roster"] as const;
const MESSAGE_DIRECTIONS = ["inbound", "outbound", "internal"] as const;
const MESSAGE_CHANNELS = ["web", "email", "sms", "phone", "system"] as const;
const MESSAGE_DELIVERY_STATUSES = [
  "stored",
  "received",
  "queued",
  "callback_required",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "deferred",
  "soft_bounce",
  "hard_bounce",
  "blocked",
  "spam",
  "invalid",
] as const;
const ATTACHMENT_DIRECTIONS = ["requester", "agent"] as const;
const ATTACHMENT_SCAN_STATUSES = [
  "awaiting_upload",
  "quarantine",
  "clean",
  "blocked",
  "scan_error",
  "removal_pending",
] as const;
const DUPLICATE_REVIEW_STATUSES = ["pending", "confirmed", "dismissed"] as const;
const ROUTING_REVIEW_STATUSES = ["pending", "confirmed", "corrected"] as const;

export const SUPPORT_AGENT_DETAIL_LIMITS = Object.freeze({
  contacts: 10,
  messages: 500,
  attachments: 10,
  callbacks: 100,
});
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const REQUEST_FIELDS = new Set([
  "publicCode", "requesterType", "requesterFirstName", "requesterLastName",
  "beneficiaryType", "beneficiaryFirstName", "beneficiaryLastName", "subjectContext",
  "category", "subject", "description", "status", "priority", "assignedTo",
  "assignedTeam", "slaDueAt", "createdAt", "updatedAt", "identityStatus",
  "identityMethod", "identityVerifiedAt",
]);
const CONTACT_FIELDS = new Set(["id", "channel", "value", "isPrimary", "isVerified"]);
const MESSAGE_FIELDS = new Set([
  "id", "direction", "channel", "authorLabel", "bodyText", "deliveryStatus", "createdAt",
]);
const ATTACHMENT_FIELDS = new Set([
  "id", "messageId", "direction", "originalName", "sizeBytes", "scanStatus",
  "releasedAt", "createdAt", "canAttachToReply", "canRemoveDraft",
]);
const CALLBACK_FIELDS = new Set([
  "id", "phoneContactId", "dueAt", "status", "outcome", "completedAt", "createdAt",
  "assigned", "assignedToCurrentAgent",
]);
const DUPLICATE_REVIEW_FIELDS = new Set(["status", "reason", "decidedAt", "candidatePublicCode"]);
const ROUTING_REVIEW_FIELDS = new Set([
  "status", "usedAi", "initialCategory", "initialService", "createdAt", "reviewedAt",
]);
const ACCESS_FIELDS = new Set([
  "role", "label", "serviceCodes", "canViewAll", "canRoute", "canManageTemplates",
]);
const DETAIL_FIELDS = new Set([
  "request", "contacts", "messages", "attachments", "callbacks", "duplicateReview",
  "routingReview", "access",
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

function isNullableText(value: unknown, maximum: number): value is string | null {
  return value === null || isBoundedText(value, maximum);
}

function isKnownValue<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && allowed.includes(value as T[number]);
}

function isNullableDate(value: unknown): value is string | null {
  return value === null || isSupportQueueDate(value);
}

function isNullableUuid(value: unknown): value is string | null {
  return value === null || isSupportQueueUuid(value);
}

function isSafeFileSize(value: unknown): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 1
    && value <= MAX_FILE_BYTES;
}

function isChronological(rows: Array<{ createdAt: string }>): boolean {
  return rows.every((row, index) => (
    index === 0 || Date.parse(rows[index - 1].createdAt) <= Date.parse(row.createdAt)
  ));
}

function hasUniqueIds(rows: Array<{ id: string }>): boolean {
  return new Set(rows.map((row) => row.id)).size === rows.length;
}

export function isValidSupportAgentRequest(value: unknown): boolean {
  if (!isRecord(value) || !isValidSupportQueueCoreRow(value)) return false;
  const record = value as unknown as Record<string, unknown>;
  const identityStatus = record.identityStatus;
  const identityMethod = record.identityMethod;
  const identityVerifiedAt = record.identityVerifiedAt;
  if (!hasOnlyKeys(record, REQUEST_FIELDS)
    || !isBoundedText(record.description, 5_000)
    || !isKnownValue(identityStatus, IDENTITY_STATUSES)
    || !(identityMethod === null || isKnownValue(identityMethod, IDENTITY_METHODS))
    || !isNullableDate(identityVerifiedAt)
    || Date.parse(record.createdAt as string) > Date.parse(record.updatedAt as string)
  ) {
    return false;
  }
  if (identityStatus === "non_verifiee") {
    return identityMethod === null && identityVerifiedAt === null;
  }
  if (identityStatus === "contact_verifie") {
    return identityMethod === "email_magic_link" || identityMethod === "phone_callback";
  }
  return identityMethod === "official_roster" && identityVerifiedAt !== null;
}

export function isValidSupportAgentContact(value: unknown): boolean {
  if (!isRecord(value)
    || !hasOnlyKeys(value, CONTACT_FIELDS)
    || !isSupportQueueUuid(value.id)
    || !["email", "phone"].includes(String(value.channel))
    || typeof value.isPrimary !== "boolean"
    || typeof value.isVerified !== "boolean"
  ) {
    return false;
  }
  if (value.channel === "email") {
    return isBoundedText(value.value, 254) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.value);
  }
  return isBoundedText(value.value, 30) && /^\+?\d{10,15}$/.test(value.value);
}

export function isValidSupportAgentMessage(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, MESSAGE_FIELDS)
    && isSupportQueueUuid(value.id)
    && isKnownValue(value.direction, MESSAGE_DIRECTIONS)
    && isKnownValue(value.channel, MESSAGE_CHANNELS)
    && isNullableText(value.authorLabel, 180)
    && isBoundedText(value.bodyText, 20_000)
    && isKnownValue(value.deliveryStatus, MESSAGE_DELIVERY_STATUSES)
    && isSupportQueueDate(value.createdAt);
}

export function isValidSupportAgentAttachment(value: unknown): boolean {
  if (!isRecord(value)
    || !hasOnlyKeys(value, ATTACHMENT_FIELDS)
    || !isSupportQueueUuid(value.id)
    || !isNullableUuid(value.messageId)
    || !isKnownValue(value.direction, ATTACHMENT_DIRECTIONS)
    || !isBoundedText(value.originalName, 180)
    || !isSafeFileSize(value.sizeBytes)
    || !isKnownValue(value.scanStatus, ATTACHMENT_SCAN_STATUSES)
    || !isNullableDate(value.releasedAt)
    || !isSupportQueueDate(value.createdAt)
    || typeof value.canAttachToReply !== "boolean"
    || typeof value.canRemoveDraft !== "boolean"
  ) {
    return false;
  }
  const isAgentDraft = value.direction === "agent"
    && value.messageId === null
    && value.releasedAt === null;
  const expectedAttach = isAgentDraft && value.scanStatus === "clean";
  const expectedRemoval = isAgentDraft
    && ["clean", "blocked", "scan_error", "removal_pending"].includes(String(value.scanStatus));
  const releaseStateIsCoherent = value.direction === "requester"
    ? value.releasedAt === null
    : isAgentDraft || (value.messageId !== null && value.releasedAt !== null);
  return releaseStateIsCoherent
    && value.canAttachToReply === expectedAttach
    && value.canRemoveDraft === expectedRemoval;
}

export function isValidSupportAgentCallback(value: unknown): boolean {
  if (!isRecord(value)
    || !hasOnlyKeys(value, CALLBACK_FIELDS)
    || !isSupportQueueUuid(value.id)
    || !isSupportQueueUuid(value.phoneContactId)
    || !isNullableDate(value.dueAt)
    || !isKnownValue(value.status, SUPPORT_CALLBACK_STATUSES)
    || !isNullableText(value.outcome, 1_000)
    || !isNullableDate(value.completedAt)
    || !isSupportQueueDate(value.createdAt)
    || typeof value.assigned !== "boolean"
    || typeof value.assignedToCurrentAgent !== "boolean"
    || (value.assignedToCurrentAgent && !value.assigned)
  ) {
    return false;
  }
  if (value.status === "todo") {
    return !value.assigned && !value.assignedToCurrentAgent
      && value.outcome === null && value.completedAt === null;
  }
  if (value.status === "in_progress") {
    return value.assigned && value.outcome === null && value.completedAt === null;
  }
  return value.assigned
    && value.outcome !== null
    && value.completedAt !== null
    && Date.parse(value.createdAt as string) <= Date.parse(value.completedAt);
}

export function isValidSupportAgentDuplicateReview(value: unknown): boolean {
  if (value === null) return true;
  if (!isRecord(value)
    || !hasOnlyKeys(value, DUPLICATE_REVIEW_FIELDS)
    || !isKnownValue(value.status, DUPLICATE_REVIEW_STATUSES)
    || !isBoundedText(value.reason, 200)
    || !isNullableDate(value.decidedAt)
    || !(value.candidatePublicCode === null || isSupportQueuePublicCode(value.candidatePublicCode))
  ) {
    return false;
  }
  return value.status === "pending" ? value.decidedAt === null : value.decidedAt !== null;
}

export function isValidSupportAgentRoutingReview(value: unknown): boolean {
  if (value === null) return true;
  if (!isRecord(value)
    || !hasOnlyKeys(value, ROUTING_REVIEW_FIELDS)
    || !isKnownValue(value.status, ROUTING_REVIEW_STATUSES)
    || typeof value.usedAi !== "boolean"
    || !isKnownSupportQueueCategory(value.initialCategory)
    || !isKnownSupportQueueService(value.initialService)
    || value.initialService === null
    || !isSupportQueueDate(value.createdAt)
    || !isNullableDate(value.reviewedAt)
  ) {
    return false;
  }
  return value.status === "pending" ? value.reviewedAt === null : value.reviewedAt !== null;
}

export function isValidSupportAgentDetailPayload(value: unknown): boolean {
  if (!isRecord(value)
    || !hasOnlyKeys(value, DETAIL_FIELDS)
    || !isValidSupportAgentRequest(value.request)
    || !Array.isArray(value.contacts)
    || value.contacts.length > SUPPORT_AGENT_DETAIL_LIMITS.contacts
    || !value.contacts.every(isValidSupportAgentContact)
    || !Array.isArray(value.messages)
    || value.messages.length > SUPPORT_AGENT_DETAIL_LIMITS.messages
    || !value.messages.every(isValidSupportAgentMessage)
    || !Array.isArray(value.attachments)
    || value.attachments.length > SUPPORT_AGENT_DETAIL_LIMITS.attachments
    || !value.attachments.every(isValidSupportAgentAttachment)
    || !Array.isArray(value.callbacks)
    || value.callbacks.length > SUPPORT_AGENT_DETAIL_LIMITS.callbacks
    || !value.callbacks.every(isValidSupportAgentCallback)
    || !isValidSupportAgentDuplicateReview(value.duplicateReview)
    || !isValidSupportAgentRoutingReview(value.routingReview)
    || !isRecord(value.access)
    || !hasOnlyKeys(value.access, ACCESS_FIELDS)
    || !isValidSupportQueueAccess(value.access)
  ) {
    return false;
  }

  const contacts = value.contacts as Array<{ id: string; channel: string }>;
  const messages = value.messages as Array<{ id: string; createdAt: string }>;
  const attachments = value.attachments as Array<{ id: string; messageId: string | null }>;
  const callbacks = value.callbacks as Array<{ id: string; phoneContactId: string; createdAt: string }>;
  const messageIds = new Set(messages.map((message) => message.id));
  const phoneContactIds = new Set(
    contacts.filter((contact) => contact.channel === "phone").map((contact) => contact.id)
  );

  return hasUniqueIds(contacts)
    && hasUniqueIds(messages)
    && hasUniqueIds(attachments)
    && hasUniqueIds(callbacks)
    && isChronological(messages)
    && isChronological(callbacks)
    && attachments.every((attachment) => attachment.messageId === null || messageIds.has(attachment.messageId))
    && callbacks.every((callback) => phoneContactIds.has(callback.phoneContactId));
}
