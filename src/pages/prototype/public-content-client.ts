import { readJsonApiResponse } from "../../../shared/json-api-response";

export type PublicContentAsset = {
  id: string;
  assetKind: "image" | "document";
  mimeType: string;
  title: string;
  altText: string | null;
  originalName: string;
  role: "couverture" | "illustration" | "document";
  label: string;
  position: number;
  signedUrl: string | null;
};

export type PublicContent = {
  id: string;
  contentType: "article" | "alerte" | "page" | "document";
  slug: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  category: string;
  audience: "tous";
  featured: boolean;
  publishedAt: string;
  publishAt: string | null;
  assets: PublicContentAsset[];
};

type PublicContentPayload = {
  items: PublicContent[];
  nextCursor: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isBoundedString(value: unknown, max: number, allowEmpty = false): value is string {
  return typeof value === "string"
    && value.length <= max
    && (allowEmpty || value.trim().length > 0);
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
}

export function isAllowedPublicContentSignedUrl(value: unknown): value is string | null {
  if (value === null) return true;
  if (!isBoundedString(value, 4_096)) return false;
  const env = import.meta.env as Record<string, string | undefined>;
  const configured = env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configured) return false;
  try {
    const url = new URL(value);
    const supabaseUrl = new URL(configured);
    return url.protocol === "https:"
      && url.origin === supabaseUrl.origin
      && !url.username
      && !url.password
      && !url.hash
      && url.pathname.startsWith("/storage/v1/object/sign/site-content/")
      && url.searchParams.has("token");
  } catch {
    return false;
  }
}

function isPublicContentAsset(value: unknown): value is PublicContentAsset {
  if (!isRecord(value)) return false;
  const assetKind = String(value.assetKind);
  const mimeType = String(value.mimeType);
  const kindMatchesMime = assetKind === "image"
    ? ["image/jpeg", "image/png", "image/webp"].includes(mimeType)
    : assetKind === "document"
      && [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ].includes(mimeType);
  return typeof value.id === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id)
    && kindMatchesMime
    && isBoundedString(value.title, 180)
    && (assetKind === "image"
      ? isBoundedString(value.altText, 300)
      : value.altText === null || isBoundedString(value.altText, 300))
    && isBoundedString(value.originalName, 255)
    && ["couverture", "illustration", "document"].includes(String(value.role))
    && isBoundedString(value.label, 180)
    && Number.isInteger(value.position)
    && Number(value.position) >= 0
    && Number(value.position) <= 1_000
    && isAllowedPublicContentSignedUrl(value.signedUrl);
}

function isPublicContent(value: unknown): value is PublicContent {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id)
    && ["article", "alerte", "page", "document"].includes(String(value.contentType))
    && isBoundedString(value.slug, 140)
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)
    && isBoundedString(value.title, 180)
    && isBoundedString(value.summary, 600, true)
    && isBoundedString(value.bodyMarkdown, 30_000, true)
    && isBoundedString(value.category, 100)
    && value.audience === "tous"
    && typeof value.featured === "boolean"
    && isValidDate(value.publishedAt)
    && Date.parse(value.publishedAt) <= Date.now() + (5 * 60_000)
    && (value.publishAt === null || isValidDate(value.publishAt))
    && Array.isArray(value.assets)
    && value.assets.length <= 20
    && value.assets.every(isPublicContentAsset)
    && new Set(value.assets.map((asset) => asset.id)).size === value.assets.length;
}

function isPublicContentPayload(value: unknown): value is PublicContentPayload {
  if (!isRecord(value)
    || !Array.isArray(value.items)
    || value.items.length > 100
    || !value.items.every(isPublicContent)
    || !(value.nextCursor === null
      || (isBoundedString(value.nextCursor, 512) && /^[A-Za-z0-9_-]+$/.test(value.nextCursor)))) return false;
  const itemIds = value.items.map((item) => item.id);
  const slugs = value.items.map((item) => item.slug);
  return new Set(itemIds).size === itemIds.length
    && new Set(slugs).size === slugs.length;
}

export async function readPublicContentPayload(response: Response): Promise<PublicContentPayload> {
  const payload = await readJsonApiResponse<unknown>(response, { maxBytes: 16 * 1024 * 1024 });
  if (!isPublicContentPayload(payload)) {
    throw new Error("La réponse des informations du lycée est invalide.");
  }
  return payload;
}

export async function readPublicContentPagePayload(
  response: Response,
  expectedSlug: string
): Promise<PublicContent | null> {
  if (!isBoundedString(expectedSlug, 140) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(expectedSlug)) {
    throw new Error("L’adresse de cette page est invalide.");
  }
  const payload = await readPublicContentPayload(response);
  if (payload.nextCursor !== null || payload.items.length > 1) {
    throw new Error("La réponse de cette page est invalide.");
  }
  const item = payload.items[0] ?? null;
  if (item && item.slug !== expectedSlug) {
    throw new Error("La réponse de cette page est invalide.");
  }
  return item;
}
