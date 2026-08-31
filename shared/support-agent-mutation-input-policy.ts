const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TEMPLATE_FIELDS = new Set(["name", "bodyText", "category"]);
const TEMPLATE_REQUIRED_FIELDS = ["name", "bodyText"] as const;
const ATTACHMENT_RESERVATION_FIELDS = new Set(["fileName", "mimeType", "sizeBytes"]);
const INTERNAL_NOTE_FIELDS = new Set(["note"]);
const CALLBACK_CREATE_FIELDS = new Set(["phoneContactId"]);
const CALLBACK_CLAIM_FIELDS = new Set(["callbackId", "action"]);
const CALLBACK_COMPLETION_FIELDS = new Set(["callbackId", "action", "outcome"]);
const REQUEST_MUTATION_FIELDS = new Set([
  "expectedUpdatedAt",
  "status",
  "priority",
  "identityStatus",
  "identityMethod",
  "assignToMe",
  "assignedTeam",
  "closureReason",
  "duplicateDecision",
  "routingDecision",
]);
const REQUEST_MUTATION_ACTION_FIELDS = [...REQUEST_MUTATION_FIELDS]
  .filter((field) => field !== "expectedUpdatedAt");
const REQUEST_STATUSES = new Set([
  "nouveau",
  "a_qualifier",
  "assigne",
  "en_cours",
  "attente_demandeur",
  "attente_interne",
  "resolu",
  "clos",
  "indesirable",
]);
const REQUEST_PRIORITIES = new Set(["p1", "p2", "p3", "p4"]);
const REQUEST_IDENTITY_STATUSES = new Set(["non_verifiee", "contact_verifie", "identite_confirmee"]);
const REQUEST_IDENTITY_METHODS = new Set(["email_magic_link", "phone_callback", "official_roster"]);
const REQUEST_ASSIGNED_TEAMS = new Set([
  "referent_numerique",
  "ddfpt",
  "secretariat",
  "vie_scolaire",
  "intendance",
  "direction",
  "administration",
]);
const REPLY_FIELDS = new Set([
  "message",
  "expectedUpdatedAt",
  "attachmentIds",
  "safeTemplate",
  "translation",
]);
const REPLY_REQUIRED_FIELDS = ["message", "expectedUpdatedAt", "attachmentIds"] as const;
const REPLY_TRANSLATION_FIELDS = new Set([
  "sourceMessage",
  "targetLanguage",
  "receipt",
  "validated",
]);
const TRANSLATION_RECEIPT_PATTERN = /^[A-Za-z0-9_-]{1,1800}\.[A-Za-z0-9_-]{16,200}$/;

export type SupportAgentTemplateInput = {
  name: string;
  bodyText: string;
  category?: string;
};

export type SupportAgentAttachmentReservationInput = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type SupportAgentInternalNoteInput = { note: string };

export type SupportAgentCallbackCreateInput = { phoneContactId?: string };

export type SupportAgentCallbackMutationInput =
  | { callbackId: string; action: "claim" }
  | { callbackId: string; action: "complete" | "cancel"; outcome: string };

export type SupportAgentRequestMutationInput = {
  expectedUpdatedAt: string;
  status?: string;
  priority?: string;
  identityStatus?: string;
  identityMethod?: string;
  assignToMe?: true;
  assignedTeam?: string | null;
  closureReason?: string;
  duplicateDecision?: "confirmed" | "dismissed";
  routingDecision?: "confirmed";
};

