import {
  IDENTITY_LOOKUP_SEARCH_TYPES,
  type IdentityLookupResult,
} from "./identity-directory-lookup.js";

const LOOKUP_STATUSES = [
  "queued",
  "processing",
  "completed",
  "not_found",
  "ambiguous",
  "failed",
  "expired",
] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/;
const RECEIPT_PATTERN = /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

const AVAILABILITY_FIELDS = new Set([
  "available",
  "configured",
  "hasActiveDirectory",
  "ttlSeconds",
]);
const CREATION_FIELDS = new Set(["requestId", "status", "receipt", "expiresAt"]);
const STATUS_FIELDS = new Set(["requestId", "status", "expiresAt"]);
const COMPLETED_FIELDS = new Set(["requestId", "status", "result", "expiresAt"]);
const RESULT_FIELDS = new Set([
  "firstName",
  "lastName",
  "personType",
  "classRef",
  "serviceCode",
  "personRef",
  "matchedBy",
  "directoryVersionId",
  "directoryActivatedAt",
]);

export const IDENTITY_LOOKUP_PAYLOAD_LIMITS = Object.freeze({
  ttlSeconds: 300,
  receipt: 2_048,
  receiptLifetimeMs: 330_000,
  name: 200,
});

export type IdentityLookupAvailabilityPayload = {
  available: boolean;
  configured: boolean;
  hasActiveDirectory: boolean;
  ttlSeconds: number;
};

export type IdentityLookupCreationPayload = {
  requestId: string;
  status: "queued";
  receipt: string;
  expiresAt: string;
};

export type IdentityLookupStatus = (typeof LOOKUP_STATUSES)[number];

export type IdentityLookupStatusPayload =
  | {
      requestId: string;
      status: Exclude<IdentityLookupStatus, "completed">;
      expiresAt: string;
    }
  | {
      requestId: string;
      status: "completed";
      result: IdentityLookupResult;
      expiresAt: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

function isCanonicalIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isBoundedName(value: unknown): value is string {
  return typeof value === "string"
    && value.trim().length > 0
    && value === value.trim()
    && value.length <= IDENTITY_LOOKUP_PAYLOAD_LIMITS.name
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function isOptionalReference(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && REFERENCE_PATTERN.test(value));
}

function isLookupResult(value: unknown): value is IdentityLookupResult {
  if (!isRecord(value)
    || !hasExactKeys(value, RESULT_FIELDS)
    || !isBoundedName(value.firstName)
    || !isBoundedName(value.lastName)
    || !(value.personType === "student" || value.personType === "guardian" || value.personType === "staff")
    || !isOptionalReference(value.classRef)
    || !isOptionalReference(value.serviceCode)
    || typeof value.personRef !== "string"
    || !REFERENCE_PATTERN.test(value.personRef)
    || typeof value.matchedBy !== "string"
    || !IDENTITY_LOOKUP_SEARCH_TYPES.includes(value.matchedBy as IdentityLookupResult["matchedBy"])
    || typeof value.directoryVersionId !== "string"
    || !UUID_PATTERN.test(value.directoryVersionId)
    || !isCanonicalIsoDate(value.directoryActivatedAt)) {
    return false;
  }
  if (value.personType === "student" && value.classRef === null) return false;
  if (value.personType === "staff" && value.serviceCode === null) return false;
  return true;
}

export function isIdentityLookupAvailabilityPayload(
  value: unknown
): value is IdentityLookupAvailabilityPayload {
  return isRecord(value)
    && hasExactKeys(value, AVAILABILITY_FIELDS)
    && typeof value.available === "boolean"
    && typeof value.configured === "boolean"
    && typeof value.hasActiveDirectory === "boolean"
    && value.ttlSeconds === IDENTITY_LOOKUP_PAYLOAD_LIMITS.ttlSeconds
    && value.available === (value.configured && value.hasActiveDirectory);
}

export function isIdentityLookupCreationPayload(
  value: unknown,
  nowMs = Date.now()
): value is IdentityLookupCreationPayload {
  if (!isRecord(value)
    || !hasExactKeys(value, CREATION_FIELDS)
    || typeof value.requestId !== "string"
    || !UUID_PATTERN.test(value.requestId)
    || value.status !== "queued"
    || typeof value.receipt !== "string"
    || value.receipt.length < 80
    || value.receipt.length > IDENTITY_LOOKUP_PAYLOAD_LIMITS.receipt
    || !RECEIPT_PATTERN.test(value.receipt)
    || !isCanonicalIsoDate(value.expiresAt)
    || !Number.isFinite(nowMs)) {
    return false;
  }
  const expiresAt = Date.parse(value.expiresAt);
  return expiresAt > nowMs
    && expiresAt <= nowMs + IDENTITY_LOOKUP_PAYLOAD_LIMITS.receiptLifetimeMs;
}

export function isIdentityLookupStatusPayload(
  value: unknown,
  expectedRequestId?: string
): value is IdentityLookupStatusPayload {
  if (!isRecord(value)
    || typeof value.requestId !== "string"
    || !UUID_PATTERN.test(value.requestId)
    || (expectedRequestId !== undefined && value.requestId !== expectedRequestId)
    || typeof value.status !== "string"
    || !LOOKUP_STATUSES.includes(value.status as IdentityLookupStatus)
    || !isCanonicalIsoDate(value.expiresAt)) {
    return false;
  }
  if (value.status === "completed") {
    return hasExactKeys(value, COMPLETED_FIELDS) && isLookupResult(value.result);
  }
  return hasExactKeys(value, STATUS_FIELDS);
}
