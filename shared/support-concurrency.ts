export function parseSupportRevision(value: unknown): Date | null {
  if (typeof value !== "string" || value.length > 80) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

export function supportRevisionMatches(
  current: Date | string,
  expected: Date | string
): boolean {
  const currentTimestamp = current instanceof Date ? current.getTime() : Date.parse(current);
  const expectedTimestamp = expected instanceof Date ? expected.getTime() : Date.parse(expected);
  return Number.isFinite(currentTimestamp)
    && Number.isFinite(expectedTimestamp)
    && currentTimestamp === expectedTimestamp;
}
