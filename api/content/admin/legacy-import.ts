import type { VercelRequest, VercelResponse } from "@vercel/node";
import { count, eq, inArray, like } from "drizzle-orm";
import legacyInventoryJson from "../../../content/legacy-site/inventory.json" with { type: "json" };
import { db } from "../../../db/index.js";
import {
  siteContentAssetLinks,
  siteContentAssets,
  siteContentAudit,
  siteContentItems,
  siteContentVersions,
} from "../../../db/schema.js";
import {
  assertLegacyMediaType,
  isPostgresUniqueViolation,
  readLimitedResponseBytes,
} from "../../../shared/legacy-import.js";
import {
  projectSiteContentLegacyBatchPayload,
  projectSiteContentLegacyStatusPayload,
} from "../../../shared/site-content-admin-aux-payload.js";
import { HttpError, supabaseAdmin } from "../../_shared/auth.js";
import { requireSiteEditor, SITE_CONTENT_BUCKET } from "../../_shared/site-content.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

type LegacyMedia = {
  wordpressId: number;
  title: string;
  caption: string;
  altText: string;
  mimeType: string;
  sourceUrl: string | null;
};

type LegacyContent = {
  importKey: string;
  wordpressId: number;
  slug: string;
  sourceUrl: string;
  sourceModifiedAt: string | null;
  title: string;
  summary: string;
  bodyMarkdown: string;
  contentType: "article" | "page";
  category: string;
  disposition: "durable" | "archive" | "a_confirmer";
  referencedMedia: number[];
};

type LegacyInventory = {
  sourceOrigin: string;
  contents: LegacyContent[];
  media: LegacyMedia[];
  counts: { mediaDeclared: number };
};

const inventory = legacyInventoryJson as LegacyInventory;

function cleanName(sourceUrl: string, wordpressId: number) {
  let name = `media-${wordpressId}`;
  try { name = decodeURIComponent(new URL(sourceUrl).pathname.split("/").pop() || name); } catch {}
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180) || `media-${wordpressId}`;
}

function limited(value: string | null | undefined, maximum: number, fallback = "") {
  const clean = String(value ?? "").trim();
  return (clean || fallback).slice(0, maximum);
}

function pageInput(body: unknown): { phase: "media" | "contents"; offset: number; limit: number } {
  if (!body || typeof body !== "object") throw new HttpError(400, "Import invalide");
  const input = body as Record<string, unknown>;
  const phase = input.phase === "media" || input.phase === "contents" ? input.phase : null;
  if (!phase) throw new HttpError(400, "Étape d'import invalide");
  const offset = Number(input.offset ?? 0);
  const requestedLimit = Number(input.limit ?? (phase === "media" ? 4 : 10));
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(requestedLimit) || requestedLimit < 1) {
    throw new HttpError(400, "Pagination d'import invalide");
  }
  return { phase, offset, limit: Math.min(requestedLimit, phase === "media" ? 5 : 12) };
}

async function findImportedMedia(importKey: string) {
  const [known] = await db.select({ id: siteContentAssets.id }).from(siteContentAssets)
    .where(eq(siteContentAssets.importKey, importKey)).limit(1);
  return known ?? null;
}

async function findImportedContent(importKey: string) {
  const [known] = await db.select({ id: siteContentItems.id, slug: siteContentItems.slug }).from(siteContentItems)
    .where(eq(siteContentItems.importKey, importKey)).limit(1);
  return known ?? null;
}

async function importMedia(media: LegacyMedia, actorId: string) {
  const importKey = `wordpress:media:${media.wordpressId}`;
  const known = await findImportedMedia(importKey);
  if (known) return { id: known.id, result: "déjà importé" };
  if (!media.sourceUrl) throw new Error("Adresse du média absente");

  const response = await fetch(media.sourceUrl, { headers: { "user-agent": "LyceeGest legacy importer" } });
  if (!response.ok) throw new Error(`Source inaccessible (HTTP ${response.status})`);
  assertLegacyMediaType(media.mimeType, response.headers.get("content-type"));
  const bytes = await readLimitedResponseBytes(response);
  const originalName = cleanName(media.sourceUrl, media.wordpressId);
  const storagePath = `legacy-wordpress/${media.wordpressId}/${originalName}`;
  const upload = await supabaseAdmin.storage.from(SITE_CONTENT_BUCKET).upload(storagePath, bytes, {
    contentType: media.mimeType,
    cacheControl: "3600",
    upsert: false,
  });
  if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) throw upload.error;

  const assetKind = media.mimeType.startsWith("image/") ? "image" : "document";
  const title = limited(media.title, 180, originalName.replace(/\.[^.]+$/, ""));
  const altText = assetKind === "image"
    ? limited(media.altText || media.caption || media.title, 300, `Illustration historique du lycée ${media.wordpressId}`)
    : null;

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(siteContentAssets).values({
        storagePath,
        originalName,
        mimeType: media.mimeType,
        sizeBytes: bytes.length,
        assetKind,
        title,
        altText,
        status: "ready",
        sourceSystem: "wordpress",
        sourceUrl: media.sourceUrl,
        importKey,
        createdBy: actorId,
      }).returning({ id: siteContentAssets.id });
      await tx.insert(siteContentAudit).values({
        resourceType: "asset",
        resourceId: created.id,
        action: "legacy_import",
        actorId,
        summary: { importKey, wordpressId: media.wordpressId },
      });
      return { id: created.id, result: "importé" };
    });
  } catch (error) {
    if (isPostgresUniqueViolation(error)) {
      const raced = await findImportedMedia(importKey);
      if (raced) return { id: raced.id, result: "déjà importé" };
    }
    throw error;
  }
}

