import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { hashCommunicationProviderOutboundMessageId } from "./communication-brevo-inbound.js";
import type { VerifiedCommunicationWebmailDeliveryCommand } from "./communication-webmail-delivery.js";

const CONTRACT_VERSION = 1;
const MAX_TOKEN_LENGTH = 16 * 1024;
const MAX_TTL_MS = 5 * 60 * 1000;
const MAX_ACCEPTANCE_AGE_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 30 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const RECEIPT_FIELDS = new Set([
  "v",
  "institutionId",
  "deliveryId",
  "commandHash",
  "idempotencyKeyHash",
  "provider",
  "providerMessageRef",
  "outcome",
  "acceptedAt",
  "issuedAt",
  "expiresAt",
]);

export type CommunicationWebmailDeliveryReceipt = {
  v: 1;
  institutionId: string;
  deliveryId: string;
  commandHash: string;
  idempotencyKeyHash: string;
  provider: "brevo_transactional";
  providerMessageRef: string;
  outcome: "accepted" | "duplicate";
  acceptedAt: string;
  issuedAt: string;
  expiresAt: string;
};

export type VerifiedCommunicationWebmailDeliveryReceipt = CommunicationWebmailDeliveryReceipt & {
  receiptHash: string;
};

export class CommunicationWebmailReceiptError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("Le reçu de diffusion Webmail est invalide");
    this.reason = reason;
  }
}

function validSecret(value: string | undefined): value is string {
  return typeof value === "string" && value.length >= 32 && value.length <= 512;
}

function exactObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CommunicationWebmailReceiptError("receipt_invalid");
  }
  const receipt = value as Record<string, unknown>;
  if (Object.keys(receipt).some((key) => !RECEIPT_FIELDS.has(key))) {
    throw new CommunicationWebmailReceiptError("unknown_field");
  }
  return receipt;
}

function utcDate(value: unknown, reason: string): string {
  if (typeof value !== "string" || !ISO_UTC_PATTERN.test(value)) {
    throw new CommunicationWebmailReceiptError(reason);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new CommunicationWebmailReceiptError(reason);
  }
  return value;
}

function hash(value: unknown, reason: string): string {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new CommunicationWebmailReceiptError(reason);
  }
  return value;
}

function assertCommand(value: VerifiedCommunicationWebmailDeliveryCommand): void {
  if (
    !value ||
    !UUID_PATTERN.test(value.institutionId) ||
    !UUID_PATTERN.test(value.deliveryId) ||
    !HASH_PATTERN.test(value.commandHash) ||
    !HASH_PATTERN.test(value.idempotencyKeyHash)
  ) {
    throw new CommunicationWebmailReceiptError("command_invalid");
  }
}

function parseReceipt(value: unknown, now: Date): CommunicationWebmailDeliveryReceipt {
  const receipt = exactObject(value);
  if (receipt.v !== CONTRACT_VERSION) throw new CommunicationWebmailReceiptError("version_invalid");
  for (const key of ["institutionId", "deliveryId"] as const) {
    if (typeof receipt[key] !== "string" || !UUID_PATTERN.test(receipt[key] as string)) {
      throw new CommunicationWebmailReceiptError(`${key}_invalid`);
    }
  }
  const commandHash = hash(receipt.commandHash, "command_hash_invalid");
  const idempotencyKeyHash = hash(receipt.idempotencyKeyHash, "idempotency_hash_invalid");
  if (receipt.provider !== "brevo_transactional") {
    throw new CommunicationWebmailReceiptError("provider_invalid");
  }
  const providerMessageRef = hash(receipt.providerMessageRef, "provider_message_ref_invalid");
  if (receipt.outcome !== "accepted" && receipt.outcome !== "duplicate") {
    throw new CommunicationWebmailReceiptError("outcome_invalid");
  }
  const acceptedAt = utcDate(receipt.acceptedAt, "accepted_at_invalid");
  const issuedAt = utcDate(receipt.issuedAt, "issued_at_invalid");
  const expiresAt = utcDate(receipt.expiresAt, "expires_at_invalid");
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new CommunicationWebmailReceiptError("server_time_invalid");
  const acceptedAtMs = Date.parse(acceptedAt);
  const issuedAtMs = Date.parse(issuedAt);
  const expiresAtMs = Date.parse(expiresAt);
  if (issuedAtMs > nowMs + CLOCK_SKEW_MS || acceptedAtMs > issuedAtMs + CLOCK_SKEW_MS) {
    throw new CommunicationWebmailReceiptError("receipt_from_future");
  }
  if (acceptedAtMs < issuedAtMs - MAX_ACCEPTANCE_AGE_MS) {
    throw new CommunicationWebmailReceiptError("acceptance_too_old");
  }
  if (expiresAtMs <= nowMs) throw new CommunicationWebmailReceiptError("receipt_expired");
  if (expiresAtMs <= issuedAtMs || expiresAtMs - issuedAtMs > MAX_TTL_MS) {
    throw new CommunicationWebmailReceiptError("receipt_ttl_invalid");
  }

  return {
    v: CONTRACT_VERSION,
    institutionId: receipt.institutionId as string,
    deliveryId: receipt.deliveryId as string,
    commandHash,
    idempotencyKeyHash,
    provider: "brevo_transactional",
    providerMessageRef,
    outcome: receipt.outcome,
    acceptedAt,
    issuedAt,
    expiresAt,
  };
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update("communication-webmail-receipt-v1\0")
    .update(payload)
    .digest("base64url");
}

