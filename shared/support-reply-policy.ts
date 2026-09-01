import { routeSupportRequest } from "./support-routing.js";
import type { AgentIdentityLevel } from "./agent-identity-policy.js";

export const SUPPORT_IDENTITY_VERIFICATION_MESSAGE =
  "Bonjour, pour protéger vos informations, nous devons d’abord confirmer votre identité avec une source officielle du lycée. Ne transmettez aucun mot de passe ni aucun code reçu par SMS. Nous revenons vers vous dès que la vérification est terminée.";

type SupportReplyIdentityRequest = {
  category: string;
  subject?: string;
  description: string;
  subjectContext?: unknown;
};

function replyIdentityContext(request: SupportReplyIdentityRequest): Record<string, unknown> {
  const context = request.subjectContext;
  return context && typeof context === "object" && !Array.isArray(context)
    ? context as Record<string, unknown>
    : {};
}

function replyIdentityLevel(request: SupportReplyIdentityRequest): AgentIdentityLevel {
  const level = replyIdentityContext(request).requiredIdentity;
  if (level === "I4") return level;
  // Preserve the existing access-code restriction, even if urgent wording
  // lowered the intake routing level. Intake priority grants no access codes.
  if (request.category === "ent" || request.category === "email_academique") return "I3";
  // This level is written by server routing, including the deliberate I0
  // emergency exception. Historical records are routed again if it is absent.
  if (level === "I0" || level === "I1" || level === "I2" || level === "I3") {
    return level;
  }
  return routeSupportRequest(request).requiredIdentity;
}

export function supportReplyRequiresSchoolIdentity(request: SupportReplyIdentityRequest): boolean {
  const level = replyIdentityLevel(request);
  return level === "I3" || level === "I4";
}

export function supportReplyNeedsIdentityCheck(request: SupportReplyIdentityRequest): boolean {
  const level = replyIdentityLevel(request);
  // The current manual confirmation proves I3, never I4.
  return level === "I4"
    || (level === "I3" && replyIdentityContext(request).identityStatus !== "identite_confirmee");
}

const NON_TRANSLATED_LANGUAGES = new Set([
  "francais",
  "français",
  "french",
  "indeterminee",
  "indéterminée",
  "indetermine",
  "indéterminé",
]);

export function supportTranslationTargetLanguage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const language = value.trim().replace(/\s+/g, " ");
  if (language.length < 2 || language.length > 60) return null;
  if (!/^[\p{L}\p{M}'’ -]+$/u.test(language)) return null;
  return NON_TRANSLATED_LANGUAGES.has(language.toLocaleLowerCase("fr-FR"))
    ? null
    : language;
}

export function normalizeSupportReplyText(value: unknown, maxLength = 10_000): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
  return text && text.length <= maxLength ? text : null;
}
