const DEFAULT_UNAVAILABLE_MESSAGE = "Le service ne répond pas pour le moment.";
const DEFAULT_INVALID_RESPONSE_MESSAGE = "La réponse du service est invalide. Réessayez dans quelques instants.";

function safeApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const error = (payload as Record<string, unknown>).error;
  return typeof error === "string" && error.trim().length >= 2 && error.length <= 500
    ? error.trim()
    : null;
}

export async function readJsonApiResponse<T>(
  responseInput: Response | Promise<Response>
): Promise<T> {
  const response = await responseInput;
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(response.ok ? DEFAULT_INVALID_RESPONSE_MESSAGE : DEFAULT_UNAVAILABLE_MESSAGE);
  }
  if (!response.ok) throw new Error(safeApiError(payload) ?? DEFAULT_UNAVAILABLE_MESSAGE);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(DEFAULT_INVALID_RESPONSE_MESSAGE);
  }
  return payload as T;
}
