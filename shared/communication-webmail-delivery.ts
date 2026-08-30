import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const CONTRACT_VERSION = 1;
const MAX_TOKEN_LENGTH = 96 * 1024;
const MAX_TTL_MS = 5 * 60 * 1000;
const CLOCK_SKEW_MS = 30 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REF_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{7,119}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const PATH_PATTERN = /^\/informations\/[a-z0-9][a-z0-9-]{2,79}$/;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const COMMAND_FIELDS = new Set([
  "v",
  "institutionId",
  "deliveryId",
  "communicationId",
  "versionId",
  "version",
  "contactRef",
  "resolutionHash",
  "idempotencyKeyHash",
  "visibility",
  "canonicalPath",
  "linkMode",
  "subject",
  "preheader",
  "bodyText",
  "replyRef",
  "issuedAt",
  "expiresAt",
]);

export type CommunicationWebmailDeliveryCommand = {
  v: 1;
  institutionId: string;
  deliveryId: string;
  communicationId: string;
  versionId: string;
  version: number;
  contactRef: string;
  resolutionHash: string;
  idempotencyKeyHash: string;
  visibility: "public" | "internal" | "targeted";
  canonicalPath: string;
  linkMode: "public" | "authenticated";
  subject: string;
  preheader: string;
  bodyText: string;
  replyRef: string;
  issuedAt: string;
  expiresAt: string;
};

export type VerifiedCommunicationWebmailDeliveryCommand = CommunicationWebmailDeliveryCommand & {
  commandHash: string;
};

export class CommunicationWebmailDeliveryError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("L'ordre individuel de diffusion est invalide");
    this.reason = reason;
  }
}

function validSecret(value: string | undefined): value is string {
  return typeof value === "string" && value.length >= 32 && value.length <= 512;
}

function exactObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CommunicationWebmailDeliveryError("command_invalid");
  }
  const command = value as Record<string, unknown>;
  if (Object.keys(command).some((key) => !COMMAND_FIELDS.has(key))) {
    throw new CommunicationWebmailDeliveryError("unknown_field");
  }
  return command;
}

function utcDate(value: unknown, reason: string): string {
  if (typeof value !== "string" || !ISO_UTC_PATTERN.test(value)) {
    throw new CommunicationWebmailDeliveryError(reason);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new CommunicationWebmailDeliveryError(reason);
  }
  return value;
}

function text(value: unknown, min: number, max: number, reason: string, multiline = false): string {
  if (typeof value !== "string" || value !== value.trim() || value.length < min || value.length > max) {
    throw new CommunicationWebmailDeliveryError(reason);
  }
  const forbidden = multiline ? /[\u0000\u000b\u000c\u007f]/u : /[\u0000-\u001f\u007f]/u;
  if (forbidden.test(value)) throw new CommunicationWebmailDeliveryError(reason);
  return value;
}

function opaqueRef(value: unknown, reason: string): string {
  if (
    typeof value !== "string" ||
    !REF_PATTERN.test(value) ||
    /@|mailto:|https?:|tel:|www\./i.test(value)
  ) {
    throw new CommunicationWebmailDeliveryError(reason);
  }
  return value;
}

