import { createHmac, timingSafeEqual } from "node:crypto";
import {
  hashCommunicationRecipientAlias,
  parseCommunicationBrevoInboundEnvelope,
  verifyCommunicationInboundBearerHeader,
} from "./communication-brevo-inbound.js";

export type CommunicationBrevoForwardedMessage = {
  externalMessageHash: string;
  attachmentCount: number;
  subject: string;
  extractedText: string;
  sourceAuthorized: true;
};

type ForwardedEnvironment = Partial<Record<
  | "COMMUNICATION_FORWARD_ENABLED"
  | "COMMUNICATION_FORWARD_ALLOWED_ALIAS_HASHES"
  | "COMMUNICATION_FORWARD_ALLOWED_SOURCE_HASHES",
  string
>>;

const SOURCE_HASH_DOMAIN = "lyceegest:communication:brevo:forwarded-source:v1";
const HMAC_PATTERN = /^[a-f0-9]{64}$/;

function boundedSubject(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error("subject_invalid");
  const normalized = value.normalize("NFC").trim().replace(/\s+/g, " ");
  if (normalized.length > 500 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error("subject_invalid");
  }
  return normalized;
}

function boundedExtractedText(value: unknown): string {
  if (typeof value !== "string") throw new Error("extracted_text_invalid");
  const normalized = value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  if (normalized.length < 1 || normalized.length > 100_000) {
    throw new Error("extracted_text_invalid");
  }
  return normalized;
}

function normalizedSenderAddress(value: unknown): string {
  const address = value && typeof value === "object" && !Array.isArray(value)
    ? (value as { Address?: unknown }).Address
    : undefined;
  if (typeof address !== "string") throw new Error("source_invalid");
  const normalized = address.trim().toLocaleLowerCase("en-US").normalize("NFC");
  if (
    normalized.length < 3 ||
    normalized.length > 320 ||
    !normalized.includes("@") ||
    /[\s\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error("source_invalid");
  }
  return normalized;
}

function sourceHash(address: string, hashingSecret: string): string {
  return createHmac("sha256", hashingSecret)
    .update(SOURCE_HASH_DOMAIN)
    .update("\0")
    .update(address)
    .digest("hex");
}

function hashAllowed(candidate: string, allowed: string[]): boolean {
  const candidateBuffer = Buffer.from(candidate, "hex");
  return allowed.some((value) => timingSafeEqual(candidateBuffer, Buffer.from(value, "hex")));
}

export function communicationForwardWebhookEnabled(
  env: ForwardedEnvironment = process.env
): boolean {
  return env.COMMUNICATION_FORWARD_ENABLED === "true";
}

export function communicationForwardAllowedSourceHashes(
  env: ForwardedEnvironment = process.env
): string[] {
  const raw = env.COMMUNICATION_FORWARD_ALLOWED_SOURCE_HASHES;
  if (!raw) throw new Error("allowed_sources_missing");
  const hashes = raw.split(",").map((value) => value.trim().toLocaleLowerCase("en-US"));
  if (hashes.length < 1 || hashes.length > 20 || hashes.some((value) => !HMAC_PATTERN.test(value))) {
    throw new Error("allowed_sources_invalid");
  }
  return [...new Set(hashes)];
}

export function communicationForwardAllowedAliasHashes(
  env: ForwardedEnvironment = process.env
): string[] {
  const raw = env.COMMUNICATION_FORWARD_ALLOWED_ALIAS_HASHES;
  if (!raw) throw new Error("allowed_aliases_missing");
  const hashes = raw.split(",").map((value) => value.trim().toLocaleLowerCase("en-US"));
  if (hashes.length < 1 || hashes.length > 20 || hashes.some((value) => !HMAC_PATTERN.test(value))) {
    throw new Error("allowed_aliases_invalid");
  }
  return [...new Set(hashes)];
}

export function verifyCommunicationForwardBearerHeader(
  authorization: string | string[] | undefined,
  expectedSecret: string | undefined
): boolean {
  return verifyCommunicationInboundBearerHeader(authorization, expectedSecret);
}

export function communicationForwardSourceHashForConfiguration(
  address: string,
  hashingSecret: string
): string {
  return sourceHash(normalizedSenderAddress({ Address: address }), hashingSecret);
}

export function communicationForwardAliasHashForConfiguration(
  address: string,
  hashingSecret: string
): string {
  return hashCommunicationRecipientAlias(address, hashingSecret);
}

export function parseCommunicationBrevoForwardedEnvelope(
  value: unknown,
  hashingSecret: string,
  allowedSourceHashes: string[],
  allowedAliasHashes: string[]
): CommunicationBrevoForwardedMessage {
  if (
    allowedSourceHashes.length < 1 ||
    allowedSourceHashes.length > 20 ||
    allowedSourceHashes.some((hash) => !HMAC_PATTERN.test(hash))
  ) {
    throw new Error("allowed_sources_invalid");
  }
  if (
    allowedAliasHashes.length < 1 ||
    allowedAliasHashes.length > 20 ||
    allowedAliasHashes.some((hash) => !HMAC_PATTERN.test(hash))
  ) {
    throw new Error("allowed_aliases_invalid");
  }
  const receipts = parseCommunicationBrevoInboundEnvelope(value, hashingSecret);
  if (receipts.length !== 1) throw new Error("single_message_required");
  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length !== 1) throw new Error("single_message_required");
  const item = items[0];
  if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("item_invalid");
  const input = item as Record<string, unknown>;
  const senderHash = sourceHash(normalizedSenderAddress(input.From), hashingSecret);
  if (!hashAllowed(senderHash, allowedSourceHashes)) throw new Error("source_not_authorized");
  if (!receipts[0].recipientAliasHashes.some((hash) => hashAllowed(hash, allowedAliasHashes))) {
    throw new Error("alias_not_authorized");
  }
  return {
    externalMessageHash: receipts[0].externalMessageHash,
    attachmentCount: receipts[0].attachmentCount,
    subject: boundedSubject(input.Subject),
    extractedText: boundedExtractedText(input.ExtractedMarkdownMessage),
    sourceAuthorized: true,
  };
}
