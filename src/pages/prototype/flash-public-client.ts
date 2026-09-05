import { readJsonApiResponse } from "../../../shared/json-api-response";

const FLASH_IMPORTANCE_LEVELS = ["normale", "importante", "urgente"] as const;
type FlashImportance = (typeof FLASH_IMPORTANCE_LEVELS)[number];

export type FlashPublicItem = {
  id: string;
  title: string;
  bodyMarkdown: string;
  importance: FlashImportance;
  publishedAt: string;
  expiresAt: string;
};

type FlashPublicFeedPayload = {
  items: FlashPublicItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
}

function isFlashPublicItem(value: unknown): value is FlashPublicItem {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id)
    && isBoundedString(value.title, 180)
    && isBoundedString(value.bodyMarkdown, 20_000)
    && (FLASH_IMPORTANCE_LEVELS as readonly string[]).includes(String(value.importance))
    && isValidDate(value.publishedAt)
    && isValidDate(value.expiresAt);
}

function isFlashPublicFeedPayload(value: unknown): value is FlashPublicFeedPayload {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length > 100) return false;
  if (!value.items.every(isFlashPublicItem)) return false;
  const ids = value.items.map((item) => item.id);
  return new Set(ids).size === ids.length;
}

export async function readFlashPublicFeedPayload(response: Response): Promise<FlashPublicFeedPayload> {
  const payload = await readJsonApiResponse<unknown>(response, { maxBytes: 2 * 1024 * 1024 });
  if (!isFlashPublicFeedPayload(payload)) {
    throw new Error("La réponse des informations flash publiques est invalide.");
  }
  return payload;
}
