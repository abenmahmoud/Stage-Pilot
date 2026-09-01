import {
  parseSiteAssetInput,
  parseSiteTemplateInput,
  type SiteAssetInput,
  type SiteContentTemplateInput,
} from "./site-content.js";
import {
  parseSiteContentAdminAsset,
  parseSiteContentAdminTemplate,
  projectSiteContentAdminAsset,
  projectSiteContentAdminTemplate,
  type SiteContentAdminAsset,
  type SiteContentAdminTemplate,
} from "./site-content-admin-payload.js";
import { isAllowedPublicContentSignedUrlForOrigin } from "./public-content-signed-url.js";
import { detectForbiddenSupportSecret } from "./support-secret-policy.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_FRAGMENT = UUID_PATTERN.source.slice(1, -1);
const CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const SIGNED_TOKEN_PATTERN = /^[A-Za-z0-9._-]{20,8192}$/;
const LEGACY_PHASES = ["media", "contents"] as const;

export const SITE_CONTENT_ASSET_LIST_LIMIT = 200;
export const SITE_CONTENT_TEMPLATE_LIST_LIMIT = 100;
export type SiteContentLegacyPhase = (typeof LEGACY_PHASES)[number];

export type SiteContentAssetReservationPayload = {
  asset: SiteContentAdminAsset & { status: "pending"; importKey: null };
  upload: { path: string; token: string };
};

export type SiteContentAssetConfirmationPayload = {
  asset: SiteContentAdminAsset & { status: "quarantine" | "ready" };
};

export type SiteContentSignedAsset = SiteContentAdminAsset & {
  status: "ready";
  signedUrl: string | null;
};

export type SiteContentTemplateMutationPayload = {
  template: SiteContentAdminTemplate;
};

export type SiteContentAssistSuggestion = {
  title: string;
  summary: string;
  bodyMarkdown: string;
  metaTitle: string;
  metaDescription: string;
  suggestedTitles: string[];
  reviewNotes: string[];
};

export type SiteContentAssistPayload = {
  suggestion: SiteContentAssistSuggestion;
};

export type SiteContentLegacyBatchPayload = {
  phase: SiteContentLegacyPhase;
  nextOffset: number;
  total: number;
  done: boolean;
  successCount: number;
  failureCount: number;
};

