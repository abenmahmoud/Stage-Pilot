import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc, eq, inArray, like } from "drizzle-orm";
import legacyInventoryJson from "../../../content/legacy-site/inventory.json";
import { db } from "../../../db/index.js";
import {
  siteContentAssetLinks,
  siteContentAssets,
  siteContentAudit,
  siteContentItems,
  siteContentVersions,
} from "../../../db/schema.js";
import { HttpError, supabaseAdmin } from "../../_shared/auth.js";
import { requireSitePublisher, SITE_CONTENT_BUCKET } from "../../_shared/site-content.js";
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
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function cleanName(sourceUrl: string, wordpressId: number) {
  let name = `media-${wordpressId}`;
  try { name = decodeURIComponent(new URL(sourceUrl).pathname.split("/").pop() || name); } catch {}
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180) || `media-${wordpressId}`;
}

function limited(value: string | null | undefined, maximum: number, fallback = "") {
  const clean = String(value ?? "").trim();
  return (clean || fallback).slice(0, maximum);
}

function pageInput(body: unknown) {
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

async function importMedia(media: LegacyMedia) {
  const importKey = `wordpress:media:${media.wordpressId}`;
  const [known] = await db.select({ id: siteContentAssets.id }).from(siteContentAssets)
    .where(eq(siteContentAssets.importKey, importKey)).limit(1);
  if (known) return { id: known.id, result: "déjà importé" };
  if (!media.sourceUrl) throw new Error("Adresse du média absente");

  const response = await fetch(media.sourceUrl, { headers: { "user-agent": "LyceeGest legacy importer" } });
  if (!response.ok) throw new Error(`Source inaccessible (HTTP ${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_FILE_SIZE) throw new Error(`Taille refusée (${bytes.length} octets)`);
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

  return db.transaction(async (tx) => {
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
    }).returning({ id: siteContentAssets.id });
    await tx.insert(siteContentAudit).values({
      resourceType: "asset",
      resourceId: created.id,
      action: "legacy_import",
      summary: { importKey, wordpressId: media.wordpressId },
    });
    return { id: created.id, result: "importé" };
  });
}

async function importContent(content: LegacyContent) {
  const [known] = await db.select({ id: siteContentItems.id }).from(siteContentItems)
    .where(eq(siteContentItems.importKey, content.importKey)).limit(1);
  if (known) return { id: known.id, slug: content.slug, result: "déjà importé" };

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

  return db.transaction(async (tx) => {
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
    }).returning({ id: siteContentItems.id });
    await tx.insert(siteContentVersions).values({ contentId: created.id, version: 1, snapshot });
    if (links.length) {
      await tx.insert(siteContentAssetLinks).values(links.map((link) => ({ contentId: created.id, ...link })));
    }
    await tx.insert(siteContentAudit).values({
      resourceType: "content",
      resourceId: created.id,
      action: "legacy_import",
      summary: { importKey: content.importKey, sourceUrl: content.sourceUrl },
    });
    return { id: created.id, slug: finalSlug, result: "importé" };
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      await requireSitePublisher(req);
      const [media, contents] = await Promise.all([
        db.select({ id: siteContentAssets.id }).from(siteContentAssets)
          .where(like(siteContentAssets.importKey, "wordpress:media:%")).orderBy(asc(siteContentAssets.createdAt)),
        db.select({ id: siteContentItems.id }).from(siteContentItems)
          .where(like(siteContentItems.importKey, "wordpress:%")).orderBy(asc(siteContentItems.createdAt)),
      ]);
      return {
        source: inventory.sourceOrigin,
        declared: { media: inventory.counts.mediaDeclared, accessibleMedia: inventory.media.length, contents: inventory.contents.length },
        imported: { media: media.length, contents: contents.length },
      };
    });
  }
  if (req.method !== "POST") return methodNotAllowed(res, ["GET", "POST"]);
  return handleApi(res, async () => {
    await requireSitePublisher(req);
    const input = pageInput(req.body);
    const rows = input.phase === "media" ? inventory.media : inventory.contents;
    const selected = rows.slice(input.offset, input.offset + input.limit);
    const results = [];
    for (const row of selected) {
      try {
        const item = input.phase === "media"
          ? await importMedia(row as LegacyMedia)
          : await importContent(row as LegacyContent);
        results.push({ ok: true, reference: input.phase === "media" ? (row as LegacyMedia).wordpressId : (row as LegacyContent).importKey, ...item });
      } catch (error) {
        results.push({ ok: false, reference: input.phase === "media" ? (row as LegacyMedia).wordpressId : (row as LegacyContent).importKey, error: error instanceof Error ? error.message : "Échec inconnu" });
      }
    }
    const nextOffset = input.offset + selected.length;
    return { phase: input.phase, offset: input.offset, nextOffset, total: rows.length, done: nextOffset >= rows.length, results };
  });
}