export type SupportAgentReplyInput = {
  message: string;
  expectedUpdatedAt: string;
  attachmentIds: string[];
  safeTemplate?: "identity_verification";
  translation?: {
    sourceMessage: string;
    targetLanguage: string;
    receipt: string;
    validated: true;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactFields(value: Record<string, unknown>, fields: Set<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === fields.size && keys.every((key) => fields.has(key));
}

function hasOnlyFields(value: Record<string, unknown>, fields: Set<string>): boolean {
  return Object.keys(value).every((key) => fields.has(key));
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function isNonEmptyBoundedText(value: unknown, maxLength: number): value is string {
  return isBoundedText(value, maxLength) && value.trim().length > 0;
}

function isOptionalSetValue(value: unknown, allowed: Set<string>): boolean {
  return value === undefined || (typeof value === "string" && allowed.has(value));
}

export function singleSupportAgentRouteValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function isSupportAgentTemplateInput(value: unknown): value is SupportAgentTemplateInput {
  if (!isRecord(value)
    || !hasOnlyFields(value, TEMPLATE_FIELDS)
    || !TEMPLATE_REQUIRED_FIELDS.every((field) => Object.hasOwn(value, field))) {
    return false;
  }
  return isBoundedText(value.name, 80)
    && isBoundedText(value.bodyText, 5_000)
    && (value.category === undefined || isBoundedText(value.category, 60));
}

export function isSupportAgentAttachmentReservationInput(
  value: unknown
): value is SupportAgentAttachmentReservationInput {
  return isRecord(value)
    && hasExactFields(value, ATTACHMENT_RESERVATION_FIELDS)
    && isBoundedText(value.fileName, 180)
    && isBoundedText(value.mimeType, 150)
    && typeof value.sizeBytes === "number"
    && Number.isSafeInteger(value.sizeBytes)
    && value.sizeBytes >= 1
    && value.sizeBytes <= 10 * 1024 * 1024;
}

export function isSupportAgentInternalNoteInput(value: unknown): value is SupportAgentInternalNoteInput {
  return isRecord(value)
    && hasExactFields(value, INTERNAL_NOTE_FIELDS)
    && isBoundedText(value.note, 5_000);
}

export function isSupportAgentCallbackCreateInput(
  value: unknown
): value is SupportAgentCallbackCreateInput {
  return isRecord(value)
    && hasOnlyFields(value, CALLBACK_CREATE_FIELDS)
    && (value.phoneContactId === undefined
      || (typeof value.phoneContactId === "string" && UUID_PATTERN.test(value.phoneContactId)));
}

export function isSupportAgentCallbackMutationInput(
  value: unknown
): value is SupportAgentCallbackMutationInput {
  if (!isRecord(value) || typeof value.callbackId !== "string" || !UUID_PATTERN.test(value.callbackId)) {
    return false;
  }
  if (value.action === "claim") {
    return hasExactFields(value, CALLBACK_CLAIM_FIELDS);
  }
  if (value.action === "complete" || value.action === "cancel") {
    return hasExactFields(value, CALLBACK_COMPLETION_FIELDS)
      && isBoundedText(value.outcome, 1_000);
  }
  return false;
}

export function isSupportAgentRequestMutationInput(
  value: unknown
): value is SupportAgentRequestMutationInput {
  if (!isRecord(value)
    || !hasOnlyFields(value, REQUEST_MUTATION_FIELDS)
    || !Object.hasOwn(value, "expectedUpdatedAt")
    || !REQUEST_MUTATION_ACTION_FIELDS.some((field) => Object.hasOwn(value, field))
    || !isNonEmptyBoundedText(value.expectedUpdatedAt, 40)
    || !isOptionalSetValue(value.status, REQUEST_STATUSES)
    || !isOptionalSetValue(value.priority, REQUEST_PRIORITIES)
    || !isOptionalSetValue(value.identityStatus, REQUEST_IDENTITY_STATUSES)
    || !isOptionalSetValue(value.identityMethod, REQUEST_IDENTITY_METHODS)
    || (value.assignToMe !== undefined && value.assignToMe !== true)
    || (value.assignedTeam !== undefined
      && value.assignedTeam !== null
      && (typeof value.assignedTeam !== "string" || !REQUEST_ASSIGNED_TEAMS.has(value.assignedTeam)))
    || (value.closureReason !== undefined && !isBoundedText(value.closureReason, 500))
    || (value.duplicateDecision !== undefined
      && value.duplicateDecision !== "confirmed"
      && value.duplicateDecision !== "dismissed")
    || (value.routingDecision !== undefined && value.routingDecision !== "confirmed")) {
    return false;
  }
  return value.closureReason === undefined || value.status === "clos";
}

export function isSupportAgentReplyInput(value: unknown): value is SupportAgentReplyInput {
  if (!isRecord(value)
    || !hasOnlyFields(value, REPLY_FIELDS)
    || !REPLY_REQUIRED_FIELDS.every((field) => Object.hasOwn(value, field))
    || !isNonEmptyBoundedText(value.message, 10_000)
    || !isNonEmptyBoundedText(value.expectedUpdatedAt, 40)
    || !Array.isArray(value.attachmentIds)
    || value.attachmentIds.length > 5
    || value.attachmentIds.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))
    || new Set(value.attachmentIds).size !== value.attachmentIds.length
    || (value.safeTemplate !== undefined && value.safeTemplate !== "identity_verification")) {
    return false;
  }
  if (value.translation === undefined) return true;
  if (!isRecord(value.translation) || !hasExactFields(value.translation, REPLY_TRANSLATION_FIELDS)) {
    return false;
  }
  return isNonEmptyBoundedText(value.translation.sourceMessage, 5_000)
    && isNonEmptyBoundedText(value.translation.targetLanguage, 80)
    && typeof value.translation.receipt === "string"
    && TRANSLATION_RECEIPT_PATTERN.test(value.translation.receipt)
    && value.translation.validated === true;
}
