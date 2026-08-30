import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const CONTRACT_VERSION = 1;
const REQUEST_TTL_SECONDS = 5 * 60;
const SNAPSHOT_MAX_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_MS = 30 * 1000;
const MAX_GROUPS = 200;
const MAX_GROUP_MEMBERS = 10_000;
const MAX_TOKEN_LENGTH = 96 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GROUP_REF_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{2,79}$/;
const BASE64URL_PATTERN = /^[a-zA-Z0-9_-]+$/;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const GROUP_KINDS = new Set<CommunicationRecipientGroupKind>([
  "teaching",
  "staff",
  "mixed",
  "custom",
]);
const SNAPSHOT_FIELDS = new Set([
  "v",
  "institutionId",
  "snapshotId",
  "generatedAt",
  "expiresAt",
  "groups",
]);
const REQUEST_FIELDS = new Set(["v", "institutionId", "iat", "exp", "nonce"]);
const GROUP_FIELDS = new Set(["groupRef", "label", "kind", "memberCount", "active"]);

export type CommunicationRecipientGroupKind = "teaching" | "staff" | "mixed" | "custom";

export type CommunicationRecipientRegistryGroup = {
  groupRef: string;
  label: string;
  kind: CommunicationRecipientGroupKind;
  memberCount: number;
  active: boolean;
};

export type CommunicationRecipientRegistrySnapshot = {
  v: 1;
  institutionId: string;
  snapshotId: string;
  generatedAt: string;
  expiresAt: string;
  groups: CommunicationRecipientRegistryGroup[];
};

export type VerifiedCommunicationRecipientRegistrySnapshot =
  CommunicationRecipientRegistrySnapshot & {
    snapshotHash: string;
  };

type RegistryRequestClaims = {
  v: 1;
  institutionId: string;
  iat: number;
  exp: number;
  nonce: string;
};

export class CommunicationRecipientRegistryError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("Le contrat du registre de destinataires est invalide");
    this.reason = reason;
  }
}

function validSecret(secret: string | undefined): secret is string {
  return typeof secret === "string" && secret.length >= 32;
}

function exactObject(value: unknown, fields: Set<string>, reason: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CommunicationRecipientRegistryError(reason);
  }
  const object = value as Record<string, unknown>;
  if (Object.keys(object).some((key) => !fields.has(key))) {
    throw new CommunicationRecipientRegistryError("unknown_field");
  }
  return object;
}

function validNow(now: Date): number {
  const value = now.getTime();
  if (!Number.isFinite(value)) {
    throw new CommunicationRecipientRegistryError("server_time_invalid");
  }
  return value;
}

function parseUtcDate(value: unknown, reason: string): string {
  if (typeof value !== "string" || !ISO_UTC_PATTERN.test(value)) {
    throw new CommunicationRecipientRegistryError(reason);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new CommunicationRecipientRegistryError(reason);
  }
  return value;
}

function containsLocator(value: string): boolean {
  return (
    /@|mailto:|https?:\/\/|tel:|www\./i.test(value) ||
    /\+?\d(?:[\s().-]*\d){8,}/.test(value)
  );
}

function parseGroup(value: unknown): CommunicationRecipientRegistryGroup {
  const group = exactObject(value, GROUP_FIELDS, "group_invalid");
  if (
    typeof group.groupRef !== "string" ||
    group.groupRef !== group.groupRef.trim() ||
    !GROUP_REF_PATTERN.test(group.groupRef) ||
    group.groupRef.includes("@")
  ) {
    throw new CommunicationRecipientRegistryError("group_ref_invalid");
  }
  if (
    typeof group.label !== "string" ||
    group.label !== group.label.trim() ||
    group.label.length < 1 ||
    group.label.length > 80 ||
    /[\u0000-\u001f<>]/.test(group.label) ||
    containsLocator(group.label)
  ) {
    throw new CommunicationRecipientRegistryError("group_label_invalid");
  }
  if (typeof group.kind !== "string" || !GROUP_KINDS.has(group.kind as CommunicationRecipientGroupKind)) {
    throw new CommunicationRecipientRegistryError("group_kind_invalid");
  }
  if (
    !Number.isInteger(group.memberCount) ||
    (group.memberCount as number) < 0 ||
    (group.memberCount as number) > MAX_GROUP_MEMBERS
  ) {
    throw new CommunicationRecipientRegistryError("member_count_invalid");
  }
  if (typeof group.active !== "boolean") {
    throw new CommunicationRecipientRegistryError("group_status_invalid");
  }
  return {
    groupRef: group.groupRef,
    label: group.label,
    kind: group.kind as CommunicationRecipientGroupKind,
    memberCount: group.memberCount as number,
    active: group.active,
  };
}

