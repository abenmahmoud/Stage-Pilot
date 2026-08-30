import { createHash } from "node:crypto";
import type { CommunicationDraftInput } from "./communication-draft.js";
import { detectForbiddenSupportSecret } from "./support-secret-policy.js";

export type CommunicationForwardedEmailContext = {
  sourceAuthorized: boolean;
  externalMessageHash: string;
  attachmentCount: number;
};

export type CommunicationForwardedEmailResult = {
  draft: CommunicationDraftInput;
  sourceFingerprint: string;
  visibility: "internal";
  status: "draft";
  privacySignals: Array<"email_address" | "phone_number">;
  redactionRequiredBeforeAi: boolean;
  requiresHumanReview: true;
  canPublish: false;
  canNotify: false;
};

const INPUT_FIELDS = new Set(["subject", "extractedText"]);
const FORWARDED_MARKER = /^(?:-{2,}\s*)?(?:message\s+transf[eé]r[eé]|forwarded\s+message|mensaje\s+reenviado)(?:\s*-{2,})?$/iu;
const TRANSPORT_HEADER = /^(?:de|from|envoy[eé]|sent|date|objet|subject|[aà]|to|cc)\s*:/iu;
const REPLY_MARKER = /^(?:le\s+.+\s+a\s+[eé]crit\s*:|on\s+.+\s+wrote\s*:|el\s+.+\s+escribi[oó]\s*:)/iu;
const EMAIL_ADDRESS = /\b[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+\b/iu;
const PHONE_NUMBER = /(?:\+33|0)[\s.-]?[1-9](?:[\s.-]?\d{2}){4}\b/u;
const REMOTE_MARKDOWN_IMAGE = /!\[([^\]]{0,200})\]\((?:https?:)?\/\/[^)]+\)/giu;

function boundedSubject(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error("subject_invalid");
  const normalized = value.normalize("NFC").trim().replace(/\s+/g, " ");
  if (normalized.length > 500 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error("subject_invalid");
  }
  return normalized;
}

function boundedBody(value: unknown): string {
  if (typeof value !== "string") throw new Error("body_invalid");
  const normalized = value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u202a-\u202e\u2066-\u2069]/gu, "")
    .trim();
  if (
    normalized.length < 1 ||
    normalized.length > 100_000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error("body_invalid");
  }
  if (/<\s*(?:script|style|iframe|object|embed|form)\b/iu.test(normalized)) {
    throw new Error("unsafe_markup_forbidden");
  }
  return normalized;
}

function startAfterForwardedHeaders(lines: string[]): number {
  const markerIndex = lines.findIndex((line) => FORWARDED_MARKER.test(line.trim()));
  if (markerIndex < 0) return 0;
  let index = markerIndex + 1;
  while (index < lines.length && lines[index].trim() === "") index += 1;
  let headerCount = 0;
  while (index < lines.length && TRANSPORT_HEADER.test(lines[index].trim())) {
    headerCount += 1;
    index += 1;
  }
  while (index < lines.length && lines[index].trim() === "") index += 1;
  return headerCount > 0 ? index : markerIndex + 1;
}

function sanitizeForwardedBody(value: string): string {
  const lines = value.split("\n");
  const start = startAfterForwardedHeaders(lines);
  const bodyLines = lines.slice(start);
  const replyIndex = bodyLines.findIndex((line) => REPLY_MARKER.test(line.trim()));
  const currentMessage = replyIndex >= 0 ? bodyLines.slice(0, replyIndex) : bodyLines;
  const withoutRemoteImages = currentMessage
    .join("\n")
    .replace(REMOTE_MARKDOWN_IMAGE, (_match, alt: string) =>
      alt.trim() ? `[Image externe non chargée : ${alt.trim()}]` : "[Image externe non chargée]"
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!withoutRemoteImages) throw new Error("body_empty_after_sanitization");
  return withoutRemoteImages;
}

function normalizedTitle(subject: string): string {
  const withoutPrefixes = subject.replace(/^(?:(?:re|tr|fwd?|transfert)\s*:\s*)+/iu, "").trim();
  return (withoutPrefixes || "Information reçue").slice(0, 180);
}

function plainSummary(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

function sourceFingerprint(externalMessageHash: string): string {
  return createHash("sha256")
    .update("lyceegest:communication:forwarded-email-source:v1")
    .update("\0")
    .update(externalMessageHash)
    .digest("hex");
}

function parseContext(value: CommunicationForwardedEmailContext): CommunicationForwardedEmailContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("context_invalid");
  if (value.sourceAuthorized !== true) throw new Error("source_not_authorized");
  if (!/^[a-f0-9]{64}$/.test(value.externalMessageHash)) throw new Error("message_hash_invalid");
  if (!Number.isInteger(value.attachmentCount) || value.attachmentCount < 0 || value.attachmentCount > 20) {
    throw new Error("attachment_count_invalid");
  }
  return value;
}

export function prepareCommunicationForwardedEmailDraft(
  value: unknown,
  rawContext: CommunicationForwardedEmailContext
): CommunicationForwardedEmailResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("input_invalid");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !INPUT_FIELDS.has(key))) throw new Error("unknown_field");
  const context = parseContext(rawContext);
  const subject = boundedSubject(input.subject);
  const bodyMarkdown = sanitizeForwardedBody(boundedBody(input.extractedText));
  const title = normalizedTitle(subject);
  if (detectForbiddenSupportSecret(`${title}\n${bodyMarkdown}`)) throw new Error("secret_forbidden");

  const privacySignals: CommunicationForwardedEmailResult["privacySignals"] = [];
  if (EMAIL_ADDRESS.test(bodyMarkdown)) privacySignals.push("email_address");
  if (PHONE_NUMBER.test(bodyMarkdown)) privacySignals.push("phone_number");

  const openQuestions = [
    "Confirmer le titre, la visibilité, le public et les dates avant toute publication ou diffusion.",
  ];
  if (!subject) openQuestions.unshift("Confirmer le titre proposé.");
  if (privacySignals.length > 0) {
    openQuestions.push("Retirer les données personnelles inutiles avant toute aide IA.");
  }
  if (context.attachmentCount > 0) {
    openQuestions.push("Vérifier les pièces jointes dans l’espace privé avant de les utiliser.");
  }

  return {
    draft: {
      sourceType: "forwarded_email",
      title,
      summary: plainSummary(bodyMarkdown),
      bodyMarkdown,
      category: "information",
      templateKey: null,
      structuredFacts: { dates: [], times: [], places: [], documents: [], actions: [] },
      openQuestions,
    },
    sourceFingerprint: sourceFingerprint(context.externalMessageHash),
    visibility: "internal",
    status: "draft",
    privacySignals,
    redactionRequiredBeforeAi: privacySignals.length > 0,
    requiresHumanReview: true,
    canPublish: false,
    canNotify: false,
  };
}
