export type SupportAttachmentRemovalConfirmation = {
  status: "removed";
  operation: "support_attachment_draft_remove";
  publicCode: string;
  attachmentId: string;
  duplicate: boolean;
  confirmedAt: string;
  confirmationRef: string;
};

const PUBLIC_CODE_PATTERN = /^BC-[0-9]{4}-[0-9]{6}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONFIRMATION_WINDOW_MS = 5 * 60 * 1000;

export function createSupportAttachmentRemovalConfirmation(input: {
  publicCode: string;
  attachmentId: string;
  duplicate: boolean;
  confirmedAt: Date;
  correlationId: string;
}): SupportAttachmentRemovalConfirmation {
  if (
    !PUBLIC_CODE_PATTERN.test(input.publicCode)
    || !UUID_PATTERN.test(input.attachmentId)
    || !UUID_PATTERN.test(input.correlationId)
    || !Number.isFinite(input.confirmedAt.getTime())
  ) {
    throw new Error("Support attachment removal confirmation is invalid");
  }

  return {
    status: "removed",
    operation: "support_attachment_draft_remove",
    publicCode: input.publicCode,
    attachmentId: input.attachmentId,
    duplicate: input.duplicate,
    confirmedAt: input.confirmedAt.toISOString(),
    confirmationRef: `support:attachment-removal:${input.correlationId}`,
  };
}

export function verifySupportAttachmentRemovalConfirmation(input: {
  expectedPublicCode: string;
  expectedAttachmentId: string;
  confirmation: unknown;
  now?: number;
}): SupportAttachmentRemovalConfirmation | null {
  if (
    !PUBLIC_CODE_PATTERN.test(input.expectedPublicCode)
    || !UUID_PATTERN.test(input.expectedAttachmentId)
    || !input.confirmation
    || typeof input.confirmation !== "object"
    || Array.isArray(input.confirmation)
  ) {
    return null;
  }

  const confirmation = input.confirmation as Record<string, unknown>;
  const confirmedAt = typeof confirmation.confirmedAt === "string"
    ? Date.parse(confirmation.confirmedAt)
    : Number.NaN;
  const now = input.now ?? Date.now();

  if (
    confirmation.status !== "removed"
    || confirmation.operation !== "support_attachment_draft_remove"
    || confirmation.publicCode !== input.expectedPublicCode
    || confirmation.attachmentId !== input.expectedAttachmentId
    || typeof confirmation.duplicate !== "boolean"
    || typeof confirmation.confirmationRef !== "string"
    || !/^support:attachment-removal:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(confirmation.confirmationRef)
    || !Number.isFinite(confirmedAt)
    || confirmedAt > now + CONFIRMATION_WINDOW_MS
    || (confirmation.duplicate === false && confirmedAt < now - CONFIRMATION_WINDOW_MS)
  ) {
    return null;
  }

  return confirmation as SupportAttachmentRemovalConfirmation;
}