function parseSnapshot(
  value: unknown,
  expectedInstitutionId: string,
  now: Date
): CommunicationRecipientRegistrySnapshot {
  const snapshot = exactObject(value, SNAPSHOT_FIELDS, "snapshot_invalid");
  if (snapshot.v !== CONTRACT_VERSION) {
    throw new CommunicationRecipientRegistryError("version_invalid");
  }
  if (
    typeof snapshot.institutionId !== "string" ||
    !UUID_PATTERN.test(snapshot.institutionId) ||
    snapshot.institutionId !== expectedInstitutionId
  ) {
    throw new CommunicationRecipientRegistryError("institution_scope_invalid");
  }
  if (typeof snapshot.snapshotId !== "string" || !UUID_PATTERN.test(snapshot.snapshotId)) {
    throw new CommunicationRecipientRegistryError("snapshot_id_invalid");
  }
  const generatedAt = parseUtcDate(snapshot.generatedAt, "generated_at_invalid");
  const expiresAt = parseUtcDate(snapshot.expiresAt, "expires_at_invalid");
  const nowMs = validNow(now);
  const generatedAtMs = Date.parse(generatedAt);
  const expiresAtMs = Date.parse(expiresAt);
  if (generatedAtMs > nowMs + CLOCK_SKEW_MS) {
    throw new CommunicationRecipientRegistryError("snapshot_from_future");
  }
  if (expiresAtMs <= nowMs) {
    throw new CommunicationRecipientRegistryError("snapshot_expired");
  }
  if (expiresAtMs <= generatedAtMs || expiresAtMs - generatedAtMs > SNAPSHOT_MAX_TTL_MS) {
    throw new CommunicationRecipientRegistryError("snapshot_ttl_invalid");
  }
  if (!Array.isArray(snapshot.groups) || snapshot.groups.length > MAX_GROUPS) {
    throw new CommunicationRecipientRegistryError("groups_invalid");
  }
  const groups = snapshot.groups.map(parseGroup);
  if (new Set(groups.map((group) => group.groupRef)).size !== groups.length) {
    throw new CommunicationRecipientRegistryError("group_ref_duplicate");
  }
  groups.sort((left, right) => left.groupRef.localeCompare(right.groupRef));
  return {
    v: CONTRACT_VERSION,
    institutionId: snapshot.institutionId,
    snapshotId: snapshot.snapshotId,
    generatedAt,
    expiresAt,
    groups,
  };
}

function signature(domain: "request" | "snapshot", payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`communication-recipient-registry-${domain}-v1\0`)
    .update(payload)
    .digest("base64url");
}

