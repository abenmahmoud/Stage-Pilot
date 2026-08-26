import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import { siteContentAssets, siteContentAudit } from "../../../../../db/schema.js";
import { HttpError, supabaseAdmin } from "../../../../_shared/auth.js";
import { requireSiteEditor, SITE_CONTENT_BUCKET } from "../../../../_shared/site-content.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value) throw new HttpError(400, "Fichier manquant");
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const user = await requireSiteEditor(req);
    const id = routeId(req);
    const [asset] = await db.select().from(siteContentAssets).where(eq(siteContentAssets.id, id)).limit(1);
    if (!asset) throw new HttpError(404, "Fichier introuvable");
    if (asset.status === "ready") return { asset };
    if (asset.status !== "pending") throw new HttpError(409, "Ce fichier ne peut plus être utilisé");

    const separator = asset.storagePath.lastIndexOf("/");
    const folder = asset.storagePath.slice(0, separator);
    const fileName = asset.storagePath.slice(separator + 1);
    const { data: files, error } = await supabaseAdmin.storage
      .from(SITE_CONTENT_BUCKET)
      .list(folder, { search: fileName, limit: 10 });
    const uploaded = files?.find((file) => file.name === fileName);
    if (error || !uploaded) throw new HttpError(409, "Le fichier n’a pas été reçu complètement");

    const metadata = (uploaded.metadata ?? {}) as Record<string, unknown>;
    const uploadedSize = Number(metadata.size ?? 0);
    const uploadedMime = String(metadata.mimetype ?? metadata.mimeType ?? "");
    if (uploadedSize !== asset.sizeBytes || (uploadedMime && uploadedMime !== asset.mimeType)) {
      await supabaseAdmin.storage.from(SITE_CONTENT_BUCKET).remove([asset.storagePath]);
      await db.update(siteContentAssets).set({ status: "archived" }).where(eq(siteContentAssets.id, id));
      await db.insert(siteContentAudit).values({
        resourceType: "asset",
        resourceId: id,
        action: "reject_upload",
        actorId: user.id,
        summary: { uploadedSize, declaredSize: asset.sizeBytes, uploadedMime, declaredMime: asset.mimeType },
      });
      throw new HttpError(400, "Le fichier reçu ne correspond pas au fichier annoncé");
    }

    const [readyAsset] = await db
      .update(siteContentAssets)
      .set({ status: "ready" })
      .where(eq(siteContentAssets.id, id))
      .returning();
    await db.insert(siteContentAudit).values({
      resourceType: "asset",
      resourceId: id,
      action: "confirm_upload",
      actorId: user.id,
      summary: { sizeBytes: asset.sizeBytes, mimeType: asset.mimeType },
    });
    return { asset: readyAsset };
  });
}
