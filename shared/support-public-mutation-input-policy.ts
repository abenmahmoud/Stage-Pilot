const PUBLIC_CODE_PATTERN = /^BC-[0-9]{4}-[0-9]{6}$/;
const MESSAGE_FIELDS = new Set(["message"]);
const ATTACHMENT_CONFIRMATION_FIELDS = new Set(["publicCode"]);
const ATTACHMENT_RESERVATION_FIELDS = new Set([
  "fileName",
  "mimeType",
  "sizeBytes",
  "concernsType",
  "concernsLabel",
  "documentType",
  "note",
]);
const REQUIRED_ATTACHMENT_RESERVATION_FIELDS = ["fileName", "mimeType", "sizeBytes"] as const;

export type SupportRequesterMessageInput = { message: string };

export type SupportAttachmentConfirmationInput = { publicCode: string };

export type SupportRequesterAttachmentReservationInput = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  concernsType?: string | null;
  concernsLabel?: string | null;
  documentType?: string | null;
  note?: string | null;
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

function isOptionalBoundedText(value: unknown, maxLength: number): boolean {
  return value === undefined
    || value === null
    || (typeof value === "string" && value.trim().length <= maxLength);
}

export function singleSupportQueryValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function isSupportRequesterMessageInput(value: unknown): value is SupportRequesterMessageInput {
  return isRecord(value)
    && hasExactFields(value, MESSAGE_FIELDS)
    && typeof value.message === "string"
    && value.message.length <= 5_000;
}

export function isSupportAttachmentConfirmationInput(
  value: unknown
): value is SupportAttachmentConfirmationInput {
  return isRecord(value)
    && hasExactFields(value, ATTACHMENT_CONFIRMATION_FIELDS)
    && typeof value.publicCode === "string"
    && PUBLIC_CODE_PATTERN.test(value.publicCode);
}

export function isSupportRequesterAttachmentReservationInput(
  value: unknown
): value is SupportRequesterAttachmentReservationInput {
  if (!isRecord(value)
    || !hasOnlyFields(value, ATTACHMENT_RESERVATION_FIELDS)
    || !REQUIRED_ATTACHMENT_RESERVATION_FIELDS.every((field) => Object.hasOwn(value, field))) {
    return false;
  }
  return typeof value.fileName === "string"
    && value.fileName.length <= 180
    && typeof value.mimeType === "string"
    && value.mimeType.length <= 150
    && typeof value.sizeBytes === "number"
    && Number.isSafeInteger(value.sizeBytes)
    && value.sizeBytes >= 1
    && value.sizeBytes <= 10 * 1024 * 1024
    && isOptionalBoundedText(value.concernsType, 50)
    && isOptionalBoundedText(value.concernsLabel, 180)
    && isOptionalBoundedText(value.documentType, 80)
    && isOptionalBoundedText(value.note, 500);
}
