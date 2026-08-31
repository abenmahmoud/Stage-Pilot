import {
  isKnownSupportQueueCategory,
  isSupportQueueDate,
  isSupportQueuePublicCode,
} from "./support-queue-payload-policy.js";

const REQUEST_STATUSES = [
  "nouveau", "a_qualifier", "assigne", "en_cours", "attente_demandeur",
  "attente_interne", "resolu", "clos", "indesirable",
] as const;
const PRIORITIES = ["p1", "p2", "p3", "p4"] as const;

export const SUPPORT_PUBLIC_LIST_LIMITS = Object.freeze({ requests: 200 });

const PAYLOAD_FIELDS = new Set(["requests"]);
const REQUEST_FIELDS = new Set([
  "publicCode", "subject", "category", "status", "priority", "createdAt", "updatedAt",
]);

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

function isValidPublicRequestSummary(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, REQUEST_FIELDS)
    && isSupportQueuePublicCode(value.publicCode)
    && isBoundedText(value.subject, 180)
    && isKnownSupportQueueCategory(value.category)
    && isKnownValue(value.status, REQUEST_STATUSES)
    && isKnownValue(value.priority, PRIORITIES)
    && isSupportQueueDate(value.createdAt)
    && isSupportQueueDate(value.updatedAt)
    && Date.parse(value.createdAt) <= Date.parse(value.updatedAt);
}

export function isValidSupportPublicListPayload(value: unknown): boolean {
  if (!isRecord(value)
    || !hasOnlyKeys(value, PAYLOAD_FIELDS)
    || !Array.isArray(value.requests)
    || value.requests.length > SUPPORT_PUBLIC_LIST_LIMITS.requests
    || !value.requests.every(isValidPublicRequestSummary)
  ) {
    return false;
  }
  const requests = value.requests as Array<{
    publicCode: string;
    createdAt: string;
  }>;
  return new Set(requests.map((request) => request.publicCode)).size === requests.length
    && requests.every((request, index) => (
      index === 0
      || Date.parse(requests[index - 1].createdAt) >= Date.parse(request.createdAt)
    ));
}
