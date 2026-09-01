import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import { siteContentAssets, siteContentAudit } from "../../../../../db/schema.js";
import { readBoundedBlobBytes } from "../../../../../shared/bounded-blob.js";
import { projectSiteContentAssetConfirmationPayload } from "../../../../../shared/site-content-admin-aux-payload.js";
import { matchesSiteContentFileSignature } from "../../../../../shared/site-content-file-signature.js";
import { HttpError, supabaseAdmin } from "../../../../_shared/auth.js";
import { requireSiteEditor, SITE_CONTENT_BUCKET } from "../../../../_shared/site-content.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

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
    if (asset.status === "ready") return projectSiteContentAssetConfirmationPayload(asset, asset);
    if (asset.status !== "pending") throw new HttpError(409, "Ce fichier ne peut plus être utilisé");

    const { data: file, error } = await supabaseAdmin.storage
      .from(SITE_CONTENT_BUCKET)
      .download(asset.storagePath);
    if (error || !file) throw new HttpError(409, "Le fichier n’a pas été reçu complètement");

    const uploadedSize = Number(file.size);
    let validSignature = false;
    try {
      const bytes = await readBoundedBlobBytes(file, asset.sizeBytes, MAX_FILE_BYTES);
      validSignature = matchesSiteContentFileSignature(bytes, asset.mimeType);
    } catch {
      validSignature = false;
    }
    if (uploadedSize !== asset.sizeBytes || !validSignature) {
      await supabaseAdmin.storage.from(SITE_CONTENT_BUCKET).remove([asset.storagePath]);
      await db.update(siteContentAssets).set({ status: "archived" }).where(eq(siteContentAssets.id, id));
      await db.insert(siteContentAudit).values({
        resourceType: "asset",
        resourceId: id,
        action: "reject_upload",
        actorId: user.id,
        summary: {
          uploadedSize,
          declaredSize: asset.sizeBytes,
          declaredMime: asset.mimeType,
          reason: validSignature ? "size_mismatch" : "invalid_file_signature",
        },
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
    return projectSiteContentAssetConfirmationPayload(readyAsset, asset);
  });
}

export const config = { api: { bodyParser: false } };
