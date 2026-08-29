import { createHash, createHmac, randomBytes } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  supportDeviceSessions,
  supportRequests,
  supportSessionRequests,
} from "../../db/schema.js";
import { HttpError } from "./auth.js";
import { routeSupportRequest, type SupportRoute } from "../../shared/support-routing.js";
import {
  normalizeSupportConversation,
  SupportConversationValidationError,
  type SupportConversationTurn,
} from "../../shared/support-conversation.js";
import {
  neutralizeSupportPromptMarkers,
  pseudonymizeSupportText,
} from "../../shared/support-pseudonymizer.js";

export const SUPPORT_COOKIE = "bc_support_session";
export const SUPPORT_SESSION_DAYS = 30;
export const SUPPORT_MAGIC_TOKEN_MINUTES = 30;

const requesterTypes = new Set([
  "eleve",
  "parent",
  "professeur",
  "personnel",
  "autre",
]);
const beneficiaryTypes = new Set([
  "self",
  "eleve",
  "professeur",
  "personnel",
  "autre",
]);
const categories = new Set([
  "inscription",
  "affectation_classe",
  "documents_scolarite",
  "ent",
  "email_academique",
  "ordinateur",
  "logiciel",
  "restauration_bourse",
  "orientation_formation",
  "vie_scolaire",
  "autre",
]);
const channels = new Set(["email", "phone", "web"]);

export type SupportRequestInput = {
  requesterType: string;
  requesterFirstName: string;
  requesterLastName: string;
  beneficiaryType: string;
  beneficiaryFirstName: string | null;
  beneficiaryLastName: string | null;
  subjectContext: Record<string, string>;
  category: string;
  subcategory: string | null;
  subject: string;
  description: string;
  preferredChannel: string;
  fallbackAllowed: boolean;
  callbackRequested: boolean;
  email: string | null;
  phone: string | null;
  routing: SupportRoute;
  conversation: SupportConversationTurn[];
};

function cleanText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new HttpError(400, `${field} est requis`);
  const clean = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (!clean) throw new HttpError(400, `${field} est requis`);
  if (clean.length > maxLength) {
    throw new HttpError(400, `${field} dépasse ${maxLength} caractères`);
  }
  return clean;
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return cleanText(value, field, maxLength);
}

function selected(value: unknown, allowed: Set<string>, field: string): string {
  const clean = cleanText(value, field, 40);
  if (!allowed.has(clean)) throw new HttpError(400, `${field} est invalide`);
  return clean;
}

function normalizeEmail(value: unknown): string | null {
  const email = optionalText(value, "Email", 254)?.toLowerCase() ?? null;
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "L'adresse email est invalide");
  }
  return email;
}

function normalizePhone(value: unknown): string | null {
  const phone = optionalText(value, "Téléphone", 30);
  if (!phone) return null;
  const normalized = phone.replace(/[^\d+]/g, "").replace(/^00/, "+");
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    throw new HttpError(400, "Le numéro de téléphone est invalide");
  }
  return normalized;
}

function contextValue(value: unknown, field: string): string | undefined {
  const clean = optionalText(value, field, 120);
  return clean ?? undefined;
}

export function parseSupportRequest(body: unknown): SupportRequestInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Le formulaire est invalide");
  }
  const input = body as Record<string, unknown>;
  if (input.website) throw new HttpError(400, "Le formulaire est invalide");

  const requesterType = selected(input.requesterType, requesterTypes, "Profil");
  const beneficiaryType = selected(
    input.beneficiaryType ?? "self",
    beneficiaryTypes,
    "Bénéficiaire"
  );
  const category = selected(input.category, categories, "Catégorie");
  const preferredChannel = selected(input.preferredChannel, channels, "Canal préféré");
  const requesterFirstName = cleanText(input.requesterFirstName, "Prénom", 100);
  const requesterLastName = cleanText(input.requesterLastName, "Nom", 100);
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const callbackRequested = input.communicationSupport === true;
  const subject = cleanText(input.subject, "Objet", 180);
  const description = cleanText(input.description, "Description", 5000);
  const routing = routeSupportRequest({ category, subject, description });
  const detectedLanguage = optionalText(input.detectedLanguage, "Langue détectée", 60);
  const rawInternalSummaryFr = optionalText(input.internalSummaryFr, "Résumé français", 700);
  if (Boolean(detectedLanguage) !== Boolean(rawInternalSummaryFr)) {
    throw new HttpError(400, "La reformulation multilingue est incomplète");
  }
  const internalSummaryFr = rawInternalSummaryFr
    ? neutralizeSupportPromptMarkers(pseudonymizeSupportText(rawInternalSummaryFr))
    : null;
  let conversation: SupportConversationTurn[];
  try {
    conversation = normalizeSupportConversation(input.conversation);
  } catch (error) {
    if (error instanceof SupportConversationValidationError) {
      throw new HttpError(400, error.message);
    }
    throw error;
  }

  if (!email && !phone) {
    throw new HttpError(400, "Indiquez un email ou un téléphone pour recevoir la réponse");
  }
  if (preferredChannel === "email" && !email) {
    throw new HttpError(400, "Un email est requis pour ce canal de réponse");
  }
  if (preferredChannel === "phone" && !phone) {
    throw new HttpError(400, "Un téléphone est requis pour ce canal de réponse");
  }
  if (callbackRequested && !phone) {
    throw new HttpError(400, "Un téléphone est requis pour demander un rappel");
  }

  const beneficiaryFirstName =
    beneficiaryType === "self"
      ? requesterFirstName
      : optionalText(input.beneficiaryFirstName, "Prénom du bénéficiaire", 100);
  const beneficiaryLastName =
    beneficiaryType === "self"
      ? requesterLastName
      : optionalText(input.beneficiaryLastName, "Nom du bénéficiaire", 100);

  if (beneficiaryType !== "self" && (!beneficiaryFirstName || !beneficiaryLastName)) {
    throw new HttpError(400, "Indiquez la personne concernée par la demande");
  }

  const subjectContext = Object.fromEntries(
    Object.entries({
      className: contextValue(input.className, "Classe"),
      subjectArea: contextValue(input.subjectArea, "Matière ou service"),
      schoolTrack: contextValue(input.schoolTrack, "Voie"),
      languagePreference: contextValue(input.languagePreference, "Langue souhaitée"),
      detectedLanguage: detectedLanguage ?? undefined,
      internalSummaryFr: internalSummaryFr ?? undefined,
      normalizationStatus: internalSummaryFr ? "automatique_a_verifier" : "non_disponible",
      communicationSupport:
        callbackRequested
          ? "Rappel téléphonique souhaité pour faciliter la compréhension"
          : undefined,
      routingConfidence: routing.confidence,
      routingReason: routing.reason,
      requiredIdentity: routing.requiredIdentity,
    }).filter((entry): entry is [string, string] => Boolean(entry[1]))
  );

  return {
    requesterType,
    requesterFirstName,
    requesterLastName,
    beneficiaryType,
    beneficiaryFirstName,
    beneficiaryLastName,
    subjectContext,
    category,
    subcategory: optionalText(input.subcategory, "Sous-catégorie", 100),
    subject,
    description,
    preferredChannel,
    fallbackAllowed: input.fallbackAllowed === true,
    callbackRequested,
    email,
    phone,
    routing,
    conversation,
  };
}

