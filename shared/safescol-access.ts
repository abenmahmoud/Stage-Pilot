export function validatedSafeScolUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function safeScolAccessEnabled(input: {
  enabled: unknown;
  url: unknown;
}): boolean {
  return input.enabled === "true" && validatedSafeScolUrl(input.url) !== null;
}
