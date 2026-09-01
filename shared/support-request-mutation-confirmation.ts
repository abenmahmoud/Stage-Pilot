export type SupportRequestMutationConfirmation = {
  status: "persisted";
  operation: "support_request_update";
  publicCode: string;
  previousRevision: string;
  revision: string;
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
  "previousRevision",
  "revision",
  "confirmedAt",
  "confirmationRef",
]);

export function createSupportRequestMutationConfirmation(input: {
  publicCode: string;
  previousRevision: Date;
  revision: Date;
  confirmedAt: Date;
  correlationId: string;
}): SupportRequestMutationConfirmation {
  if (
    !PUBLIC_CODE_PATTERN.test(input.publicCode)
    || !Number.isFinite(input.previousRevision.getTime())
    || !Number.isFinite(input.revision.getTime())
    || !Number.isFinite(input.confirmedAt.getTime())
    || !UUID_PATTERN.test(input.correlationId)
  ) {
    throw new Error("Support request mutation confirmation is invalid");
  }

  return {
    status: "persisted",
    operation: "support_request_update",
    publicCode: input.publicCode,
    previousRevision: input.previousRevision.toISOString(),
    revision: input.revision.toISOString(),
    confirmedAt: input.confirmedAt.toISOString(),
    confirmationRef: `support:request-update:${input.correlationId}`,
  };
}

export function verifySupportRequestMutationConfirmation(input: {
  expectedPublicCode: string;
  expectedPreviousRevision: string;
  confirmation: unknown;
  now?: number;
}): SupportRequestMutationConfirmation | null {
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
  const expectedPreviousRevision = Date.parse(input.expectedPreviousRevision);
  const revision = typeof confirmation.revision === "string"
    ? Date.parse(confirmation.revision)
    : Number.NaN;
  const confirmedAt = typeof confirmation.confirmedAt === "string"
    ? Date.parse(confirmation.confirmedAt)
    : Number.NaN;
  const now = input.now ?? Date.now();

  if (
    keys.length !== CONFIRMATION_FIELDS.size
    || !keys.every((key) => CONFIRMATION_FIELDS.has(key))
    || confirmation.status !== "persisted"
    || confirmation.operation !== "support_request_update"
    || confirmation.publicCode !== input.expectedPublicCode
    || !Number.isFinite(expectedPreviousRevision)
    || confirmation.previousRevision !== new Date(expectedPreviousRevision).toISOString()
    || typeof confirmation.confirmationRef !== "string"
    || !/^support:request-update:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(confirmation.confirmationRef)
    || !Number.isFinite(revision)
    || !Number.isFinite(confirmedAt)
    || confirmation.revision !== new Date(revision).toISOString()
    || confirmation.confirmedAt !== new Date(confirmedAt).toISOString()
    || confirmedAt < now - CONFIRMATION_WINDOW_MS
    || confirmedAt > now + CONFIRMATION_WINDOW_MS
    || revision > confirmedAt + CONFIRMATION_WINDOW_MS
    || revision < expectedPreviousRevision
  ) {
    return null;
  }

  return confirmation as SupportRequestMutationConfirmation;
}