export function opaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function personalHash(value: string): string {
  const secret = process.env.SUPPORT_HASH_SECRET;
  if (!secret || secret.length < 32) {
    throw new HttpError(503, "Le service de demandes est momentanément indisponible");
  }
  return createHmac("sha256", secret).update(value).digest("hex");
}

function firstHeaderValue(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value?.split(",")[0];
  return first?.trim() || null;
}

export function requestIpHash(req: VercelRequest): string | null {
  const value =
    firstHeaderValue(req.headers["x-vercel-forwarded-for"]) ??
    firstHeaderValue(req.headers["x-forwarded-for"]);
  return value ? personalHash(value) : null;
}

export async function enforceSupportRateLimit(input: {
  scope:
    | "assistant_session"
    | "assistant_network"
    | "request_network"
    | "message_session"
    | "magic_token_network"
    | "content_ai_user";
  keyHash: string;
  limit: number;
  windowSeconds: number;
}): Promise<void> {
  const result = await db.execute(sql<{ request_count: number }>`
    insert into public.support_rate_limits (
      scope, key_hash, window_started_at, request_count, expires_at
    ) values (
      ${input.scope}, ${input.keyHash}, now(), 1,
      now() + (${input.windowSeconds} * interval '1 second')
    )
    on conflict (scope, key_hash) do update
    set
      window_started_at = case
        when public.support_rate_limits.expires_at <= now() then now()
        else public.support_rate_limits.window_started_at
      end,
      request_count = case
        when public.support_rate_limits.expires_at <= now() then 1
        else public.support_rate_limits.request_count + 1
      end,
      expires_at = case
        when public.support_rate_limits.expires_at <= now()
          then now() + (${input.windowSeconds} * interval '1 second')
        else public.support_rate_limits.expires_at
      end
    where public.support_rate_limits.expires_at <= now()
       or public.support_rate_limits.request_count < ${input.limit}
    returning request_count
  `);
  if (Array.from(result as unknown as Array<{ request_count: number }>).length === 0) {
    throw new HttpError(429, "Trop de demandes envoyées. Réessayez dans quelques minutes.");
  }
}

function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").flatMap((part) => {
      const separator = part.indexOf("=");
      if (separator < 1) return [];
      const key = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      return [[key, decodeURIComponent(value)]];
    })
  );
}

export function readSupportSessionToken(req: VercelRequest): string | null {
  return parseCookieHeader(req.headers.cookie)[SUPPORT_COOKIE] ?? null;
}

export function setSupportSessionCookie(res: VercelResponse, token: string): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAge = SUPPORT_SESSION_DAYS * 24 * 60 * 60;
  res.setHeader(
    "Set-Cookie",
    `${SUPPORT_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
  );
}

export async function requireSupportAccess(
  req: VercelRequest,
  publicCode: string
): Promise<{ requestId: string; sessionId: string }> {
  const token = readSupportSessionToken(req);
  if (!token) throw new HttpError(401, "Ouvrez le lien sécurisé reçu pour accéder au dossier");

  const [access] = await db
    .select({ requestId: supportRequests.id, sessionId: supportDeviceSessions.id })
    .from(supportDeviceSessions)
    .innerJoin(
      supportSessionRequests,
      eq(supportSessionRequests.sessionId, supportDeviceSessions.id)
    )
    .innerJoin(supportRequests, eq(supportRequests.id, supportSessionRequests.requestId))
    .where(
      and(
        eq(supportDeviceSessions.sessionHash, sha256(token)),
        gt(supportDeviceSessions.expiresAt, new Date()),
        isNull(supportDeviceSessions.revokedAt),
        eq(supportRequests.publicCode, publicCode)
      )
    )
    .limit(1);

  if (!access) throw new HttpError(403, "Accès au dossier refusé");

  await db
    .update(supportDeviceSessions)
    .set({ lastUsedAt: new Date() })
    .where(eq(supportDeviceSessions.id, access.sessionId));

  return access;
}

export function idempotencyKey(req: VercelRequest): string {
  const header = req.headers["idempotency-key"];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || value.length < 16 || value.length > 200) {
    throw new HttpError(400, "Clé d'envoi absente ou invalide");
  }
  return value;
}
