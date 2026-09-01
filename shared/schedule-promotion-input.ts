export type SchedulePromotionConfirmation = "ACTIVER" | "RESTAURER" | "RETIRER";

export type SchedulePromotionInput = {
  justification: string;
};

function cleanJustification(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSchedulePromotionInput(
  value: unknown,
  expectedConfirmation?: SchedulePromotionConfirmation
): SchedulePromotionInput {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const justification = cleanJustification(input.justification);
  if (justification.length < 20 || justification.length > 1000) {
    throw new Error("Expliquez la vérification effectuée en 20 à 1 000 caractères.");
  }
  if (expectedConfirmation && input.confirmation !== expectedConfirmation) {
    throw new Error(`Saisissez ${expectedConfirmation} pour confirmer cette action.`);
  }
  return { justification };
}
