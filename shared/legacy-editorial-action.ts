export const LEGACY_EDITORIAL_CORRECTION_ACTION = "apply_editorial_corrections" as const;
export const LEGACY_EDITORIAL_CORRECTION_CONFIRMATION = "CORRIGER" as const;

export type LegacyEditorialCorrectionCommand = {
  action: typeof LEGACY_EDITORIAL_CORRECTION_ACTION;
  expectedVersion: number;
  confirmation: typeof LEGACY_EDITORIAL_CORRECTION_CONFIRMATION;
};

export function parseLegacyEditorialCorrectionCommand(
  value: unknown
): LegacyEditorialCorrectionCommand {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Commande de correction invalide.");
  }
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row).sort();
  const expectedKeys = ["action", "confirmation", "expectedVersion"];
  if (
    keys.length !== expectedKeys.length
    || keys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error("Champs de correction inattendus.");
  }
  if (row.action !== LEGACY_EDITORIAL_CORRECTION_ACTION) {
    throw new Error("Action de correction invalide.");
  }
  if (row.confirmation !== LEGACY_EDITORIAL_CORRECTION_CONFIRMATION) {
    throw new Error("Confirmation de correction invalide.");
  }
  if (
    typeof row.expectedVersion !== "number"
    || !Number.isSafeInteger(row.expectedVersion)
    || row.expectedVersion < 1
    || row.expectedVersion > 1_000_000
  ) {
    throw new Error("Version de correction invalide.");
  }
  return {
    action: LEGACY_EDITORIAL_CORRECTION_ACTION,
    expectedVersion: row.expectedVersion,
    confirmation: LEGACY_EDITORIAL_CORRECTION_CONFIRMATION,
  };
}
