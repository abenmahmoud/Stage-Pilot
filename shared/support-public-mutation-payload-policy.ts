import {
  verifySupportAttachmentRemovalConfirmation,
  type SupportAttachmentRemovalConfirmation,
} from "./support-attachment-removal-confirmation.js";
import {
  verifySupportRequesterMessageConfirmation,
  type SupportRequesterMessageConfirmation,
} from "./support-requester-message-confirmation.js";

const ROOT_CONFIRMATION_FIELDS = new Set(["confirmation"]);
const ATTACHMENT_CONFIRMATION_FIELDS = new Set(["attachment", "duplicate"]);
const ATTACHMENT_FIELDS = new Set(["id", "scanStatus"]);
const SESSION_CLEAR_FIELDS = new Set(["cleared"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SupportAttachmentConfirmationPayload = {
  attachment: {
    id: string;
    scanStatus: "quarantine" | "clean";
  };
  duplicate: boolean;
};

export type SupportSessionClearPayload = { cleared: true };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactFields(value: Record<string, unknown>, fields: Set<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === fields.size && keys.every((key) => fields.has(key));
}

export function isSupportAttachmentConfirmationPayload(
  value: unknown,
  expectedAttachmentId: string
): value is SupportAttachmentConfirmationPayload {
  return UUID_PATTERN.test(expectedAttachmentId)
    && isRecord(value)
    && hasExactFields(value, ATTACHMENT_CONFIRMATION_FIELDS)
    && isRecord(value.attachment)
    && hasExactFields(value.attachment, ATTACHMENT_FIELDS)
    && value.attachment.id === expectedAttachmentId
    && (value.attachment.scanStatus === "quarantine" || value.attachment.scanStatus === "clean")
    && typeof value.duplicate === "boolean";
}

export function verifySupportRequesterMessageMutationPayload(input: {
  value: unknown;
  expectedPublicCode: string;
  now?: number;
}): SupportRequesterMessageConfirmation | null {
  if (!isRecord(input.value) || !hasExactFields(input.value, ROOT_CONFIRMATION_FIELDS)) {
    return null;
  }
  return verifySupportRequesterMessageConfirmation({
    expectedPublicCode: input.expectedPublicCode,
    confirmation: input.value.confirmation,
    now: input.now,
  });
}

export function verifySupportAttachmentRemovalMutationPayload(input: {
  value: unknown;
  expectedPublicCode: string;
  expectedAttachmentId: string;
  now?: number;
}): SupportAttachmentRemovalConfirmation | null {
  if (!isRecord(input.value) || !hasExactFields(input.value, ROOT_CONFIRMATION_FIELDS)) {
    return null;
  }
  return verifySupportAttachmentRemovalConfirmation({
    expectedPublicCode: input.expectedPublicCode,
    expectedAttachmentId: input.expectedAttachmentId,
    confirmation: input.value.confirmation,
    now: input.now,
  });
}

export function isSupportSessionClearPayload(value: unknown): value is SupportSessionClearPayload {
  return isRecord(value)
    && hasExactFields(value, SESSION_CLEAR_FIELDS)
    && value.cleared === true;
}
