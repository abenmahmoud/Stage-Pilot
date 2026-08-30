import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const CONTRACT_VERSION = 1;
const MAX_CONTACTS_PER_PAGE = 500;
const MAX_GROUPS = 200;
const MAX_TOKEN_LENGTH = 256 * 1024;
const MAX_TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 30 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REF_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{7,119}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const RESOLUTION_FIELDS = new Set([
  "v",
  "institutionId",
  "resolutionId",
  "communicationId",
  "versionId",
  "version",
  "snapshotHash",
  "generatedAt",
  "expiresAt",
  "pageIndex",
  "pageCount",
  "groupRefs",
  "contacts",
]);
const CONTACT_FIELDS = new Set(["contactRef", "eligibility"]);

export type CommunicationRecipientResolutionContext = {
  institutionId: string;
  communicationId: string;
  versionId: string;
  version: number;
  snapshotHash: string;
  groupRefs: string[];
};

export type CommunicationRecipientResolution = {
  v: 1;
  institutionId: string;
  resolutionId: string;
  communicationId: string;
  versionId: string;
  version: number;
  snapshotHash: string;
  generatedAt: string;
  expiresAt: string;
  pageIndex: number;
  pageCount: number;
  groupRefs: string[];
  contacts: Array<{
    contactRef: string;
    eligibility: "active_validated_email";
  }>;
};

export type VerifiedCommunicationRecipientResolution = CommunicationRecipientResolution & {
  resolutionHash: string;
};

export type PreparedCommunicationDelivery = {
  institutionId: string;
  communicationId: string;
  versionId: string;
  version: number;
  contactRef: string;
  channel: "email";
  status: "prepared";
  idempotencyKeyHash: string;
};

export class CommunicationRecipientResolutionError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("La résolution de destinataires est invalide");
    this.reason = reason;
  }
}

function validSecret(value: string | undefined): value is string {
  return typeof value === "string" && value.length >= 32 && value.length <= 512;
}

function exactObject(value: unknown, fields: Set<string>, reason: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CommunicationRecipientResolutionError(reason);
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !fields.has(key))) {
    throw new CommunicationRecipientResolutionError("unknown_field");
  }
  return input;
}

function parseDate(value: unknown, reason: string): string {
  if (typeof value !== "string" || !ISO_UTC_PATTERN.test(value)) {
    throw new CommunicationRecipientResolutionError(reason);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new CommunicationRecipientResolutionError(reason);
  }
  return value;
}

function opaqueRef(value: unknown, reason: string): string {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    !REF_PATTERN.test(value) ||
    /@|mailto:|https?:|tel:|www\./i.test(value)
  ) {
    throw new CommunicationRecipientResolutionError(reason);
  }
  return value;
}

function normalizedGroupRefs(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_GROUPS) {
    throw new CommunicationRecipientResolutionError("groups_invalid");
  }
  const refs = value.map((entry) => opaqueRef(entry, "group_ref_invalid"));
  if (new Set(refs).size !== refs.length) {
    throw new CommunicationRecipientResolutionError("group_ref_duplicate");
  }
  return refs.sort();
}

