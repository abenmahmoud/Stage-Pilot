import {
  SITE_ASSET_ROLES,
  SITE_CONTENT_AUDIENCES,
  SITE_CONTENT_STATUSES,
  SITE_CONTENT_TYPES,
  type SiteAssetRole,
  type SiteContentAudience,
  type SiteContentStatus,
  type SiteContentType,
} from "./site-content.js";
import type { SiteContentAction } from "./site-content-policy.js";
import { isAllowedPublicContentSignedUrlForOrigin } from "./public-content-signed-url.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const ASSET_STATUSES = ["pending", "ready", "archived"] as const;
const ASSET_KINDS = ["image", "document"] as const;
const SOURCE_SYSTEMS = ["wordpress"] as const;
const SOURCE_DISPOSITIONS = ["durable", "archive", "a_confirmer"] as const;
const CONTENT_ACTIONS = [
  "submit_review",
  "publish",
  "archive",
  "duplicate",
  "restore",
  "verify_source",
] as const;
const MUTATION_ACTIONS = ["create", "update", ...CONTENT_ACTIONS] as const;
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

type AssetStatus = (typeof ASSET_STATUSES)[number];
type AssetKind = (typeof ASSET_KINDS)[number];
type SourceSystem = (typeof SOURCE_SYSTEMS)[number];
type SourceDisposition = (typeof SOURCE_DISPOSITIONS)[number];
export type SiteContentMutationAction = (typeof MUTATION_ACTIONS)[number];

export const SITE_CONTENT_ADMIN_PAYLOAD_LIMITS = {
  items: 250,
  templates: 100,
  assets: 250,
  linkedAssets: 20,
  versions: 100,
} as const;

export type SiteContentAdminSummary = {
  id: string;
  contentType: SiteContentType;
  title: string;
  category: string;
  status: SiteContentStatus;
  version: number;
  needsReview: boolean;
  sourceSystem: SourceSystem | null;
  updatedAt: string;
};

export type SiteContentAdminTemplate = {
  id: string;
  slug: string;
  name: string;
  contentType: SiteContentType;
  description: string;
  defaultTitle: string;
  defaultSummary: string;
  defaultBodyMarkdown: string;
  active: boolean;
  version: number;
};

export type SiteContentAdminAsset = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  assetKind: AssetKind;
  title: string;
  altText: string | null;
  status: AssetStatus;
  importKey: string | null;
};

export type SiteContentAdminListPayload = {
  items: SiteContentAdminSummary[];
  templates: SiteContentAdminTemplate[];
  assets: SiteContentAdminAsset[];
};

export type SiteContentAdminDetail = {
  id: string;
  contentType: SiteContentType;
  slug: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  category: string;
  audience: SiteContentAudience;
  status: SiteContentStatus;
  templateId: string | null;
  featured: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  publishAt: string | null;
  expiresAt: string | null;
  sourceSystem: SourceSystem | null;
  sourceUrl: string | null;
  sourceUpdatedAt: string | null;
  sourceDisposition: SourceDisposition | null;
  needsReview: boolean;
  importedAt: string | null;
  reviewedAt: string | null;
};

export type SiteContentAdminLinkedAsset = SiteContentAdminAsset & {
  assetRole: SiteAssetRole;
  publicLabel: string;
  position: number;
  url: string | null;
};

export type SiteContentAdminVersion = {
  id: string;
  version: number;
  createdAt: string;
};

export type SiteContentAdminDetailPayload = {
  item: SiteContentAdminDetail;
  assets: SiteContentAdminLinkedAsset[];
  versions: SiteContentAdminVersion[];
};

export type SiteContentAdminMutationPayload = {
  resource: "content";
  itemId: string;
  action: SiteContentMutationAction;
  status: SiteContentStatus;
  version: number;
  needsReview: boolean;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  const candidate = record(value);
  if (!candidate) return null;
  const actual = Object.keys(candidate).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index])
    ? candidate
    : null;
}

function boundedText(value: unknown, minimum: number, maximum: number): string | null {
  return typeof value === "string"
    && value.length >= minimum
    && value.length <= maximum
    && !CONTROL_PATTERN.test(value)
    ? value
    : null;
}