function parseCommand(
  value: unknown,
  expectedInstitutionId: string,
  now: Date
): CommunicationWebmailDeliveryCommand {
  const command = exactObject(value);
  if (command.v !== CONTRACT_VERSION) throw new CommunicationWebmailDeliveryError("version_invalid");
  for (const key of ["institutionId", "deliveryId", "communicationId", "versionId"] as const) {
    if (typeof command[key] !== "string" || !UUID_PATTERN.test(command[key] as string)) {
      throw new CommunicationWebmailDeliveryError(`${key}_invalid`);
    }
  }
  if (command.institutionId !== expectedInstitutionId || !UUID_PATTERN.test(expectedInstitutionId)) {
    throw new CommunicationWebmailDeliveryError("institution_scope_invalid");
  }
  if (!Number.isInteger(command.version) || Number(command.version) < 1 || Number(command.version) > 10_000) {
    throw new CommunicationWebmailDeliveryError("content_version_invalid");
  }
  const contactRef = opaqueRef(command.contactRef, "contact_ref_invalid");
  const replyRef = opaqueRef(command.replyRef, "reply_ref_invalid");
  for (const key of ["resolutionHash", "idempotencyKeyHash"] as const) {
    if (typeof command[key] !== "string" || !HASH_PATTERN.test(command[key] as string)) {
      throw new CommunicationWebmailDeliveryError(`${key}_invalid`);
    }
  }
  if (command.visibility !== "public" && command.visibility !== "internal" && command.visibility !== "targeted") {
    throw new CommunicationWebmailDeliveryError("visibility_invalid");
  }
  const expectedLinkMode = command.visibility === "public" ? "public" : "authenticated";
  if (command.linkMode !== expectedLinkMode) {
    throw new CommunicationWebmailDeliveryError("link_mode_invalid");
  }
  if (typeof command.canonicalPath !== "string" || !PATH_PATTERN.test(command.canonicalPath)) {
    throw new CommunicationWebmailDeliveryError("canonical_path_invalid");
  }
  const subject = text(command.subject, 1, 180, "subject_invalid");
  const preheader = text(command.preheader, 1, 240, "preheader_invalid");
  const bodyText = text(command.bodyText, 1, 20_000, "body_invalid", true);
  const issuedAt = utcDate(command.issuedAt, "issued_at_invalid");
  const expiresAt = utcDate(command.expiresAt, "expires_at_invalid");
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new CommunicationWebmailDeliveryError("server_time_invalid");
  const issuedAtMs = Date.parse(issuedAt);
  const expiresAtMs = Date.parse(expiresAt);
  if (issuedAtMs > nowMs + CLOCK_SKEW_MS) throw new CommunicationWebmailDeliveryError("command_from_future");
  if (expiresAtMs <= nowMs) throw new CommunicationWebmailDeliveryError("command_expired");
  if (expiresAtMs <= issuedAtMs || expiresAtMs - issuedAtMs > MAX_TTL_MS) {
    throw new CommunicationWebmailDeliveryError("command_ttl_invalid");
  }

  return {
    v: CONTRACT_VERSION,
    institutionId: command.institutionId as string,
    deliveryId: command.deliveryId as string,
    communicationId: command.communicationId as string,
    versionId: command.versionId as string,
    version: Number(command.version),
    contactRef,
    resolutionHash: command.resolutionHash as string,
    idempotencyKeyHash: command.idempotencyKeyHash as string,
    visibility: command.visibility,
    canonicalPath: command.canonicalPath,
    linkMode: expectedLinkMode,
    subject,
    preheader,
    bodyText,
    replyRef,
    issuedAt,
    expiresAt,
  };
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update("communication-webmail-delivery-v1\0")
    .update(payload)
    .digest("base64url");
}

function signaturesMatch(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function createCommunicationWebmailDeliveryToken(input: {
  command: unknown;
  institutionId: string;
  secret: string | undefined;
  now?: Date;
}): string {
  if (!validSecret(input.secret)) throw new CommunicationWebmailDeliveryError("secret_invalid");
  const command = parseCommand(input.command, input.institutionId, input.now ?? new Date());
  const payload = Buffer.from(JSON.stringify(command)).toString("base64url");
  return `${payload}.${signature(payload, input.secret)}`;
}

export function verifyCommunicationWebmailDeliveryToken(input: {
  token: unknown;
  institutionId: string;
  secret: string | undefined;
  now?: Date;
}): VerifiedCommunicationWebmailDeliveryCommand | null {
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
    const command = parseCommand(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
      input.institutionId,
      input.now ?? new Date()
    );
    return {
      ...command,
      commandHash: createHash("sha256").update(input.token).digest("hex"),
    };
  } catch {
    return null;
  }
}