function signaturesMatch(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function createCommunicationWebmailDeliveryReceiptToken(input: {
  command: VerifiedCommunicationWebmailDeliveryCommand;
  outcome: "accepted" | "duplicate";
  providerMessageId: string;
  receiptSecret: string | undefined;
  providerHashingSecret: string | undefined;
  acceptedAt: Date;
  now?: Date;
}): string {
  assertCommand(input.command);
  if (!validSecret(input.receiptSecret) || !validSecret(input.providerHashingSecret)) {
    throw new CommunicationWebmailReceiptError("secret_invalid");
  }
  if (input.receiptSecret === input.providerHashingSecret) {
    throw new CommunicationWebmailReceiptError("secret_reuse_forbidden");
  }
  if (input.outcome !== "accepted" && input.outcome !== "duplicate") {
    throw new CommunicationWebmailReceiptError("outcome_invalid");
  }
  const now = input.now ?? new Date();
  const receipt = parseReceipt({
    v: CONTRACT_VERSION,
    institutionId: input.command.institutionId,
    deliveryId: input.command.deliveryId,
    commandHash: input.command.commandHash,
    idempotencyKeyHash: input.command.idempotencyKeyHash,
    provider: "brevo_transactional",
    providerMessageRef: hashCommunicationProviderOutboundMessageId(
      input.providerMessageId,
      input.providerHashingSecret
    ),
    outcome: input.outcome,
    acceptedAt: input.acceptedAt.toISOString(),
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + MAX_TTL_MS).toISOString(),
  }, now);
  const payload = Buffer.from(JSON.stringify(receipt)).toString("base64url");
  return `${payload}.${signature(payload, input.receiptSecret)}`;
}

export function verifyCommunicationWebmailDeliveryReceiptToken(input: {
  token: unknown;
  command: VerifiedCommunicationWebmailDeliveryCommand;
  receiptSecret: string | undefined;
  now?: Date;
}): VerifiedCommunicationWebmailDeliveryReceipt | null {
  if (
    typeof input.token !== "string" ||
    input.token.length < 80 ||
    input.token.length > MAX_TOKEN_LENGTH ||
    !validSecret(input.receiptSecret)
  ) {
    return null;
  }
  assertCommand(input.command);
  const [payload, suppliedSignature, extra] = input.token.split(".");
  if (!payload || !suppliedSignature || extra || !signaturesMatch(suppliedSignature, signature(payload, input.receiptSecret))) {
    return null;
  }
  try {
    const receipt = parseReceipt(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
      input.now ?? new Date()
    );
    if (
      receipt.institutionId !== input.command.institutionId ||
      receipt.deliveryId !== input.command.deliveryId ||
      receipt.commandHash !== input.command.commandHash ||
      receipt.idempotencyKeyHash !== input.command.idempotencyKeyHash
    ) {
      return null;
    }
    return {
      ...receipt,
      receiptHash: createHash("sha256").update(input.token).digest("hex"),
    };
  } catch {
    return null;
  }
}
