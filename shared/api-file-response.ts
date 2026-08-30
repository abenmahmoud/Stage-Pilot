export const API_PDF_MAX_BYTES = 20 * 1024 * 1024;
const API_PDF_HARD_MAX_BYTES = 50 * 1024 * 1024;
const INVALID_PDF_MESSAGE = "Le document reçu est invalide ou trop volumineux.";

function cleanUrlString(value: unknown, maxLength: number): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maxLength
    && value === value.trim()
    && !/[\u0000-\u001F\u007F]/.test(value);
}

function trustedHttpsOrigin(value: unknown): string | null {
  if (!cleanUrlString(value, 2_048)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

export function isAllowedExternalApiFileUrl(
  value: unknown,
  appOrigin: unknown,
  storageOrigin: unknown
): value is string {
  if (!cleanUrlString(value, 4_096)) return false;
  try {
    const url = new URL(value);
    const allowedOrigins = new Set([
      trustedHttpsOrigin(appOrigin),
      trustedHttpsOrigin(storageOrigin),
    ].filter((origin): origin is string => Boolean(origin)));
    return url.protocol === "https:"
      && allowedOrigins.has(url.origin)
      && !url.username
      && !url.password
      && !url.hash;
  } catch {
    return false;
  }
}

export async function readApiPdfResponse(
  response: Response,
  maxBytes = API_PDF_MAX_BYTES
): Promise<Blob> {
  if (!response.ok
    || !Number.isInteger(maxBytes)
    || maxBytes < 5
    || maxBytes > API_PDF_HARD_MAX_BYTES) {
    throw new Error(INVALID_PDF_MESSAGE);
  }

  const contentType = (response.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/pdf") throw new Error(INVALID_PDF_MESSAGE);

  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null
    && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes)) {
    throw new Error(INVALID_PDF_MESSAGE);
  }
  if (!response.body) throw new Error(INVALID_PDF_MESSAGE);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error(INVALID_PDF_MESSAGE);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (bytes.length < 5
    || bytes[0] !== 0x25
    || bytes[1] !== 0x50
    || bytes[2] !== 0x44
    || bytes[3] !== 0x46
    || bytes[4] !== 0x2d) {
    throw new Error(INVALID_PDF_MESSAGE);
  }
  return new Blob([bytes], { type: "application/pdf" });
}
