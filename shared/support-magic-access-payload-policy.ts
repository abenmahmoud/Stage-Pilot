const PUBLIC_CODE_PATTERN = /^BC-\d{4}-\d{6}$/;
const ROOT_FIELDS = new Set(["request"]);
const REQUEST_FIELDS = new Set(["publicCode"]);

export type SupportMagicAccessPayload = {
  request: { publicCode: string };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactFields(value: Record<string, unknown>, fields: Set<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === fields.size && keys.every((key) => fields.has(key));
}

export function isSupportMagicAccessPayload(
  value: unknown,
  expectedPublicCode?: string
): value is SupportMagicAccessPayload {
  if (!isRecord(value)
    || !hasExactFields(value, ROOT_FIELDS)
    || !isRecord(value.request)
    || !hasExactFields(value.request, REQUEST_FIELDS)
    || typeof value.request.publicCode !== "string"
    || !PUBLIC_CODE_PATTERN.test(value.request.publicCode)) {
    return false;
  }
  return expectedPublicCode === undefined || value.request.publicCode === expectedPublicCode;
}
