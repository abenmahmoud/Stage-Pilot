export type SupportRequestPersistenceConfirmation = {
  status: "persisted";
  publicCode: string;
  confirmedAt: string;
  confirmationRef: string;
};

const PUBLIC_CODE_PATTERN = /^BC-[0-9]{4}-[0-9]{6}$/;
const CONFIRMATION_WINDOW_MS = 5 * 60 * 1000;
const CONFIRMATION_FIELDS = new Set([
  "status",
  "publicCode",
  "confirmedAt",
  "confirmationRef",
]);

export function createSupportRequestPersistenceConfirmation(input: {
  publicCode: string;
  confirmedAt: Date;
}): SupportRequestPersistenceConfirmation {
  if (!PUBLIC_CODE_PATTERN.test(input.publicCode) || !Number.isFinite(input.confirmedAt.getTime())) {
    throw new Error("Support request confirmation is invalid");
  }
  return {
    status: "persisted",
    publicCode: input.publicCode,
    confirmedAt: input.confirmedAt.toISOString(),
    confirmationRef: `support:${input.publicCode}`,
  };
}

export function verifySupportRequestPersistenceConfirmation(input: {
  expectedPublicCode: string;
  confirmation: unknown;
  now?: number;
}): SupportRequestPersistenceConfirmation | null {
  if (!input.confirmation || typeof input.confirmation !== "object" || Array.isArray(input.confirmation)) {
    return null;
  }
  const confirmation = input.confirmation as Record<string, unknown>;
  const keys = Object.keys(confirmation);
  const confirmedAt = typeof confirmation.confirmedAt === "string"
    ? Date.parse(confirmation.confirmedAt)
    : Number.NaN;
  const now = input.now ?? Date.now();
  if (
    keys.length !== CONFIRMATION_FIELDS.size ||
    !keys.every((key) => CONFIRMATION_FIELDS.has(key)) ||
    confirmation.status !== "persisted" ||
    confirmation.publicCode !== input.expectedPublicCode ||
    confirmation.confirmationRef !== `support:${input.expectedPublicCode}` ||
    !PUBLIC_CODE_PATTERN.test(input.expectedPublicCode) ||
    !Number.isFinite(confirmedAt) ||
    confirmation.confirmedAt !== new Date(confirmedAt).toISOString() ||
    confirmedAt < now - CONFIRMATION_WINDOW_MS ||
    confirmedAt > now + CONFIRMATION_WINDOW_MS
  ) {
    return null;
  }
  return confirmation as SupportRequestPersistenceConfirmation;
}