function parseResolution(
  value: unknown,
  expected: CommunicationRecipientResolutionContext,
  now: Date
): CommunicationRecipientResolution {
  const input = exactObject(value, RESOLUTION_FIELDS, "resolution_invalid");
  if (input.v !== CONTRACT_VERSION) throw new CommunicationRecipientResolutionError("version_invalid");
  for (const key of ["institutionId", "resolutionId", "communicationId", "versionId"] as const) {
    if (typeof input[key] !== "string" || !UUID_PATTERN.test(input[key] as string)) {
      throw new CommunicationRecipientResolutionError(`${key}_invalid`);
    }
  }
  if (
    input.institutionId !== expected.institutionId ||
    input.communicationId !== expected.communicationId ||
    input.versionId !== expected.versionId
  ) {
    throw new CommunicationRecipientResolutionError("scope_mismatch");
  }
  if (!Number.isInteger(input.version) || Number(input.version) < 1 || Number(input.version) > 10_000) {
    throw new CommunicationRecipientResolutionError("content_version_invalid");
  }
  if (input.version !== expected.version) throw new CommunicationRecipientResolutionError("scope_mismatch");
  if (typeof input.snapshotHash !== "string" || !HASH_PATTERN.test(input.snapshotHash)) {
    throw new CommunicationRecipientResolutionError("snapshot_hash_invalid");
  }
  if (!HASH_PATTERN.test(expected.snapshotHash) || input.snapshotHash !== expected.snapshotHash) {
    throw new CommunicationRecipientResolutionError("scope_mismatch");
  }
  const generatedAt = parseDate(input.generatedAt, "generated_at_invalid");
  const expiresAt = parseDate(input.expiresAt, "expires_at_invalid");
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new CommunicationRecipientResolutionError("server_time_invalid");
  const generatedAtMs = Date.parse(generatedAt);
  const expiresAtMs = Date.parse(expiresAt);
  if (generatedAtMs > nowMs + CLOCK_SKEW_MS) throw new CommunicationRecipientResolutionError("resolution_from_future");
  if (expiresAtMs <= nowMs) throw new CommunicationRecipientResolutionError("resolution_expired");
  if (expiresAtMs <= generatedAtMs || expiresAtMs - generatedAtMs > MAX_TTL_MS) {
    throw new CommunicationRecipientResolutionError("resolution_ttl_invalid");
  }
  if (!Number.isInteger(input.pageIndex) || Number(input.pageIndex) < 0 || Number(input.pageIndex) > 99) {
    throw new CommunicationRecipientResolutionError("page_index_invalid");
  }
  if (!Number.isInteger(input.pageCount) || Number(input.pageCount) < 1 || Number(input.pageCount) > 100) {
    throw new CommunicationRecipientResolutionError("page_count_invalid");
  }
  if (Number(input.pageIndex) >= Number(input.pageCount)) {
    throw new CommunicationRecipientResolutionError("page_range_invalid");
  }
  const groupRefs = normalizedGroupRefs(input.groupRefs);
  const expectedGroupRefs = normalizedGroupRefs(expected.groupRefs);
  if (groupRefs.join("\0") !== expectedGroupRefs.join("\0")) {
    throw new CommunicationRecipientResolutionError("scope_mismatch");
  }
  if (!Array.isArray(input.contacts) || input.contacts.length < 1 || input.contacts.length > MAX_CONTACTS_PER_PAGE) {
    throw new CommunicationRecipientResolutionError("contacts_invalid");
  }
  const contacts = input.contacts.map((entry) => {
    const contact = exactObject(entry, CONTACT_FIELDS, "contact_invalid");
    const contactRef = opaqueRef(contact.contactRef, "contact_ref_invalid");
    if (contact.eligibility !== "active_validated_email") {
      throw new CommunicationRecipientResolutionError("contact_not_eligible");
    }
    return { contactRef, eligibility: "active_validated_email" as const };
  });
  if (new Set(contacts.map((contact) => contact.contactRef)).size !== contacts.length) {
    throw new CommunicationRecipientResolutionError("contact_ref_duplicate");
  }
  contacts.sort((left, right) => left.contactRef.localeCompare(right.contactRef));

  return {
    v: CONTRACT_VERSION,
    institutionId: input.institutionId as string,
    resolutionId: input.resolutionId as string,
    communicationId: input.communicationId as string,
    versionId: input.versionId as string,
    version: Number(input.version),
    snapshotHash: input.snapshotHash as string,
    generatedAt,
    expiresAt,
    pageIndex: Number(input.pageIndex),
    pageCount: Number(input.pageCount),
    groupRefs,
    contacts,
  };
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update("communication-recipient-resolution-v1\0")
    .update(payload)
    .digest("base64url");
}

function signaturesMatch(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function createCommunicationRecipientResolutionToken(input: {
  resolution: unknown;
  expected: CommunicationRecipientResolutionContext;
  secret: string | undefined;
  now?: Date;
}): string {
  if (!validSecret(input.secret)) throw new CommunicationRecipientResolutionError("secret_invalid");
  const resolution = parseResolution(input.resolution, input.expected, input.now ?? new Date());
  const payload = Buffer.from(JSON.stringify(resolution)).toString("base64url");
  return `${payload}.${signature(payload, input.secret)}`;
}

export function verifyCommunicationRecipientResolutionToken(input: {
  token: unknown;
  expected: CommunicationRecipientResolutionContext;
  secret: string | undefined;
  now?: Date;
}): VerifiedCommunicationRecipientResolution | null {
  if (
    typeof input.token !== "string" ||
    input.token.length < 80 ||
    input.token.length > MAX_TOKEN_LENGTH ||
    !validSecret(input.secret)
  ) {
    return null;
  }
  const [payload, suppliedSignature, extra] = input.token.split(".");
  if (!payload || !suppliedSignature || extra || !signaturesMatch(suppliedSignature, signature(payload, input.secret))) {
    return null;
  }
  try {
    const resolution = parseResolution(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
      input.expected,
      input.now ?? new Date()
    );
    return {
      ...resolution,
      resolutionHash: createHash("sha256").update(input.token).digest("hex"),
    };
  } catch {
    return null;
  }
}

export function prepareCommunicationDeliveryRows(
  resolution: VerifiedCommunicationRecipientResolution,
  idempotencySecret: string | undefined
): PreparedCommunicationDelivery[] {
  if (!validSecret(idempotencySecret)) {
    throw new CommunicationRecipientResolutionError("idempotency_secret_invalid");
  }
  return resolution.contacts.map((contact) => ({
    institutionId: resolution.institutionId,
    communicationId: resolution.communicationId,
    versionId: resolution.versionId,
    version: resolution.version,
    contactRef: contact.contactRef,
    channel: "email",
    status: "prepared",
    idempotencyKeyHash: createHmac("sha256", idempotencySecret)
      .update("communication-delivery-v1\0")
      .update(resolution.institutionId)
      .update("\0")
      .update(resolution.communicationId)
      .update("\0")
      .update(resolution.versionId)
      .update("\0")
      .update(String(resolution.version))
      .update("\0")
      .update(contact.contactRef)
      .digest("hex"),
  }));
}
