const DEFAULT_UNAVAILABLE_MESSAGE = "Le service ne répond pas pour le moment.";
const DEFAULT_INVALID_RESPONSE_MESSAGE = "La réponse du service est invalide. Réessayez dans quelques instants.";
const DEFAULT_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

type JsonApiResponseOptions = {
  maxBytes?: number;
};

function safeApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const error = (payload as Record<string, unknown>).error;
  return typeof error === "string" && error.trim().length >= 2 && error.length <= 500
    ? error.trim()
    : null;
}

export async function readJsonApiResponse<T>(
  responseInput: Response | Promise<Response>,
  options: JsonApiResponseOptions = {}
): Promise<T> {
  const response = await responseInput;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_RESPONSE_BYTES) {
    throw new Error(DEFAULT_INVALID_RESPONSE_MESSAGE);
  }
  let payload: unknown;
  try {
    const declaredLength = response.headers.get("content-length");
    if (declaredLength !== null
      && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes)) {
      throw new Error("response_size_invalid");
    }
    if (!response.body) throw new Error("response_body_missing");
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
          throw new Error("response_size_invalid");
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
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error(response.ok ? DEFAULT_INVALID_RESPONSE_MESSAGE : DEFAULT_UNAVAILABLE_MESSAGE);
  }
  if (!response.ok) throw new Error(safeApiError(payload) ?? DEFAULT_UNAVAILABLE_MESSAGE);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(DEFAULT_INVALID_RESPONSE_MESSAGE);
  }
  return payload as T;
}
