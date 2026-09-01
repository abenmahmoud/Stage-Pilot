import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  siteContentAssetLinks,
  siteContentAssets,
  siteContentAudit,
  siteContentItems,
  siteContentTemplates,
  siteContentVersions,
} from "../../../db/schema.js";
import { parseSiteContentInput } from "../../../shared/site-content.js";
import {
  SITE_CONTENT_ADMIN_PAYLOAD_LIMITS,
  projectSiteContentAdminListPayload,
  projectSiteContentAdminMutationPayload,
} from "../../../shared/site-content-admin-payload.js";
import { HttpError } from "../../_shared/auth.js";
import { contentSnapshot, inputError, requireSiteEditor } from "../../_shared/site-content.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

async function ensureReadyAssets(assetIds: string[]) {
  if (assetIds.length === 0) return;
  const assets = await db
    .select({ id: siteContentAssets.id, status: siteContentAssets.status })
    .from(siteContentAssets)
    .where(inArray(siteContentAssets.id, assetIds));
  if (assets.length !== assetIds.length || assets.some((asset) => asset.status !== "ready")) {
    throw new HttpError(409, "Un fichier n’est pas encore prêt");
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      await requireSiteEditor(req);
      const [items, templates, assets] = await Promise.all([
        db.select().from(siteContentItems).orderBy(desc(siteContentItems.updatedAt)).limit(SITE_CONTENT_ADMIN_PAYLOAD_LIMITS.items),
        db.select().from(siteContentTemplates).orderBy(desc(siteContentTemplates.active), siteContentTemplates.name).limit(SITE_CONTENT_ADMIN_PAYLOAD_LIMITS.templates),
        db.select().from(siteContentAssets).orderBy(desc(siteContentAssets.createdAt)).limit(SITE_CONTENT_ADMIN_PAYLOAD_LIMITS.assets),
      ]);
      return projectSiteContentAdminListPayload({ items, templates, assets });
    });
  }

  if (req.method === "POST") {
    return handleApi(res, async () => {
      const user = await requireSiteEditor(req);
      let input;
      try {
        input = parseSiteContentInput(req.body);
      } catch (error) {
        inputError(error);
      }
      const [existing] = await db
        .select({ id: siteContentItems.id })
        .from(siteContentItems)
        .where(eq(siteContentItems.slug, input.slug))
        .limit(1);
      if (existing) throw new HttpError(409, "Cette adresse de page est déjà utilisée");
      await ensureReadyAssets(input.assets.map((asset) => asset.assetId));

      return db.transaction(async (tx) => {
        const [item] = await tx
          .insert(siteContentItems)
          .values({
            contentType: input.contentType,
            slug: input.slug,
            title: input.title,
            summary: input.summary,
            bodyMarkdown: input.bodyMarkdown,
            category: input.category,
            audience: input.audience,
            templateId: input.templateId,
            featured: input.featured,
            metaTitle: input.metaTitle,
            metaDescription: input.metaDescription,
            publishAt: input.publishAt,
            expiresAt: input.expiresAt,
            createdBy: user.id,
            updatedBy: user.id,
          })
          .returning();
        await tx.insert(siteContentVersions).values({
          contentId: item.id,
          version: 1,
          snapshot: contentSnapshot(input, "brouillon", 1),
          createdBy: user.id,
        });
        if (input.assets.length > 0) {
          await tx.insert(siteContentAssetLinks).values(
            input.assets.map((asset) => ({ contentId: item.id, ...asset }))
          );
        }
        await tx.insert(siteContentAudit).values({
          resourceType: "content",
          resourceId: item.id,
          action: "create",
          actorId: user.id,
          summary: { version: 1, status: "brouillon" },
        });
        return projectSiteContentAdminMutationPayload(item, "create");
      });
    });
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}

export const config = { api: { bodyParser: { sizeLimit: "256kb" } } };
