import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { SchoolService } from "./support-routing.js";

const RECEIPT_VERSION = 1;
const RECEIPT_TTL_SECONDS = 15 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CATEGORY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
const SERVICES = new Set<SchoolService>([
  "referent_numerique",
  "ddfpt",
  "secretariat",
  "vie_scolaire",
  "intendance",
  "direction",
  "administration",
]);

export type SupportAssistantActionGrant = {
  toolKey: "support.create_request";
  skillVersionId: string;
  requesterRefHash: string;
};

type RoutingReceiptClaims = {
  v: 1;
  institutionId: string;
  category: string;
  service: SchoolService;
  usedAi: boolean;
  model: string | null;
  actionGrant?: SupportAssistantActionGrant | null;
  iat: number;
  exp: number;
  nonce: string;
};

export type VerifiedSupportAssistantRoutingReceipt = Omit<
  RoutingReceiptClaims,
  "v" | "iat" | "exp" | "nonce"
> & {
  receiptHash: string;
  issuedAt: Date;
  expiresAt: Date;
};

function validSecret(secret: string | undefined): secret is string {
  return typeof secret === "string" && secret.length >= 32;
}

export function supportAssistantRoutingReviewEnabled(): boolean {
  return process.env.SUPPORT_ASSISTANT_ROUTING_REVIEW_ENABLED === "true";
}

export function supportAgentCreateRequestActionEnabled(): boolean {
  return process.env.SUPPORT_AGENT_CREATE_REQUEST_ACTION_ENABLED === "true";
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update("support-assistant-routing-receipt-v1\0")
    .update(payload)
    .digest("base64url");
}

function signaturesMatch(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function validModel(model: string | null): boolean {
  return model === null || (model.length >= 1 && model.length <= 80 && !/[\u0000-\u001f]/.test(model));
}

function validActionGrant(value: unknown): value is SupportAssistantActionGrant {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const grant = value as Record<string, unknown>;
  return Object.keys(grant).length === 3
    && grant.toolKey === "support.create_request"
    && typeof grant.skillVersionId === "string"
    && UUID_PATTERN.test(grant.skillVersionId)
    && typeof grant.requesterRefHash === "string"
    && SHA256_PATTERN.test(grant.requesterRefHash);
}

export function createSupportAssistantRoutingReceipt(input: {
  institutionId: string;
  category: string;
  service: SchoolService;
  usedAi: boolean;
  model: string | null;
  actionGrant?: SupportAssistantActionGrant | null;
  secret: string | undefined;
  now?: number;
  nonce?: string;
}): { receipt: string; expiresAt: string } | null {
  if (
    !validSecret(input.secret) ||
    !UUID_PATTERN.test(input.institutionId) ||
    !CATEGORY_PATTERN.test(input.category) ||
    !SERVICES.has(input.service) ||
    !validModel(input.model) ||
    (input.actionGrant !== undefined
      && input.actionGrant !== null
      && !validActionGrant(input.actionGrant)) ||
    (input.usedAi && input.model === null) ||
    (!input.usedAi && input.model !== null)
  ) {
    return null;
  }
  const now = input.now ?? Date.now();
  if (!Number.isFinite(now)) return null;
  const issuedAt = Math.floor(now / 1000);
  const claims: RoutingReceiptClaims = {
    v: RECEIPT_VERSION,
    institutionId: input.institutionId,
    category: input.category,
    service: input.service,
    usedAi: input.usedAi,
    model: input.model,
    actionGrant: input.actionGrant ?? null,
    iat: issuedAt,
    exp: issuedAt + RECEIPT_TTL_SECONDS,
    nonce: input.nonce ?? randomUUID(),
  };
  if (!UUID_PATTERN.test(claims.nonce)) return null;
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return {
    receipt: `${payload}.${signature(payload, input.secret)}`,
    expiresAt: new Date(claims.exp * 1000).toISOString(),
  };
}

export function verifySupportAssistantRoutingReceipt(input: {
  receipt: unknown;
  institutionId: string;
  category: string;
  service: SchoolService;
  expectedRequesterRefHash?: string | null;
  secret: string | undefined;
  now?: number;
}): VerifiedSupportAssistantRoutingReceipt | null {
  if (
    typeof input.receipt !== "string" ||
    input.receipt.length < 80 ||
    input.receipt.length > 2048 ||
    !validSecret(input.secret)
  ) {
    return null;
  }
  const [payload, suppliedSignature, extra] = input.receipt.split(".");
  if (
    !payload ||
    !suppliedSignature ||
    extra ||
    !signaturesMatch(suppliedSignature, signature(payload, input.secret))
  ) {
    return null;
  }
  let claims: RoutingReceiptClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as RoutingReceiptClaims;
  } catch {
    return null;
  }
  const now = Math.floor((input.now ?? Date.now()) / 1000);
  const actionGrant = claims.actionGrant ?? null;
  if (
    claims.v !== RECEIPT_VERSION ||
    !UUID_PATTERN.test(claims.institutionId) ||
    !CATEGORY_PATTERN.test(claims.category) ||
    !SERVICES.has(claims.service) ||
    typeof claims.usedAi !== "boolean" ||
    !validModel(claims.model) ||
    (actionGrant !== null && !validActionGrant(actionGrant)) ||
    (actionGrant !== null
      && (!input.expectedRequesterRefHash
        || actionGrant.requesterRefHash !== input.expectedRequesterRefHash)) ||
    (claims.usedAi && claims.model === null) ||
    (!claims.usedAi && claims.model !== null) ||
    !Number.isInteger(claims.iat) ||
    !Number.isInteger(claims.exp) ||
    claims.exp - claims.iat !== RECEIPT_TTL_SECONDS ||
    claims.iat > now + 30 ||
    claims.exp < now ||
    !UUID_PATTERN.test(claims.nonce) ||
    claims.institutionId !== input.institutionId ||
    claims.category !== input.category ||
    claims.service !== input.service
  ) {
    return null;
  }
  return {
    institutionId: claims.institutionId,
    category: claims.category,
    service: claims.service,
    usedAi: claims.usedAi,
    model: claims.model,
    actionGrant,
    receiptHash: createHash("sha256").update(input.receipt).digest("hex"),
    issuedAt: new Date(claims.iat * 1000),
    expiresAt: new Date(claims.exp * 1000),
  };
}
