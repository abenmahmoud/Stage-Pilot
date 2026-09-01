const ATTACHMENT_LINK_FIELDS = new Set(["url", "expiresIn"]);

export type SupportAttachmentLinkPayload = {
  url: string;
  expiresIn: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactFields(value: Record<string, unknown>, fields: Set<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === fields.size && keys.every((key) => fields.has(key));
}

export function isSupportAttachmentLinkPayload(
  value: unknown,
  configuredStorageUrl: unknown
): value is SupportAttachmentLinkPayload {
  if (!isRecord(value)
    || !hasExactFields(value, ATTACHMENT_LINK_FIELDS)
    || typeof value.url !== "string"
    || typeof value.expiresIn !== "number"
    || !Number.isSafeInteger(value.expiresIn)
    || value.expiresIn < 1
    || value.expiresIn > 300
    || typeof configuredStorageUrl !== "string"
    || configuredStorageUrl.length < 1) {
    return false;
  }
  try {
    const target = new URL(value.url);
    const configured = new URL(configuredStorageUrl);
    return target.protocol === "https:"
      && configured.protocol === "https:"
      && target.origin === configured.origin
      && target.pathname.startsWith("/storage/v1/object/sign/")
      && !target.username
      && !target.password
      && target.hash === "";
  } catch {
    return false;
  }
}
