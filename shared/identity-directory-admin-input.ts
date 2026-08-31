type IdentityDirectoryDecision = "approve" | "activate" | "retire";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("La décision est invalide.");
  }
  return value as Record<string, unknown>;
}

function exactFields(value: Record<string, unknown>, fields: readonly string[]): void {
  const keys = Object.keys(value);
  if (keys.length !== fields.length || keys.some((key) => !fields.includes(key))) {
    throw new Error("La décision est invalide.");
  }
}

export function parseIdentityDirectoryDecisionInput(
  value: unknown,
  decision: IdentityDirectoryDecision
): { justification: string } {
  const input = record(value);
  const confirmation = decision === "activate" ? "ACTIVER" : decision === "retire" ? "RETIRER" : null;
  exactFields(input, confirmation ? ["confirmation", "justification"] : ["justification"]);
  if (confirmation && input.confirmation !== confirmation) {
    throw new Error("La confirmation de la décision est manquante.");
  }
  if (typeof input.justification !== "string") {
    throw new Error("La justification est obligatoire.");
  }
  const justification = input.justification.normalize("NFKC").trim();
  if (
    justification.length < 20
    || justification.length > 1_000
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(justification)
  ) {
    throw new Error("La justification doit contenir entre 20 et 1 000 caractères.");
  }
  return { justification };
}
