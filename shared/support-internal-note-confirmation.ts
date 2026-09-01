export type SupportInternalNoteConfirmation = {
  status: "stored";
  operation: "support_internal_note";
  publicCode: string;
  messageId: string;
  duplicate: boolean;
  messageCreatedAt: string;
  confirmedAt: string;
  confirmationRef: string;
};

const PUBLIC_CODE_PATTERN = /^BC-[0-9]{4}-[0-9]{6}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONFIRMATION_WINDOW_MS = 5 * 60 * 1000;
const CONFIRMATION_FIELDS = new Set([
  "status",
  "operation",
  "publicCode",
  "messageId",
  "duplicate",
  "messageCreatedAt",
  "confirmedAt",
  "confirmationRef",
]);

export function createSupportInternalNoteConfirmation(input: {
  publicCode: string;
  messageId: string;
  duplicate: boolean;
  messageCreatedAt: Date;
  confirmedAt: Date;
  correlationId: string;
}): SupportInternalNoteConfirmation {
  if (
    !PUBLIC_CODE_PATTERN.test(input.publicCode)
    || !UUID_PATTERN.test(input.messageId)
    || !UUID_PATTERN.test(input.correlationId)
    || !Number.isFinite(input.messageCreatedAt.getTime())
    || !Number.isFinite(input.confirmedAt.getTime())
    || input.messageCreatedAt.getTime() > input.confirmedAt.getTime()
  ) {
    throw new Error("Support internal note confirmation is invalid");
  }

  return {
    status: "stored",
    operation: "support_internal_note",
    publicCode: input.publicCode,
    messageId: input.messageId,
    duplicate: input.duplicate,
    messageCreatedAt: input.messageCreatedAt.toISOString(),
    confirmedAt: input.confirmedAt.toISOString(),
    confirmationRef: `support:internal-note:${input.correlationId}`,
  };
}

export function verifySupportInternalNoteConfirmation(input: {
  expectedPublicCode: string;
  confirmation: unknown;
  now?: number;
}): SupportInternalNoteConfirmation | null {
  if (
    !PUBLIC_CODE_PATTERN.test(input.expectedPublicCode)
    || !input.confirmation
    || typeof input.confirmation !== "object"
    || Array.isArray(input.confirmation)
  ) {
    return null;
  }

  const confirmation = input.confirmation as Record<string, unknown>;
  const keys = Object.keys(confirmation);
  const messageCreatedAt = typeof confirmation.messageCreatedAt === "string"
    ? Date.parse(confirmation.messageCreatedAt)
    : Number.NaN;
  const confirmedAt = typeof confirmation.confirmedAt === "string"
    ? Date.parse(confirmation.confirmedAt)
    : Number.NaN;
  const now = input.now ?? Date.now();

  if (
    keys.length !== CONFIRMATION_FIELDS.size
    || !keys.every((key) => CONFIRMATION_FIELDS.has(key))
    || confirmation.status !== "stored"
    || confirmation.operation !== "support_internal_note"
    || confirmation.publicCode !== input.expectedPublicCode
    || typeof confirmation.messageId !== "string"
    || !UUID_PATTERN.test(confirmation.messageId)
    || typeof confirmation.duplicate !== "boolean"
    || typeof confirmation.confirmationRef !== "string"
    || !/^support:internal-note:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(confirmation.confirmationRef)
    || !Number.isFinite(messageCreatedAt)
    || !Number.isFinite(confirmedAt)
    || confirmation.messageCreatedAt !== new Date(messageCreatedAt).toISOString()
    || confirmation.confirmedAt !== new Date(confirmedAt).toISOString()
    || messageCreatedAt > confirmedAt
    || confirmedAt > now + CONFIRMATION_WINDOW_MS
    || (confirmation.duplicate === false && confirmedAt < now - CONFIRMATION_WINDOW_MS)
  ) {
    return null;
  }

  return confirmation as SupportInternalNoteConfirmation;
}