export type SiteContentLegacyStatusPayload = {
  source: string;
  declared: { media: number; accessibleMedia: number; contents: number };
  imported: { media: number; contents: number };
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

function integer(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= minimum
    && value <= maximum
    ? value
    : null;
}

function expectedAsset(value: unknown): SiteAssetInput | null {
  try {
    return parseSiteAssetInput(value);
  } catch {
    return null;
  }
}

function assetMatchesInput(asset: SiteContentAdminAsset, expected: SiteAssetInput): boolean {
  return asset.originalName === expected.originalName
    && asset.mimeType === expected.mimeType
    && asset.sizeBytes === expected.sizeBytes
    && asset.assetKind === expected.assetKind
    && asset.title === expected.title
    && asset.altText === expected.altText;
}

function expectedStorageExtension(originalName: string): string {
  if (!originalName.includes(".")) return "bin";
  return originalName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "bin";
}

export function parseSiteContentAssetReservationPayload(
  value: unknown,
  expectedInput: unknown
): SiteContentAssetReservationPayload | null {
  const expected = expectedAsset(expectedInput);
  const root = exactRecord(value, ["asset", "upload"]);
  const asset = root ? parseSiteContentAdminAsset(root.asset) : null;
  const upload = root ? exactRecord(root.upload, ["path", "token"]) : null;
  if (
    !expected
    || !root
    || !asset
    || asset.status !== "pending"
    || asset.importKey !== null
    || !assetMatchesInput(asset, expected)
    || !upload
    || typeof upload.path !== "string"
    || typeof upload.token !== "string"
    || !SIGNED_TOKEN_PATTERN.test(upload.token)
  ) return null;
  const extension = expectedStorageExtension(expected.originalName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pathPattern = new RegExp(
    `^${UUID_FRAGMENT}/[0-9]{4}/(?:0[1-9]|1[0-2])/${UUID_FRAGMENT}\\.${extension}$`,
    "i"
  );
  if (!pathPattern.test(upload.path)) return null;
  return {
    asset: { ...asset, status: "pending", importKey: null },
    upload: { path: upload.path, token: upload.token },
  };
}

export function projectSiteContentAssetReservationPayload(input: {
  asset: unknown;
  upload: unknown;
  expectedInput: unknown;
}): SiteContentAssetReservationPayload {
  const upload = record(input.upload);
  const projected = {
    asset: projectSiteContentAdminAsset(input.asset),
    upload: { path: upload?.path, token: upload?.token },
  };
  const parsed = parseSiteContentAssetReservationPayload(projected, input.expectedInput);
  if (!parsed) throw new Error("Invalid site content asset reservation projection");
  return parsed;
}

export function parseSiteContentAssetConfirmationPayload(
  value: unknown,
  expectedAssetValue: unknown
): SiteContentAssetConfirmationPayload | null {
  const expected = parseSiteContentAdminAsset(expectedAssetValue);
  const root = exactRecord(value, ["asset"]);
  const asset = root ? parseSiteContentAdminAsset(root.asset) : null;
  return expected && root && asset
    && (["pending", "quarantine", "ready"] as const).includes(
      expected.status as "pending" | "quarantine" | "ready"
    )
    && (asset.status === "quarantine" || asset.status === "ready")
    && asset.id === expected.id
    && asset.importKey === expected.importKey
    && assetMatchesInput(asset, expected)
    ? { asset: { ...asset, status: asset.status } }
    : null;
}

export function projectSiteContentAssetConfirmationPayload(
  asset: unknown,
  expectedAssetValue: unknown
): SiteContentAssetConfirmationPayload {
  const projected = { asset: projectSiteContentAdminAsset(asset) };
  const parsed = parseSiteContentAssetConfirmationPayload(
    projected,
    projectSiteContentAdminAsset(expectedAssetValue)
  );
  if (!parsed) throw new Error("Invalid site content asset confirmation projection");
  return parsed;
}

export function parseSiteContentAssetListPayload(
  value: unknown,
  configuredOrigin: unknown
): { assets: SiteContentSignedAsset[] } | null {
  const root = exactRecord(value, ["assets"]);
  if (!root || !Array.isArray(root.assets) || root.assets.length > SITE_CONTENT_ASSET_LIST_LIMIT) return null;
  const assets: SiteContentSignedAsset[] = [];
  const ids = new Set<string>();
  for (const input of root.assets) {
    const row = record(input);
    const exact = exactRecord(input, [
      "id", "originalName", "mimeType", "sizeBytes", "assetKind", "title",
      "altText", "status", "importKey", "signedUrl",
    ]);
    const asset = exact
      ? parseSiteContentAdminAsset(Object.fromEntries(Object.entries(exact).filter(([key]) => key !== "signedUrl")))
      : null;
    if (
      !row
      || !exact
      || !asset
      || asset.status !== "ready"
      || ids.has(asset.id)
      || !isAllowedPublicContentSignedUrlForOrigin(row.signedUrl, configuredOrigin)
    ) return null;
    ids.add(asset.id);
    assets.push({ ...asset, status: "ready", signedUrl: row.signedUrl as string | null });
  }
  return { assets };
}

export function projectSiteContentAssetListPayload(
  values: unknown[],
  configuredOrigin: unknown
): { assets: SiteContentSignedAsset[] } {
  if (values.length > SITE_CONTENT_ASSET_LIST_LIMIT) throw new Error("Site content asset list exceeds its payload limit");
  const assets = values.map((value) => {
    const row = record(value);
    return { ...projectSiteContentAdminAsset(value), signedUrl: row?.signedUrl ?? null };
  });
  const parsed = parseSiteContentAssetListPayload({ assets }, configuredOrigin);
  if (!parsed) throw new Error("Invalid site content asset list projection");
  return parsed;
}

function normalizedTemplate(value: unknown): (SiteContentTemplateInput & { id: string | null }) | null {
  try {
    return parseSiteTemplateInput(value);
  } catch {
    return null;
  }
}

function templateFieldsMatch(actual: SiteContentAdminTemplate, expected: SiteContentTemplateInput): boolean {
  return actual.slug === expected.slug
    && actual.name === expected.name
    && actual.contentType === expected.contentType
    && actual.description === expected.description
    && actual.defaultTitle === expected.defaultTitle
    && actual.defaultSummary === expected.defaultSummary
    && actual.defaultBodyMarkdown === expected.defaultBodyMarkdown
    && actual.active === expected.active;
}

export function parseSiteContentTemplateListPayload(value: unknown): { templates: SiteContentAdminTemplate[] } | null {
  const root = exactRecord(value, ["templates"]);
  if (!root || !Array.isArray(root.templates) || root.templates.length > SITE_CONTENT_TEMPLATE_LIST_LIMIT) return null;
  const templates: SiteContentAdminTemplate[] = [];
  const ids = new Set<string>();
  const slugs = new Set<string>();
  for (const value of root.templates) {
    const template = parseSiteContentAdminTemplate(value);
    if (!template || ids.has(template.id) || slugs.has(template.slug)) return null;
    ids.add(template.id);
    slugs.add(template.slug);
    templates.push(template);
  }
  return { templates };
}

export function projectSiteContentTemplateListPayload(values: unknown[]): { templates: SiteContentAdminTemplate[] } {
  if (values.length > SITE_CONTENT_TEMPLATE_LIST_LIMIT) throw new Error("Site content template list exceeds its payload limit");
  const projected = { templates: values.map(projectSiteContentAdminTemplate) };
  const parsed = parseSiteContentTemplateListPayload(projected);
  if (!parsed) throw new Error("Invalid site content template list projection");
  return parsed;
}

export function parseSiteContentTemplateMutationPayload(
  value: unknown,
  expectedInput: unknown,
  mode: "create" | "update"
): SiteContentTemplateMutationPayload | null {
  const expected = normalizedTemplate(expectedInput);
  const expectedRow = record(expectedInput);
  const root = exactRecord(value, ["template"]);
  const template = root ? parseSiteContentAdminTemplate(root.template) : null;
  if (!expected || !root || !template || !templateFieldsMatch(template, expected)) return null;
  if (mode === "create") {
    return expected.id === null && template.version === 1 ? { template } : null;
  }
  const previousVersion = expectedRow ? integer(expectedRow.version, 1, 1_000_000) : null;
  return expected.id && template.id === expected.id && previousVersion !== null
    && template.version === previousVersion + 1
    ? { template }
    : null;
}

export function projectSiteContentTemplateMutationPayload(
  template: unknown,
  expectedInput: unknown,
  mode: "create" | "update"
): SiteContentTemplateMutationPayload {
  const projected = { template: projectSiteContentAdminTemplate(template) };
  const parsed = parseSiteContentTemplateMutationPayload(projected, expectedInput, mode);
  if (!parsed) throw new Error("Invalid site content template mutation projection");
  return parsed;
}

function parseTextList(value: unknown, maximumItems: number, minimumLength: number, maximumLength: number): string[] | null {
  if (!Array.isArray(value) || value.length > maximumItems) return null;
  const values: string[] = [];
  for (const entry of value) {
    const parsed = boundedText(entry, minimumLength, maximumLength);
    if (parsed === null || values.includes(parsed)) return null;
    values.push(parsed);
  }
  return values;
}

export function parseSiteContentAssistPayload(value: unknown): SiteContentAssistPayload | null {
  const root = exactRecord(value, ["suggestion"]);
  const suggestion = root && exactRecord(root.suggestion, [
    "title", "summary", "bodyMarkdown", "metaTitle", "metaDescription",
    "suggestedTitles", "reviewNotes",
  ]);
  if (!root || !suggestion) return null;
  const title = boundedText(suggestion.title, 2, 180);
  const summary = boundedText(suggestion.summary, 0, 600);
  const bodyMarkdown = boundedText(suggestion.bodyMarkdown, 0, 30_000);
  const metaTitle = boundedText(suggestion.metaTitle, 0, 180);
  const metaDescription = boundedText(suggestion.metaDescription, 0, 320);
  const suggestedTitles = parseTextList(suggestion.suggestedTitles, 5, 2, 180);
  const reviewNotes = parseTextList(suggestion.reviewNotes, 5, 1, 300);
  if (
    title === null
    || summary === null
    || bodyMarkdown === null
    || metaTitle === null
    || metaDescription === null
    || !suggestedTitles
    || !reviewNotes
    || detectForbiddenSupportSecret([
      title, summary, bodyMarkdown, metaTitle, metaDescription, ...suggestedTitles, ...reviewNotes,
    ].join("\n"))
  ) return null;
  return {
    suggestion: { title, summary, bodyMarkdown, metaTitle, metaDescription, suggestedTitles, reviewNotes },
  };
}

export function projectSiteContentAssistPayload(value: unknown): SiteContentAssistPayload {
  const parsed = parseSiteContentAssistPayload(value);
  if (!parsed) throw new Error("Invalid site content assistance payload");
  return parsed;
}

export function parseSiteContentLegacyBatchPayload(
  value: unknown,
  expected: { phase: SiteContentLegacyPhase; offset: number; limit: number }
): SiteContentLegacyBatchPayload | null {
  const root = exactRecord(value, [
    "phase", "nextOffset", "total", "done", "successCount", "failureCount",
  ]);
  const offset = integer(expected.offset, 0, 100_000);
  const limit = integer(expected.limit, 1, expected.phase === "media" ? 5 : 12);
  const nextOffset = root ? integer(root.nextOffset, 0, 100_000) : null;
  const total = root ? integer(root.total, 0, 100_000) : null;
  const successCount = root ? integer(root.successCount, 0, 12) : null;
  const failureCount = root ? integer(root.failureCount, 0, 12) : null;
  if (
    !root
    || root.phase !== expected.phase
    || offset === null
    || limit === null
    || nextOffset === null
    || total === null
    || successCount === null
    || failureCount === null
    || typeof root.done !== "boolean"
    || offset > total
    || nextOffset < offset
    || nextOffset > total
    || nextOffset - offset > limit
    || successCount + failureCount !== nextOffset - offset
    || root.done !== (nextOffset >= total)
  ) return null;
  return {
    phase: expected.phase,
    nextOffset,
    total,
    done: root.done,
    successCount,
    failureCount,
  };
}

export function projectSiteContentLegacyBatchPayload(input: {
  phase: SiteContentLegacyPhase;
  offset: number;
  limit: number;
  nextOffset: number;
  total: number;
  results: unknown[];
}): SiteContentLegacyBatchPayload {
  const successCount = input.results.filter((result) => record(result)?.ok === true).length;
  const failureCount = input.results.length - successCount;
  const projected = {
    phase: input.phase,
    nextOffset: input.nextOffset,
    total: input.total,
    done: input.nextOffset >= input.total,
    successCount,
    failureCount,
  };
  const parsed = parseSiteContentLegacyBatchPayload(projected, input);
  if (!parsed) throw new Error("Invalid site content legacy batch projection");
  return parsed;
}

function publicOrigin(value: unknown): string | null {
  const clean = boundedText(value, 1, 2_048);
  if (!clean) return null;
  try {
    const url = new URL(clean);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash
      ? clean
      : null;
  } catch {
    return null;
  }
}

export function parseSiteContentLegacyStatusPayload(value: unknown): SiteContentLegacyStatusPayload | null {
  const root = exactRecord(value, ["source", "declared", "imported"]);
  const declared = root ? exactRecord(root.declared, ["media", "accessibleMedia", "contents"]) : null;
  const imported = root ? exactRecord(root.imported, ["media", "contents"]) : null;
  const source = root ? publicOrigin(root.source) : null;
  const media = declared ? integer(declared.media, 0, 100_000) : null;
  const accessibleMedia = declared ? integer(declared.accessibleMedia, 0, 100_000) : null;
  const contents = declared ? integer(declared.contents, 0, 100_000) : null;
  const importedMedia = imported ? integer(imported.media, 0, 100_000) : null;
  const importedContents = imported ? integer(imported.contents, 0, 100_000) : null;
  return root && declared && imported && source && media !== null && accessibleMedia !== null
    && contents !== null && importedMedia !== null && importedContents !== null
    && accessibleMedia <= media && importedMedia <= accessibleMedia && importedContents <= contents
    ? {
      source,
      declared: { media, accessibleMedia, contents },
      imported: { media: importedMedia, contents: importedContents },
    }
    : null;
}

export function projectSiteContentLegacyStatusPayload(value: unknown): SiteContentLegacyStatusPayload {
  const parsed = parseSiteContentLegacyStatusPayload(value);
  if (!parsed) throw new Error("Invalid site content legacy status projection");
  return parsed;
}
