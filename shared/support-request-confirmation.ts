export type SupportRequestPersistenceConfirmation = {
  status: "persisted";
  publicCode: string;
  confirmedAt: string;
  confirmationRef: string;
};

const PUBLIC_CODE_PATTERN = /^BC-[0-9]{4}-[0-9]{6}$/;

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
}): SupportRequestPersistenceConfirmation | null {
  if (!input.confirmation || typeof input.confirmation !== "object" || Array.isArray(input.confirmation)) {
    return null;
  }
  const confirmation = input.confirmation as Record<string, unknown>;
  if (
    confirmation.status !== "persisted" ||
    confirmation.publicCode !== input.expectedPublicCode ||
    confirmation.confirmationRef !== `support:${input.expectedPublicCode}` ||
    typeof confirmation.confirmedAt !== "string" ||
    !PUBLIC_CODE_PATTERN.test(input.expectedPublicCode) ||
    !Number.isFinite(Date.parse(confirmation.confirmedAt))
  ) {
    return null;
  }
  return confirmation as SupportRequestPersistenceConfirmation;
}
