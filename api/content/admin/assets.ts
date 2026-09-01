import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { siteContentAssets, siteContentAudit } from "../../../db/schema.js";
import { parseSiteAssetInput } from "../../../shared/site-content.js";
import {
  SITE_CONTENT_ASSET_LIST_LIMIT,
  projectSiteContentAssetListPayload,
  projectSiteContentAssetReservationPayload,
} from "../../../shared/site-content-admin-aux-payload.js";
import { supabaseAdmin } from "../../_shared/auth.js";
import {
  inputError,
  requireSiteEditor,
  signedAssetUrl,
  SITE_CONTENT_QUARANTINE_BUCKET,
  storagePathForFile,
} from "../../_shared/site-content.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

async function serializeAsset(asset: typeof siteContentAssets.$inferSelect) {
  return {
    ...asset,
    signedUrl: asset.status === "ready" ? await signedAssetUrl(asset.storagePath) : null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      await requireSiteEditor(req);
      const assets = await db
        .select()
        .from(siteContentAssets)
        .where(eq(siteContentAssets.status, "ready"))
        .orderBy(desc(siteContentAssets.createdAt))
        .limit(SITE_CONTENT_ASSET_LIST_LIMIT);
      const serialized = await Promise.all(assets.map(serializeAsset));
      const configuredOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
      return projectSiteContentAssetListPayload(serialized, configuredOrigin);
    });
  }

  if (req.method === "POST") {
    return handleApi(res, async () => {
      const user = await requireSiteEditor(req);
      let input;
      try {
        input = parseSiteAssetInput(req.body);
      } catch (error) {
        inputError(error);
      }
      const storagePath = storagePathForFile(user.id, input.originalName);
      const { data: upload, error: uploadError } = await supabaseAdmin.storage
        .from(SITE_CONTENT_QUARANTINE_BUCKET)
        .createSignedUploadUrl(storagePath);
      if (uploadError || !upload) throw new Error("Le dépôt du fichier est momentanément indisponible");

      const [asset] = await db
        .insert(siteContentAssets)
        .values({
          ...input,
          storageBucket: SITE_CONTENT_QUARANTINE_BUCKET,
          storagePath,
          createdBy: user.id,
        })
        .returning();
      await db.insert(siteContentAudit).values({
        resourceType: "asset",
        resourceId: asset.id,
        action: "reserve_upload",
        actorId: user.id,
        summary: { mimeType: input.mimeType, sizeBytes: input.sizeBytes },
      });
      return projectSiteContentAssetReservationPayload({ asset, upload, expectedInput: input });
    });
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
