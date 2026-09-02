const SUPPORT_PERSON_NAME_MAX_LENGTH = 100;
const SUPPORT_PERSON_NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ .'’-][\p{L}\p{M}]+)*$/u;

export function normalizeSupportPersonName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (normalized.length < 2 || normalized.length > SUPPORT_PERSON_NAME_MAX_LENGTH) return null;
  if (!SUPPORT_PERSON_NAME_PATTERN.test(normalized)) return null;
  const letters = normalized.match(/\p{L}/gu);
  return letters && letters.length >= 2 ? normalized : null;
}

