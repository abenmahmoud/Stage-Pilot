import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  siteContentAssetLinks,
  siteContentAssets,
  siteContentAudit,
  siteContentItems,
  siteContentVersions,
} from "../../../db/schema.js";
import { parseSiteContentInput } from "../../../shared/site-content.js";
import { HttpError } from "../../_shared/auth.js";
import {
  contentSnapshot,
  inputError,
  requireSiteEditor,
  signedAssetUrl,
} from "../../_shared/site-content.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value) throw new HttpError(400, "Contenu manquant");
  return value;
}

async function linkedAssets(contentId: string) {
  const rows = await db
    .select({
      id: siteContentAssets.id,
      originalName: siteContentAssets.originalName,
      mimeType: siteContentAssets.mimeType,
      sizeBytes: siteContentAssets.sizeBytes,
      assetKind: siteContentAssets.assetKind,
      title: siteContentAssets.title,
      altText: siteContentAssets.altText,
      status: siteContentAssets.status,
      storagePath: siteContentAssets.storagePath,
      importKey: siteContentAssets.importKey,
      assetRole: siteContentAssetLinks.assetRole,
      publicLabel: siteContentAssetLinks.publicLabel,
      position: siteContentAssetLinks.position,
    })
    .from(siteContentAssetLinks)
    .innerJoin(siteContentAssets, eq(siteContentAssets.id, siteContentAssetLinks.assetId))
    .where(eq(siteContentAssetLinks.contentId, contentId))
    .orderBy(siteContentAssetLinks.position);
  return Promise.all(
    rows.map(async ({ storagePath, ...asset }) => ({
      ...asset,
      url: asset.status === "ready" ? await signedAssetUrl(storagePath) : null,
    }))
  );
}

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
      const id = routeId(req);
      const [item] = await db.select().from(siteContentItems).where(eq(siteContentItems.id, id)).limit(1);
      if (!item) throw new HttpError(404, "Contenu introuvable");
      const [assets, versions] = await Promise.all([
        linkedAssets(id),
        db
          .select({
            id: siteContentVersions.id,
            version: siteContentVersions.version,
            createdBy: siteContentVersions.createdBy,
            createdAt: siteContentVersions.createdAt,
          })
          .from(siteContentVersions)
          .where(eq(siteContentVersions.contentId, id))
          .orderBy(desc(siteContentVersions.version)),
      ]);
      return { item, assets, versions };
    });
  }

  if (req.method === "PATCH") {
    return handleApi(res, async () => {
      const user = await requireSiteEditor(req);
      const id = routeId(req);
      let input;
      try {
        input = parseSiteContentInput(req.body);
      } catch (error) {
        inputError(error);
      }
      const [current] = await db.select().from(siteContentItems).where(eq(siteContentItems.id, id)).limit(1);
      if (!current) throw new HttpError(404, "Contenu introuvable");
      if (current.status === "archive") {
        throw new HttpError(409, "Restaurez d’abord ce contenu archivé");
      }
      const [slugConflict] = await db
        .select({ id: siteContentItems.id })
        .from(siteContentItems)
        .where(and(eq(siteContentItems.slug, input.slug), ne(siteContentItems.id, id)))
        .limit(1);
      if (slugConflict) throw new HttpError(409, "Cette adresse de page est déjà utilisée");
      await ensureReadyAssets(input.assets.map((asset) => asset.assetId));

      const version = current.version + 1;
      const status = current.status === "publie" || current.status === "a_valider"
        ? "brouillon"
        : current.status;
      return db.transaction(async (tx) => {
        const [item] = await tx
          .update(siteContentItems)
          .set({
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
            status,
            version,
            updatedBy: user.id,
          })
          .where(eq(siteContentItems.id, id))
          .returning();
        await tx.delete(siteContentAssetLinks).where(eq(siteContentAssetLinks.contentId, id));
        if (input.assets.length > 0) {
          await tx.insert(siteContentAssetLinks).values(
            input.assets.map((asset) => ({ contentId: id, ...asset }))
          );
        }
        await tx.insert(siteContentVersions).values({
          contentId: id,
          version,
          snapshot: contentSnapshot(input, status, version),
          createdBy: user.id,
        });
        await tx.insert(siteContentAudit).values({
          resourceType: "content",
          resourceId: id,
          action: "update",
          actorId: user.id,
          summary: { version, status },
        });
        return { item };
      });
    });
  }

  return methodNotAllowed(res, ["GET", "PATCH"]);
}

export const config = { api: { bodyParser: { sizeLimit: "256kb" } } };