function enumValue<T extends readonly string[]>(value: unknown, allowed: T): T[number] | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? value as T[number]
    : null;
}

function uuid(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

function integer(value: unknown, minimum = 1, maximum = 1_000_000): number | null {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= minimum
    && value <= maximum
    ? value
    : null;
}

function timestamp(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_PATTERN.test(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value ? value : null;
}

function nullableTimestamp(value: unknown): string | null | undefined {
  if (value === null) return null;
  return timestamp(value) ?? undefined;
}

function projectedTimestamp(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  return timestamp(value);
}

function nullableProjectedTimestamp(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return projectedTimestamp(value) ?? undefined;
}

function nullableText(value: unknown, maximum: number): string | null | undefined {
  if (value === null) return null;
  return boundedText(value, 1, maximum) ?? undefined;
}

function nullableEnum<T extends readonly string[]>(value: unknown, allowed: T): T[number] | null | undefined {
  if (value === null) return null;
  return enumValue(value, allowed) ?? undefined;
}

function validSourceUrl(value: unknown): string | null | undefined {
  if (value === null) return null;
  const clean = boundedText(value, 1, 1_000);
  if (!clean) return undefined;
  try {
    const url = new URL(clean);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
      ? clean
      : undefined;
  } catch {
    return undefined;
  }
}

function validMimeKind(mimeType: unknown, assetKind: unknown): {
  mimeType: string;
  assetKind: AssetKind;
} | null {
  const mime = enumValue(mimeType, ALLOWED_MIME_TYPES);
  const kind = enumValue(assetKind, ASSET_KINDS);
  if (!mime || !kind) return null;
  const matches = kind === "image" ? mime.startsWith("image/") : !mime.startsWith("image/");
  return matches ? { mimeType: mime, assetKind: kind } : null;
}

function parseSummary(value: unknown): SiteContentAdminSummary | null {
  const row = exactRecord(value, [
    "id", "contentType", "title", "category", "status", "version",
    "needsReview", "sourceSystem", "updatedAt",
  ]);
  const id = row ? uuid(row.id) : null;
  const contentType = row ? enumValue(row.contentType, SITE_CONTENT_TYPES) : null;
  const title = row ? boundedText(row.title, 2, 180) : null;
  const category = row ? boundedText(row.category, 2, 100) : null;
  const status = row ? enumValue(row.status, SITE_CONTENT_STATUSES) : null;
  const version = row ? integer(row.version) : null;
  const sourceSystem = row ? nullableEnum(row.sourceSystem, SOURCE_SYSTEMS) : undefined;
  const updatedAt = row ? timestamp(row.updatedAt) : null;
  return row && id && contentType && title && category && status && version
    && typeof row.needsReview === "boolean" && sourceSystem !== undefined && updatedAt
    ? { id, contentType, title, category, status, version, needsReview: row.needsReview, sourceSystem, updatedAt }
    : null;
}

export function parseSiteContentAdminTemplate(value: unknown): SiteContentAdminTemplate | null {
  const row = exactRecord(value, [
    "id", "slug", "name", "contentType", "description", "defaultTitle",
    "defaultSummary", "defaultBodyMarkdown", "active", "version",
  ]);
  const id = row ? uuid(row.id) : null;
  const slug = row ? boundedText(row.slug, 1, 140) : null;
  const name = row ? boundedText(row.name, 2, 120) : null;
  const contentType = row ? enumValue(row.contentType, SITE_CONTENT_TYPES) : null;
  const description = row ? boundedText(row.description, 0, 500) : null;
  const defaultTitle = row ? boundedText(row.defaultTitle, 0, 180) : null;
  const defaultSummary = row ? boundedText(row.defaultSummary, 0, 600) : null;
  const defaultBodyMarkdown = row ? boundedText(row.defaultBodyMarkdown, 0, 30_000) : null;
  const version = row ? integer(row.version) : null;
  return row && id && slug && SLUG_PATTERN.test(slug) && name && contentType
    && description !== null && defaultTitle !== null && defaultSummary !== null
    && defaultBodyMarkdown !== null && typeof row.active === "boolean" && version
    ? {
      id, slug, name, contentType, description, defaultTitle, defaultSummary,
      defaultBodyMarkdown, active: row.active, version,
    }
    : null;
}

export function parseSiteContentAdminAsset(value: unknown): SiteContentAdminAsset | null {
  const row = exactRecord(value, [
    "id", "originalName", "mimeType", "sizeBytes", "assetKind", "title",
    "altText", "status", "importKey",
  ]);
  const id = row ? uuid(row.id) : null;
  const originalName = row ? boundedText(row.originalName, 1, 255) : null;
  const mimeKind = row ? validMimeKind(row.mimeType, row.assetKind) : null;
  const sizeBytes = row ? integer(row.sizeBytes, 1, 10 * 1024 * 1024) : null;
  const title = row ? boundedText(row.title, 1, 180) : null;
  const altText = row ? nullableText(row.altText, 300) : undefined;
  const status = row ? enumValue(row.status, ASSET_STATUSES) : null;
  const importKey = row ? nullableText(row.importKey, 180) : undefined;
  return row && id && originalName && mimeKind && sizeBytes && title && altText !== undefined
    && status && importKey !== undefined && (mimeKind.assetKind !== "image" || Boolean(altText))
    ? {
      id, originalName, ...mimeKind, sizeBytes, title, altText, status, importKey,
    }
    : null;
}

function parseDetail(value: unknown): SiteContentAdminDetail | null {
  const row = exactRecord(value, [
    "id", "contentType", "slug", "title", "summary", "bodyMarkdown", "category",
    "audience", "status", "templateId", "featured", "metaTitle", "metaDescription",
    "publishAt", "expiresAt", "sourceSystem", "sourceUrl", "sourceUpdatedAt",
    "sourceDisposition", "needsReview", "importedAt", "reviewedAt",
  ]);
  const id = row ? uuid(row.id) : null;
  const contentType = row ? enumValue(row.contentType, SITE_CONTENT_TYPES) : null;
  const slug = row ? boundedText(row.slug, 1, 140) : null;
  const title = row ? boundedText(row.title, 2, 180) : null;
  const summary = row ? boundedText(row.summary, 0, 600) : null;
  const bodyMarkdown = row ? boundedText(row.bodyMarkdown, 0, 30_000) : null;
  const category = row ? boundedText(row.category, 2, 100) : null;
  const audience = row ? enumValue(row.audience, SITE_CONTENT_AUDIENCES) : null;
  const status = row ? enumValue(row.status, SITE_CONTENT_STATUSES) : null;
  const templateId = row ? (row.templateId === null ? null : uuid(row.templateId)) : null;
  const metaTitle = row ? nullableText(row.metaTitle, 180) : undefined;
  const metaDescription = row ? nullableText(row.metaDescription, 320) : undefined;
  const publishAt = row ? nullableTimestamp(row.publishAt) : undefined;
  const expiresAt = row ? nullableTimestamp(row.expiresAt) : undefined;
  const sourceSystem = row ? nullableEnum(row.sourceSystem, SOURCE_SYSTEMS) : undefined;
  const sourceUrl = row ? validSourceUrl(row.sourceUrl) : undefined;
  const sourceUpdatedAt = row ? nullableTimestamp(row.sourceUpdatedAt) : undefined;
  const sourceDisposition = row ? nullableEnum(row.sourceDisposition, SOURCE_DISPOSITIONS) : undefined;
  const importedAt = row ? nullableTimestamp(row.importedAt) : undefined;
  const reviewedAt = row ? nullableTimestamp(row.reviewedAt) : undefined;
  if (
    !row || !id || !contentType || !slug || !SLUG_PATTERN.test(slug) || !title
    || summary === null || bodyMarkdown === null || !category || !audience || !status
    || !(row.templateId === null || templateId) || typeof row.featured !== "boolean"
    || metaTitle === undefined || metaDescription === undefined || publishAt === undefined
    || expiresAt === undefined || sourceSystem === undefined || sourceUrl === undefined
    || sourceUpdatedAt === undefined || sourceDisposition === undefined
    || typeof row.needsReview !== "boolean" || importedAt === undefined || reviewedAt === undefined
    || (publishAt && expiresAt && Date.parse(expiresAt) <= Date.parse(publishAt))
  ) return null;
  return {
    id, contentType, slug, title, summary, bodyMarkdown, category, audience, status,
    templateId, featured: row.featured, metaTitle, metaDescription, publishAt, expiresAt,
    sourceSystem, sourceUrl, sourceUpdatedAt, sourceDisposition,
    needsReview: row.needsReview, importedAt, reviewedAt,
  };
}

function parseLinkedAsset(value: unknown, configuredOrigin: unknown): SiteContentAdminLinkedAsset | null {
  const row = record(value);
  if (!row) return null;
  const asset = parseSiteContentAdminAsset(Object.fromEntries(Object.entries(row).filter(([key]) => ![
    "assetRole", "publicLabel", "position", "url",
  ].includes(key))));
  const exact = exactRecord(row, [
    "id", "originalName", "mimeType", "sizeBytes", "assetKind", "title", "altText",
    "status", "importKey", "assetRole", "publicLabel", "position", "url",
  ]);
  const assetRole = exact ? enumValue(exact.assetRole, SITE_ASSET_ROLES) : null;
  const publicLabel = exact ? boundedText(exact.publicLabel, 1, 180) : null;
  const position = exact ? integer(exact.position, 0, 1_000) : null;
  return exact && asset && assetRole && publicLabel && position !== null
    && isAllowedPublicContentSignedUrlForOrigin(exact.url, configuredOrigin)
    && (exact.status === "ready" || exact.url === null)
    ? { ...asset, assetRole, publicLabel, position, url: exact.url as string | null }
    : null;
}

function parseVersion(value: unknown): SiteContentAdminVersion | null {
  const row = exactRecord(value, ["id", "version", "createdAt"]);
  const id = row ? uuid(row.id) : null;
  const version = row ? integer(row.version) : null;
  const createdAt = row ? timestamp(row.createdAt) : null;
  return row && id && version && createdAt ? { id, version, createdAt } : null;
}

export function parseSiteContentAdminListPayload(value: unknown): SiteContentAdminListPayload | null {
  const root = exactRecord(value, ["items", "templates", "assets"]);
  if (!root || !Array.isArray(root.items) || !Array.isArray(root.templates) || !Array.isArray(root.assets)
    || root.items.length > SITE_CONTENT_ADMIN_PAYLOAD_LIMITS.items
    || root.templates.length > SITE_CONTENT_ADMIN_PAYLOAD_LIMITS.templates
    || root.assets.length > SITE_CONTENT_ADMIN_PAYLOAD_LIMITS.assets) return null;
  const items = root.items.map(parseSummary);
  const templates = root.templates.map(parseSiteContentAdminTemplate);
  const assets = root.assets.map(parseSiteContentAdminAsset);
  if (items.some((item) => !item) || templates.some((template) => !template) || assets.some((asset) => !asset)) return null;
  const parsedItems = items as SiteContentAdminSummary[];
  const parsedTemplates = templates as SiteContentAdminTemplate[];
  const parsedAssets = assets as SiteContentAdminAsset[];
  const unique = (values: readonly string[]) => new Set(values).size === values.length;
  if (!unique(parsedItems.map(({ id }) => id)) || !unique(parsedTemplates.map(({ id }) => id))
    || !unique(parsedTemplates.map(({ slug }) => slug)) || !unique(parsedAssets.map(({ id }) => id))) return null;
  for (let index = 1; index < parsedItems.length; index += 1) {
    if (Date.parse(parsedItems[index - 1].updatedAt) < Date.parse(parsedItems[index].updatedAt)) return null;
  }
  return { items: parsedItems, templates: parsedTemplates, assets: parsedAssets };
}

export function parseSiteContentAdminDetailPayload(
  value: unknown,
  expected: { itemId: string; configuredOrigin: unknown }
): SiteContentAdminDetailPayload | null {
  const root = exactRecord(value, ["item", "assets", "versions"]);
  if (!root || !Array.isArray(root.assets) || !Array.isArray(root.versions)
    || root.assets.length > SITE_CONTENT_ADMIN_PAYLOAD_LIMITS.linkedAssets
    || root.versions.length > SITE_CONTENT_ADMIN_PAYLOAD_LIMITS.versions) return null;
  const item = parseDetail(root.item);
  const assets = root.assets.map((asset) => parseLinkedAsset(asset, expected.configuredOrigin));
  const versions = root.versions.map(parseVersion);
  if (!item || item.id !== expected.itemId || assets.some((asset) => !asset) || versions.some((version) => !version)) return null;
  const parsedAssets = assets as SiteContentAdminLinkedAsset[];
  const parsedVersions = versions as SiteContentAdminVersion[];
  if (new Set(parsedAssets.map(({ id }) => id)).size !== parsedAssets.length
    || new Set(parsedAssets.map(({ position }) => position)).size !== parsedAssets.length
    || new Set(parsedVersions.map(({ id }) => id)).size !== parsedVersions.length
    || new Set(parsedVersions.map(({ version }) => version)).size !== parsedVersions.length) return null;
  for (let index = 1; index < parsedVersions.length; index += 1) {
    if (parsedVersions[index - 1].version <= parsedVersions[index].version) return null;
  }
  return { item, assets: parsedAssets, versions: parsedVersions };
}

export function parseSiteContentAdminMutationPayload(
  value: unknown,
  expected: { action: SiteContentMutationAction; itemId?: string }
): SiteContentAdminMutationPayload | null {
  const row = exactRecord(value, ["resource", "itemId", "action", "status", "version", "needsReview"]);
  const itemId = row ? uuid(row.itemId) : null;
  const action = row ? enumValue(row.action, MUTATION_ACTIONS) : null;
  const status = row ? enumValue(row.status, SITE_CONTENT_STATUSES) : null;
  const version = row ? integer(row.version) : null;
  if (!row || row.resource !== "content" || !itemId || !action || action !== expected.action
    || !status || !version || typeof row.needsReview !== "boolean") return null;
  if (expected.itemId && action !== "duplicate" && itemId !== expected.itemId) return null;
  if (action === "duplicate" && (!expected.itemId || itemId === expected.itemId || status !== "brouillon" || version !== 1 || row.needsReview)) return null;
  if (action === "create" && (status !== "brouillon" || version !== 1 || row.needsReview)) return null;
  if (action === "update" && status !== "brouillon") return null;
  if (action === "submit_review" && status !== "a_valider") return null;
  if (action === "publish" && status !== "publie") return null;
  if (action === "archive" && status !== "archive") return null;
  if (action === "restore" && status !== "brouillon") return null;
  if (action === "verify_source" && row.needsReview) return null;
  return { resource: "content", itemId, action, status, version, needsReview: row.needsReview };
}

export function projectSiteContentAdminListPayload(input: {
  items: unknown[];
  templates: unknown[];
  assets: unknown[];
}): SiteContentAdminListPayload {
  if (input.items.length > SITE_CONTENT_ADMIN_PAYLOAD_LIMITS.items
    || input.templates.length > SITE_CONTENT_ADMIN_PAYLOAD_LIMITS.templates
    || input.assets.length > SITE_CONTENT_ADMIN_PAYLOAD_LIMITS.assets) {
    throw new Error("Site content admin list exceeds its payload limit");
  }
  const payload = {
    items: input.items.map((value) => {
      const row = record(value);
      return {
        id: row?.id,
        contentType: row?.contentType,
        title: row?.title,
        category: row?.category,
        status: row?.status,
        version: row?.version,
        needsReview: row?.needsReview,
        sourceSystem: row?.sourceSystem ?? null,
        updatedAt: projectedTimestamp(row?.updatedAt),
      };
    }),
    templates: input.templates.map(projectSiteContentAdminTemplate),
    assets: input.assets.map(projectSiteContentAdminAsset),
  };
  const parsed = parseSiteContentAdminListPayload(payload);
  if (!parsed) throw new Error("Invalid site content admin list projection");
  return parsed;
}

export function projectSiteContentAdminAsset(value: unknown): SiteContentAdminAsset {
  const row = record(value);
  const parsed = parseSiteContentAdminAsset({
    id: row?.id,
    originalName: row?.originalName,
    mimeType: row?.mimeType,
    sizeBytes: row?.sizeBytes,
    assetKind: row?.assetKind,
    title: row?.title,
    altText: row?.altText ?? null,
    status: row?.status,
    importKey: row?.importKey ?? null,
  });
  if (!parsed) throw new Error("Invalid site content admin asset projection");
  return parsed;
}

export function projectSiteContentAdminTemplate(value: unknown): SiteContentAdminTemplate {
  const row = record(value);
  const parsed = parseSiteContentAdminTemplate({
    id: row?.id,
    slug: row?.slug,
    name: row?.name,
    contentType: row?.contentType,
    description: row?.description,
    defaultTitle: row?.defaultTitle,
    defaultSummary: row?.defaultSummary,
    defaultBodyMarkdown: row?.defaultBodyMarkdown,
    active: row?.active,
    version: row?.version,
  });
  if (!parsed) throw new Error("Invalid site content admin template projection");
  return parsed;
}

export function projectSiteContentAdminDetailPayload(
  input: { item: unknown; assets: unknown[]; versions: unknown[] },
  configuredOrigin: unknown
): SiteContentAdminDetailPayload {
  if (input.assets.length > SITE_CONTENT_ADMIN_PAYLOAD_LIMITS.linkedAssets
    || input.versions.length > SITE_CONTENT_ADMIN_PAYLOAD_LIMITS.versions) {
    throw new Error("Site content admin detail exceeds its payload limit");
  }
  const row = record(input.item);
  const payload = {
    item: {
      id: row?.id,
      contentType: row?.contentType,
      slug: row?.slug,
      title: row?.title,
      summary: row?.summary,
      bodyMarkdown: row?.bodyMarkdown,
      category: row?.category,
      audience: row?.audience,
      status: row?.status,
      templateId: row?.templateId ?? null,
      featured: row?.featured,
      metaTitle: row?.metaTitle ?? null,
      metaDescription: row?.metaDescription ?? null,
      publishAt: nullableProjectedTimestamp(row?.publishAt),
      expiresAt: nullableProjectedTimestamp(row?.expiresAt),
      sourceSystem: row?.sourceSystem ?? null,
      sourceUrl: row?.sourceUrl ?? null,
      sourceUpdatedAt: nullableProjectedTimestamp(row?.sourceUpdatedAt),
      sourceDisposition: row?.sourceDisposition ?? null,
      needsReview: row?.needsReview,
      importedAt: nullableProjectedTimestamp(row?.importedAt),
      reviewedAt: nullableProjectedTimestamp(row?.reviewedAt),
    },
    assets: input.assets.map((value) => {
      const linked = record(value);
      return {
        ...projectSiteContentAdminAsset(value),
        assetRole: linked?.assetRole,
        publicLabel: linked?.publicLabel,
        position: linked?.position,
        url: linked?.url ?? null,
      };
    }),
    versions: input.versions.map((value) => {
      const version = record(value);
      return { id: version?.id, version: version?.version, createdAt: projectedTimestamp(version?.createdAt) };
    }),
  };
  const itemId = typeof row?.id === "string" ? row.id : "";
  const parsed = parseSiteContentAdminDetailPayload(payload, { itemId, configuredOrigin });
  if (!parsed) throw new Error("Invalid site content admin detail projection");
  return parsed;
}

export function projectSiteContentAdminMutationPayload(
  item: unknown,
  action: SiteContentMutationAction,
  expectedItemId?: string
): SiteContentAdminMutationPayload {
  const row = record(item);
  const payload = {
    resource: "content",
    itemId: row?.id,
    action,
    status: row?.status,
    version: row?.version,
    needsReview: row?.needsReview,
  };
  const expectedId = action === "create"
    ? undefined
    : expectedItemId ?? (typeof row?.id === "string" ? row.id : "");
  const parsed = parseSiteContentAdminMutationPayload(payload, { action, itemId: expectedId });
  if (!parsed) throw new Error("Invalid site content admin mutation projection");
  return parsed;
}

export function isSiteContentAction(value: unknown): value is SiteContentAction {
  return enumValue(value, CONTENT_ACTIONS) !== null;
}