async function importContent(content: LegacyContent, actorId: string) {
  const known = await findImportedContent(content.importKey);
  if (known) return { id: known.id, slug: known.slug, result: "déjà importé" };

  let finalSlug = content.slug.slice(0, 140);
  const [slugOwner] = await db.select({ importKey: siteContentItems.importKey }).from(siteContentItems)
    .where(eq(siteContentItems.slug, finalSlug)).limit(1);
  if (slugOwner && slugOwner.importKey !== content.importKey) {
    finalSlug = `ancien-${content.slug}`.slice(0, 140).replace(/-+$/g, "");
  }

  const importKeys = content.referencedMedia.map((wordpressId) => `wordpress:media:${wordpressId}`);
  const importedAssets = importKeys.length
    ? await db.select().from(siteContentAssets).where(inArray(siteContentAssets.importKey, importKeys))
    : [];
  const assetMap = new Map(importedAssets.map((asset) => [asset.importKey, asset]));
  const links = content.referencedMedia.flatMap((wordpressId, position) => {
    const asset = assetMap.get(`wordpress:media:${wordpressId}`);
    if (!asset) return [];
    return [{
      assetId: asset.id,
      assetRole: asset.assetKind === "image" ? "illustration" : "document",
      publicLabel: asset.title,
      position,
    }];
  });
  const snapshot = {
    contentType: content.contentType,
    slug: finalSlug,
    title: content.title,
    summary: content.summary,
    bodyMarkdown: content.bodyMarkdown,
    category: content.category,
    audience: "tous",
    templateId: null,
    featured: false,
    metaTitle: content.title,
    metaDescription: content.summary.slice(0, 320) || null,
    publishAt: null,
    expiresAt: null,
    status: "brouillon",
    assets: links,
    version: 1,
  };

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(siteContentItems).values({
        contentType: content.contentType,
        slug: finalSlug,
        title: content.title,
        summary: content.summary,
        bodyMarkdown: content.bodyMarkdown,
        category: content.category,
        audience: "tous",
        status: "brouillon",
        featured: false,
        metaTitle: content.title,
        metaDescription: content.summary.slice(0, 320) || null,
        sourceSystem: "wordpress",
        sourceUrl: content.sourceUrl,
        sourceUpdatedAt: content.sourceModifiedAt ? new Date(content.sourceModifiedAt) : null,
        importKey: content.importKey,
        sourceDisposition: content.disposition,
        needsReview: true,
        importedAt: new Date(),
        createdBy: actorId,
        updatedBy: actorId,
      }).returning({ id: siteContentItems.id });
      await tx.insert(siteContentVersions).values({ contentId: created.id, version: 1, snapshot, createdBy: actorId });
      if (links.length) {
        await tx.insert(siteContentAssetLinks).values(links.map((link) => ({ contentId: created.id, ...link })));
      }
      await tx.insert(siteContentAudit).values({
        resourceType: "content",
        resourceId: created.id,
        action: "legacy_import",
        actorId,
        summary: { importKey: content.importKey, sourceUrl: content.sourceUrl },
      });
      return { id: created.id, slug: finalSlug, result: "importé" };
    });
  } catch (error) {
    if (isPostgresUniqueViolation(error)) {
      const raced = await findImportedContent(content.importKey);
      if (raced) return { id: raced.id, slug: raced.slug, result: "déjà importé" };
    }
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      await requireSiteEditor(req);
      const [media, contents] = await Promise.all([
        db.select({ count: count() }).from(siteContentAssets)
          .where(like(siteContentAssets.importKey, "wordpress:media:%")),
        db.select({ count: count() }).from(siteContentItems)
          .where(like(siteContentItems.importKey, "wordpress:%")),
      ]);
      return projectSiteContentLegacyStatusPayload({
        source: inventory.sourceOrigin,
        declared: { media: inventory.counts.mediaDeclared, accessibleMedia: inventory.media.length, contents: inventory.contents.length },
        imported: { media: media[0]?.count ?? 0, contents: contents[0]?.count ?? 0 },
      });
    });
  }
  if (req.method !== "POST") return methodNotAllowed(res, ["GET", "POST"]);
  return handleApi(res, async () => {
    const user = await requireSiteEditor(req);
    const input = pageInput(req.body);
    const rows = input.phase === "media" ? inventory.media : inventory.contents;
    if (input.offset > rows.length) throw new HttpError(400, "Pagination d'import invalide");
    const selected = rows.slice(input.offset, input.offset + input.limit);
    const results = [];
    for (const row of selected) {
      try {
        const item = input.phase === "media"
          ? await importMedia(row as LegacyMedia, user.id)
          : await importContent(row as LegacyContent, user.id);
        results.push({ ok: true, reference: input.phase === "media" ? (row as LegacyMedia).wordpressId : (row as LegacyContent).importKey, ...item });
      } catch (error) {
        results.push({ ok: false, reference: input.phase === "media" ? (row as LegacyMedia).wordpressId : (row as LegacyContent).importKey, error: error instanceof Error ? error.message : "Échec inconnu" });
      }
    }
    const nextOffset = input.offset + selected.length;
    return projectSiteContentLegacyBatchPayload({
      phase: input.phase,
      offset: input.offset,
      limit: input.limit,
      nextOffset,
      total: rows.length,
      results,
    });
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
