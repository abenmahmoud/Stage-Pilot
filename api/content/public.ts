import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, lte, ne, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  siteContentAssets,
  siteContentItems,
  siteContentVersions,
} from "../../db/schema.js";
import {
  isSiteContentPublicAt,
  normalizeSiteSlug,
  parseSiteContentInput,
} from "../../shared/site-content.js";
import { hasPublicSiteContentVersion } from "../../shared/site-content-policy.js";
import { HttpError } from "../_shared/auth.js";
import {
  encodePublicContentCursor,
  parsePublicContentCursor,
  parsePublicContentPageSize,
} from "../_shared/public-content-pagination.js";
import { signedAssetUrl } from "../_shared/site-content.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  return handleApi(res, async () => {
    const now = new Date();
    const rawSlug = Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug;
    const requestedSlug = rawSlug ? normalizeSiteSlug(rawSlug) : null;
    if (rawSlug && requestedSlug !== rawSlug) throw new HttpError(400, "Adresse de contenu invalide");
    const rawCursor = Array.isArray(req.query.cursor) ? req.query.cursor[0] : req.query.cursor;
    const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    let cursor;
    let pageSize;
    try {
      cursor = requestedSlug ? null : parsePublicContentCursor(rawCursor);
      pageSize = requestedSlug ? 1 : parsePublicContentPageSize(rawLimit);
    } catch {
      throw new HttpError(400, "Pagination invalide");
    }
    const olderInSamePriority = cursor
      ? or(
          lt(siteContentItems.publishedAt, cursor.publishedAt),
          and(
            eq(siteContentItems.publishedAt, cursor.publishedAt),
            lt(siteContentItems.id, cursor.id)
          )
        )
      : undefined;
    const cursorFilter = cursor
      ? cursor.featured
        ? or(
            and(eq(siteContentItems.featured, true), olderInSamePriority),
            eq(siteContentItems.featured, false)
          )
        : and(eq(siteContentItems.featured, false), olderInSamePriority)
      : undefined;
    const rows = await db
      .select({ item: siteContentItems, snapshot: siteContentVersions.snapshot })
      .from(siteContentItems)
      .innerJoin(
        siteContentVersions,
        and(
          eq(siteContentVersions.contentId, siteContentItems.id),
          eq(siteContentVersions.version, siteContentItems.publishedVersion)
        )
      )
      .where(
        and(
          isNotNull(siteContentItems.publishedVersion),
          isNotNull(siteContentItems.publishedAt),
          ne(siteContentItems.status, "archive"),
          eq(siteContentItems.audience, "tous"),
          or(isNull(siteContentItems.publishAt), lte(siteContentItems.publishAt, now)),
          or(isNull(siteContentItems.expiresAt), gt(siteContentItems.expiresAt, now)),
          requestedSlug ? eq(siteContentItems.slug, requestedSlug) : cursorFilter
        )
      )
      .orderBy(
        desc(siteContentItems.featured),
        desc(siteContentItems.publishedAt),
        desc(siteContentItems.id)
      )
      .limit(requestedSlug ? 1 : pageSize + 1);

    const pageRows = requestedSlug ? rows : rows.slice(0, pageSize);
    const lastPageRow = pageRows.at(-1)?.item;
    const nextCursor = !requestedSlug && rows.length > pageSize && lastPageRow?.publishedAt
      ? encodePublicContentCursor({
          featured: lastPageRow.featured,
          publishedAt: lastPageRow.publishedAt,
          id: lastPageRow.id,
        })
      : null;

    const parsed = pageRows.flatMap((row) => {
      try {
        if (!hasPublicSiteContentVersion(row.item)) return [];
        const content = parseSiteContentInput(row.snapshot);
        if (!isSiteContentPublicAt(content, now)) return [];
        return [{ item: row.item, content }];
      } catch {
        return [];
      }
    });
    const assetIds = [...new Set(parsed.flatMap(({ content }) => content.assets.map((asset) => asset.assetId)))];
    const assets = assetIds.length
      ? await db
          .select()
          .from(siteContentAssets)
          .where(and(inArray(siteContentAssets.id, assetIds), eq(siteContentAssets.status, "ready")))
      : [];
    const assetMap = new Map(assets.map((asset) => [asset.id, asset]));

    const items = await Promise.all(parsed.map(async ({ item, content }) => {
      const signedAssets = await Promise.all(content.assets.flatMap((link) => {
        const asset = assetMap.get(link.assetId);
        if (!asset) return [];
        return [Promise.resolve(signedAssetUrl(asset.storagePath)).then((signedUrl) => ({
          id: asset.id,
          assetKind: asset.assetKind,
          mimeType: asset.mimeType,
          title: asset.title,
          altText: asset.altText,
          originalName: asset.originalName,
          role: link.assetRole,
          label: link.publicLabel,
          position: link.position,
          signedUrl,
          importKey: asset.importKey,
        }))];
      }));
      const legacyUrls = new Map(
        signedAssets.flatMap((asset) => {
          const match = asset.importKey?.match(/^wordpress:media:(\d+)$/);
          return match && asset.signedUrl ? [[match[1], asset.signedUrl] as const] : [];
        })
      );
      return {
        id: item.id,
        contentType: content.contentType,
        slug: content.slug,
        title: content.title,
        summary: content.summary,
        bodyMarkdown: content.bodyMarkdown.replace(/legacy-media:(\d+)/g, (reference, mediaId) => legacyUrls.get(mediaId) ?? reference),
        category: content.category,
        audience: content.audience,
        featured: content.featured,
        publishedAt: item.publishedAt,
        publishAt: content.publishAt,
        assets: signedAssets.map(({ importKey: _importKey, ...asset }) => asset),
      };
    }));
    return { items, nextCursor };
  });
}
