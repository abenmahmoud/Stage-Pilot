import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  normalizeSupportConversation,
  summarizeSupportDescription,
  type SupportConversationTurn,
} from "../../shared/support-conversation.js";
import { normalizeSupportSummaryText } from "../../shared/support-normalization-policy.js";

const TTL_SECONDS = 15 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const CATEGORY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
const RECEIPT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const CLAIM_FIELDS = new Set(["v", "institutionId", "category", "requesterRefHash", "contentHash", "iat", "exp"]);

type NormalizationSource = {
  conversation: SupportConversationTurn[];
  description: string;
  detectedLanguage: string;
  internalSummaryFr: string;
};

function contentHash(source: NormalizationSource, secret: string): string | null {
  if (typeof source.description !== "string" || !source.description.trim() || source.description.length > 5000
    || typeof source.detectedLanguage !== "string" || !source.detectedLanguage.trim()
    || source.detectedLanguage.length > 60 || typeof source.internalSummaryFr !== "string"
    || !source.internalSummaryFr.trim() || source.internalSummaryFr.length > 4000) return null;
  try {
    const conversation = normalizeSupportConversation(source.conversation);
    if (conversation.length === 0) return null;
    const payload = JSON.stringify({
      conversation,
      description: source.description.trim(),
      detectedLanguage: source.detectedLanguage.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim(),
      internalSummaryFr: normalizeSupportSummaryText(source.internalSummaryFr),
    });
    // Keyed content hashes avoid exposing a dictionary oracle for private text.
    return createHmac("sha256", secret).update("support-normalization-content-v1\0").update(payload).digest("hex");
  } catch {
    return null;
  }
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update("support-normalization-receipt-v1\0").update(payload).digest("base64url");
}

function signaturesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createSupportNormalizationReceipt(input: {
  institutionId: string;
  category: string;
  messages: SupportConversationTurn[];
  reply: string;
  detectedLanguage: string | null;
  internalSummaryFr: string | null;
  requesterRefHash: string;
  usedAi: boolean;
  secret: string | undefined;
  now?: number;
}): { receipt: string; expiresAt: string } | null {
  if (input.usedAi !== true || !input.secret || input.secret.length < 32
    || !UUID_PATTERN.test(input.institutionId) || !CATEGORY_PATTERN.test(input.category)
    || !HASH_PATTERN.test(input.requesterRefHash) || !input.detectedLanguage || !input.internalSummaryFr) return null;
  const now = input.now ?? Date.now();
  if (!Number.isSafeInteger(now) || now < 0 || now > 8_640_000_000_000_000 - TTL_SECONDS * 1000) return null;
  const digest = contentHash({
    conversation: [...input.messages, { role: "assistant" as const, content: input.reply }].slice(-21),
    description: summarizeSupportDescription(input.messages
      .filter((message) => message.role === "requester").map((message) => message.content).join("\n\n")),
    detectedLanguage: input.detectedLanguage,
    internalSummaryFr: input.internalSummaryFr,
  }, input.secret);
  if (!digest) return null;
  const iat = Math.floor(now / 1000);
  const exp = iat + TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({
    v: 1, institutionId: input.institutionId, category: input.category,
    requesterRefHash: input.requesterRefHash, contentHash: digest, iat, exp,
  })).toString("base64url");
  return { receipt: `${payload}.${signature(payload, input.secret)}`, expiresAt: new Date(exp * 1000).toISOString() };
}

export function supportNormalizationProvenance(input: {
  request: { category: string; conversation: SupportConversationTurn[]; description: string; subjectContext: Record<string, string> };
  receipt: unknown;
  institutionId: string;
  requesterRefHash: string | null;
  secret: string | undefined;
  now?: number;
}): Record<string, string> {
  const context = input.request.subjectContext;
  const unverified = { normalizationStatus: context.internalSummaryFr ? "fourni_par_demandeur" : "non_disponible" };
  const receipt = input.receipt;
  const nowMs = input.now ?? Date.now();
  const now = Math.floor(nowMs / 1000);
  if (!input.secret || input.secret.length < 32 || !Number.isSafeInteger(nowMs) || nowMs < 0
    || nowMs > 8_640_000_000_000_000 - TTL_SECONDS * 1000
    || typeof receipt !== "string" || receipt.length < 80 || receipt.length > 2048
    || !RECEIPT_PATTERN.test(receipt)) return unverified;
  const [payload, suppliedSignature] = receipt.split(".");
  if (!signaturesMatch(signature(payload, input.secret), suppliedSignature)) return unverified;
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch { return unverified; }
  if (!claims || typeof claims !== "object" || Array.isArray(claims)
    || Object.keys(claims).length !== CLAIM_FIELDS.size || !Object.keys(claims).every((key) => CLAIM_FIELDS.has(key))
    || claims.v !== 1 || typeof claims.institutionId !== "string" || !UUID_PATTERN.test(claims.institutionId)
    || claims.institutionId !== input.institutionId || typeof claims.category !== "string" || !CATEGORY_PATTERN.test(claims.category)
    || claims.category !== input.request.category || typeof claims.requesterRefHash !== "string" || !HASH_PATTERN.test(claims.requesterRefHash)
    || claims.requesterRefHash !== input.requesterRefHash || typeof claims.contentHash !== "string" || !HASH_PATTERN.test(claims.contentHash)
    || typeof claims.iat !== "number" || !Number.isSafeInteger(claims.iat) || claims.iat < 0
    || typeof claims.exp !== "number" || !Number.isSafeInteger(claims.exp)
    || claims.exp - claims.iat !== TTL_SECONDS || claims.iat > now + 30 || claims.exp <= now) return unverified;
  const digest = contentHash({
    conversation: input.request.conversation,
    description: input.request.description,
    detectedLanguage: context.detectedLanguage,
    internalSummaryFr: context.internalSummaryFr,
  }, input.secret);
  if (!digest || !signaturesMatch(digest, claims.contentHash)) return unverified;
  return {
    normalizationStatus: "assistant_signe_a_verifier",
    normalizationReceiptHash: createHash("sha256").update(receipt).digest("hex"),
    normalizationSourceAt: new Date(claims.iat * 1000).toISOString(),
  };
}
