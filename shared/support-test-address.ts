export function isReservedTestEmail(value: string | null | undefined): boolean {
  return typeof value === "string" && /@(example\.com|example\.org|example\.net|test\.invalid)$/i.test(value);
}
