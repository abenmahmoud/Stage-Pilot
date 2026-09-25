const INTERNAL_EDITORIAL_PATTERNS = [
  /\bhebdo\b/iu,
  /\b(?:non|pas encore)\s+(?:communiqu|pr[eé]cis|d[eé]taill|disponib|indiqu|confirm)/iu,
  /\bn['’](?:est|a)\s+pas\s+(?:encore\s+)?(?:communiqu|pr[eé]cis|d[eé]taill|disponib|indiqu|confirm)/iu,
  /\bne\s+(?:sont|sera|seront|figure|figurent|pr[eé]cise|pr[eé]cisent|d[eé]taille|d[eé]taillent|indique|indiquent)\s+pas\b/iu,
  /\b(?:information|date|heure|horaire|salle|modalit[eé]s?|public)\s+(?:manquante?s?|inconnue?s?|[àa]\s+(?:v[eé]rifier|confirmer))\b/iu,
] as const;

export function hasInternalEditorialWording(value: string): boolean {
  return INTERNAL_EDITORIAL_PATTERNS.some((pattern) => pattern.test(value));
}

export function assertProfessionalPublicWording(...values: string[]): void {
  if (values.some(hasInternalEditorialWording)) {
    throw new Error("public_editorial_language_invalid");
  }
}
