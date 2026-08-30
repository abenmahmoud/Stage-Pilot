import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type CommunicationBrevoInboundReceipt = {
  provider: "brevo_inbound";
  externalMessageHash: string;
  inReplyToHash: string | null;
  recipientAliasHashes: string[];
  attachmentCount: number;
  attachmentBytes: number;
  hasExtractedMessage: boolean;
  spamScore: number | null;
};

export class CommunicationBrevoInboundError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.reason = reason;
  }
}

const MAX_ITEMS = 20;
const MAX_ATTACHMENTS = 20;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_MESSAGE_LENGTH = 998;
const MAX_EXTRACTED_LENGTH = 100_000;
const HASH_DOMAINS = {
  message: "lyceegest:communication:brevo:message:v1",
  reply: "lyceegest:communication:brevo:reply:v1",
  recipient: "lyceegest:communication:brevo:recipient:v1",
} as const;

type CommunicationInboundEnvironment = Partial<Record<
  "COMMUNICATION_INBOUND_ENABLED",
  string
>>;

type Mailbox = { Address?: unknown };
type InboundAttachment = { ContentLength?: unknown };
type InboundItem = {
  MessageId?: unknown;
  InReplyTo?: unknown;
  To?: unknown;
  Recipients?: unknown;
  ExtractedMarkdownMessage?: unknown;
  Attachments?: unknown;
  SpamScore?: unknown;
};

function secretValid(value: string | undefined): value is string {
  return typeof value === "string" &&
    value.length >= 32 &&
    value.length <= 512 &&
    !/[\s\u0000-\u001f\u007f,]/u.test(value);
}

function digest(domain: string, value: string, secret: string): string {
  return createHmac("sha256", secret).update(domain).update("\0").update(value).digest("hex");
}

function boundedHeaderValue(value: unknown, field: string, required: boolean): string | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new CommunicationBrevoInboundError(`${field}_missing`);
    return null;
  }
  if (typeof value !== "string") throw new CommunicationBrevoInboundError(`${field}_invalid`);
  const normalized = value.trim().normalize("NFC");
  if (
    normalized.length < 1 ||
    normalized.length > MAX_MESSAGE_LENGTH ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new CommunicationBrevoInboundError(`${field}_invalid`);
  }
  return normalized;
}

function mailboxAddress(value: unknown): string | null {
  const candidate = typeof value === "string"
    ? value
    : value && typeof value === "object" && !Array.isArray(value)
      ? (value as Mailbox).Address
      : undefined;
  if (typeof candidate !== "string") return null;
  const normalized = candidate.trim().toLocaleLowerCase("en-US").normalize("NFC");
  if (
    normalized.length < 3 ||
    normalized.length > 320 ||
    !normalized.includes("@") ||
    /[\s\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new CommunicationBrevoInboundError("recipient_invalid");
  }
  return normalized;
}

function addressesFrom(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 100) {
    throw new CommunicationBrevoInboundError("recipients_invalid");
  }
  return value.flatMap((entry) => {
    const address = mailboxAddress(entry);
    return address ? [address] : [];
  });
}

function attachmentSummary(value: unknown): { count: number; bytes: number } {
  if (value === undefined || value === null) return { count: 0, bytes: 0 };
  if (!Array.isArray(value) || value.length > MAX_ATTACHMENTS) {
    throw new CommunicationBrevoInboundError("attachments_invalid");
  }
  let bytes = 0;
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new CommunicationBrevoInboundError("attachment_invalid");
    }
    const length = (entry as InboundAttachment).ContentLength ?? 0;
    if (!Number.isSafeInteger(length) || Number(length) < 0 || Number(length) > MAX_ATTACHMENT_BYTES) {
      throw new CommunicationBrevoInboundError("attachment_size_invalid");
    }
    bytes += Number(length);
    if (bytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      throw new CommunicationBrevoInboundError("attachments_total_size_invalid");
    }
  }
  return { count: value.length, bytes };
}

function extractedMessagePresent(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (typeof value !== "string" || value.length > MAX_EXTRACTED_LENGTH) {
    throw new CommunicationBrevoInboundError("extracted_message_invalid");
  }
  return value.trim().length > 0;
}

function spamScore(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < -100 || parsed > 100) {
    throw new CommunicationBrevoInboundError("spam_score_invalid");
  }
  return parsed;
}

function parseItem(value: unknown, hashingSecret: string): CommunicationBrevoInboundReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CommunicationBrevoInboundError("item_invalid");
  }
  const item = value as InboundItem;
  const messageId = boundedHeaderValue(item.MessageId, "message_id", true) as string;
  const inReplyTo = boundedHeaderValue(item.InReplyTo, "in_reply_to", false);
  const recipients = [...addressesFrom(item.To), ...addressesFrom(item.Recipients)];
  if (recipients.length < 1 || recipients.length > 100) {
    throw new CommunicationBrevoInboundError("recipients_invalid");
  }
  const recipientAliasHashes = [...new Set(recipients.map((address) =>
    digest(HASH_DOMAINS.recipient, address, hashingSecret)
  ))].sort();
  const attachments = attachmentSummary(item.Attachments);

  return {
    provider: "brevo_inbound",
    externalMessageHash: digest(HASH_DOMAINS.message, messageId, hashingSecret),
    inReplyToHash: inReplyTo ? digest(HASH_DOMAINS.reply, inReplyTo, hashingSecret) : null,
    recipientAliasHashes,
    attachmentCount: attachments.count,
    attachmentBytes: attachments.bytes,
    hasExtractedMessage: extractedMessagePresent(item.ExtractedMarkdownMessage),
    spamScore: spamScore(item.SpamScore),
  };
}

export function communicationInboundWebhookEnabled(
  env: CommunicationInboundEnvironment = process.env
): boolean {
  return env.COMMUNICATION_INBOUND_ENABLED === "true";
}

export function verifyCommunicationInboundBearerHeader(
  authorization: string | string[] | undefined,
  expectedSecret: string | undefined
): boolean {
  if (
    typeof authorization !== "string" ||
    !secretValid(expectedSecret)
  ) {
    return false;
  }
  const match = /^Bearer ([\x21-\x7e]{32,512})$/u.exec(authorization);
  if (!match || match[1].includes(",")) return false;
  const expected = createHash("sha256").update(expectedSecret).digest();
  const provided = createHash("sha256").update(match[1]).digest();
  return timingSafeEqual(expected, provided);
}

export function parseCommunicationBrevoInboundEnvelope(
  value: unknown,
  hashingSecret: string
): CommunicationBrevoInboundReceipt[] {
  if (!secretValid(hashingSecret)) {
    throw new CommunicationBrevoInboundError("hashing_secret_invalid");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CommunicationBrevoInboundError("envelope_invalid");
  }
  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_ITEMS) {
    throw new CommunicationBrevoInboundError("items_invalid");
  }
  const receipts = items.map((item) => parseItem(item, hashingSecret));
  const messageHashes = new Set<string>();
  for (const receipt of receipts) {
    if (messageHashes.has(receipt.externalMessageHash)) {
      throw new CommunicationBrevoInboundError("message_id_duplicate");
    }
    messageHashes.add(receipt.externalMessageHash);
  }
  return receipts;
}
