import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  siteContentAssets,
  siteContentItems,
  siteContentVersions,
} from "../../db/schema.js";
import { parseSiteContentInput } from "../../shared/site-content.js";
import { signedAssetUrl } from "../_shared/site-content.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  return handleApi(res, async () => {
    const now = new Date();
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
          ne(siteContentItems.status, "archive")
        )
      )
      .orderBy(desc(siteContentItems.featured), desc(siteContentItems.publishedAt))
      .limit(100);

    const parsed = rows.flatMap((row) => {
      try {
        const content = parseSiteContentInput(row.snapshot);
        if (content.publishAt && content.publishAt > now) return [];
        if (content.expiresAt && content.expiresAt <= now) return [];
        return [{ item: row.item, content }];
      } catch {
        return [];
      }
    }).sort((left, right) => Number(right.content.featured) - Number(left.content.featured));
    const assetIds = [...new Set(parsed.flatMap(({ content }) => content.assets.map((asset) => asset.assetId)))];
    const assets = assetIds.length
      ? await db
          .select()
          .from(siteContentAssets)
          .where(and(inArray(siteContentAssets.id, assetIds), eq(siteContentAssets.status, "ready")))
      : [];
    const assetMap = new Map(assets.map((asset) => [asset.id, asset]));

    const items = await Promise.all(parsed.map(async ({ item, content }) => ({
      id: item.id,
      contentType: content.contentType,
      slug: content.slug,
      title: content.title,
      summary: content.summary,
      bodyMarkdown: content.bodyMarkdown,
      category: content.category,
      audience: content.audience,
      featured: content.featured,
      publishedAt: item.publishedAt,
      publishAt: content.publishAt,
      assets: await Promise.all(content.assets.flatMap((link) => {
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
        }))];
      })),
    })));
    return { items };
  });
}
