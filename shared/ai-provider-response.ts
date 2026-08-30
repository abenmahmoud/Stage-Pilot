import { readJsonApiResponse } from "./json-api-response.js";

export const AI_PROVIDER_RESPONSE_MAX_BYTES = 2 * 1024 * 1024;

export function readAiProviderJsonResponse<T>(response: Response): Promise<T> {
  return readJsonApiResponse<T>(response, { maxBytes: AI_PROVIDER_RESPONSE_MAX_BYTES });
}