function signaturesMatch(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function splitSignedToken(token: unknown, domain: "request" | "snapshot", secret: string | undefined): string | null {
  if (
    typeof token !== "string" ||
    token.length < 80 ||
    token.length > MAX_TOKEN_LENGTH ||
    !validSecret(secret)
  ) {
    return null;
  }
  const [payload, suppliedSignature, extra] = token.split(".");
  if (
    !payload ||
    !suppliedSignature ||
    extra ||
    !BASE64URL_PATTERN.test(payload) ||
    !BASE64URL_PATTERN.test(suppliedSignature) ||
    !signaturesMatch(suppliedSignature, signature(domain, payload, secret))
  ) {
    return null;
  }
  return payload;
}

export function createCommunicationRecipientRegistryRequestToken(input: {
  institutionId: string;
  secret: string | undefined;
  now?: Date;
  nonce?: string;
}): { token: string; expiresAt: string } {
  const now = input.now ?? new Date();
  const nowMs = validNow(now);
  if (!validSecret(input.secret)) {
    throw new CommunicationRecipientRegistryError("secret_invalid");
  }
  if (!UUID_PATTERN.test(input.institutionId)) {
    throw new CommunicationRecipientRegistryError("institution_scope_invalid");
  }
  const nonce = input.nonce ?? randomUUID();
  if (!UUID_PATTERN.test(nonce)) {
    throw new CommunicationRecipientRegistryError("nonce_invalid");
  }
  const issuedAt = Math.floor(nowMs / 1000);
  const claims: RegistryRequestClaims = {
    v: CONTRACT_VERSION,
    institutionId: input.institutionId,
    iat: issuedAt,
    exp: issuedAt + REQUEST_TTL_SECONDS,
    nonce,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return {
    token: `${payload}.${signature("request", payload, input.secret)}`,
    expiresAt: new Date(claims.exp * 1000).toISOString(),
  };
}

export function verifyCommunicationRecipientRegistryRequestToken(input: {
  token: unknown;
  institutionId: string;
  secret: string | undefined;
  now?: Date;
}): { institutionId: string; requestHash: string; issuedAt: Date; expiresAt: Date } | null {
  const payload = splitSignedToken(input.token, "request", input.secret);
  if (!payload || !UUID_PATTERN.test(input.institutionId)) return null;
  let claims: RegistryRequestClaims;
  try {
    claims = exactObject(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
      REQUEST_FIELDS,
      "request_invalid"
    ) as RegistryRequestClaims;
  } catch {
    return null;
  }
  let nowMs: number;
  try {
    nowMs = validNow(input.now ?? new Date());
  } catch {
    return null;
  }
  const nowSeconds = Math.floor(nowMs / 1000);
  if (
    claims.v !== CONTRACT_VERSION ||
    !UUID_PATTERN.test(claims.institutionId) ||
    claims.institutionId !== input.institutionId ||
    !Number.isInteger(claims.iat) ||
    !Number.isInteger(claims.exp) ||
    claims.exp - claims.iat !== REQUEST_TTL_SECONDS ||
    claims.iat > nowSeconds + Math.floor(CLOCK_SKEW_MS / 1000) ||
    claims.exp <= nowSeconds ||
    !UUID_PATTERN.test(claims.nonce)
  ) {
    return null;
  }
  return {
    institutionId: claims.institutionId,
    requestHash: createHash("sha256").update(input.token as string).digest("hex"),
    issuedAt: new Date(claims.iat * 1000),
    expiresAt: new Date(claims.exp * 1000),
  };
}

export function createCommunicationRecipientRegistrySnapshotToken(input: {
  snapshot: unknown;
  institutionId: string;
  secret: string | undefined;
  now?: Date;
}): { token: string; snapshot: CommunicationRecipientRegistrySnapshot } {
  if (!validSecret(input.secret)) {
    throw new CommunicationRecipientRegistryError("secret_invalid");
  }
  const snapshot = parseSnapshot(input.snapshot, input.institutionId, input.now ?? new Date());
  const payload = Buffer.from(JSON.stringify(snapshot)).toString("base64url");
  return {
    token: `${payload}.${signature("snapshot", payload, input.secret)}`,
    snapshot,
  };
}

export function verifyCommunicationRecipientRegistrySnapshotToken(input: {
  token: unknown;
  institutionId: string;
  secret: string | undefined;
  now?: Date;
}): VerifiedCommunicationRecipientRegistrySnapshot | null {
  const payload = splitSignedToken(input.token, "snapshot", input.secret);
  if (!payload || !UUID_PATTERN.test(input.institutionId)) return null;
  try {
    const snapshot = parseSnapshot(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
      input.institutionId,
      input.now ?? new Date()
    );
    return {
      ...snapshot,
      snapshotHash: createHash("sha256").update(input.token as string).digest("hex"),
    };
  } catch {
    return null;
  }
}
