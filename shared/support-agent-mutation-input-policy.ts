const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TEMPLATE_FIELDS = new Set(["name", "bodyText", "category"]);
const TEMPLATE_REQUIRED_FIELDS = ["name", "bodyText"] as const;
const ATTACHMENT_RESERVATION_FIELDS = new Set(["fileName", "mimeType", "sizeBytes"]);
const INTERNAL_NOTE_FIELDS = new Set(["note"]);
const CALLBACK_CREATE_FIELDS = new Set(["phoneContactId"]);
const CALLBACK_CLAIM_FIELDS = new Set(["callbackId", "action"]);
const CALLBACK_COMPLETION_FIELDS = new Set(["callbackId", "action", "outcome"]);

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
