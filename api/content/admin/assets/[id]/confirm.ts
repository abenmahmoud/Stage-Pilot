import { createHash, randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import { siteContentAssets, siteContentAudit } from "../../../../../db/schema.js";
import { readBoundedBlobBytes } from "../../../../../shared/bounded-blob.js";
import { projectSiteContentAssetConfirmationPayload } from "../../../../../shared/site-content-admin-aux-payload.js";
import { matchesSiteContentFileSignature } from "../../../../../shared/site-content-file-signature.js";
import { HttpError, supabaseAdmin } from "../../../../_shared/auth.js";
import { requireSiteEditor, SITE_CONTENT_QUARANTINE_BUCKET } from "../../../../_shared/site-content.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value || !/^[0-9a-f-]{36}$/i.test(value)) throw new HttpError(400, "Fichier manquant");
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const user = await requireSiteEditor(req);
    const id = routeId(req);
    const [asset] = await db.select().from(siteContentAssets).where(eq(siteContentAssets.id, id)).limit(1);
    if (!asset) throw new HttpError(404, "Fichier introuvable");
    if (["quarantine", "ready"].includes(asset.status)) {
      if (asset.status === "quarantine") res.status(202);
      return projectSiteContentAssetConfirmationPayload(asset, asset);
    }
    if (asset.status !== "pending") throw new HttpError(409, "Ce fichier ne peut plus être utilisé");

    const { data: file, error } = await supabaseAdmin.storage
      .from(asset.storageBucket)
      .download(asset.storagePath);
    if (error || !file) throw new HttpError(409, "Le fichier n’a pas été reçu complètement");

    const uploadedSize = Number(file.size);
    let bytes: Uint8Array | null = null;
    let validSignature = false;
    try {
      bytes = await readBoundedBlobBytes(file, asset.sizeBytes, MAX_FILE_BYTES);
      validSignature = matchesSiteContentFileSignature(bytes, asset.mimeType);
    } catch {
      validSignature = false;
    }
    if (uploadedSize !== asset.sizeBytes || !validSignature) {
      await supabaseAdmin.storage.from(asset.storageBucket).remove([asset.storagePath]);
      await db.update(siteContentAssets).set({
        status: "blocked",
        scanDetail: validSignature ? "size_mismatch" : "invalid_file_signature",
        scannedAt: new Date(),
      }).where(and(eq(siteContentAssets.id, id), eq(siteContentAssets.status, "pending")));
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

    if (!bytes) throw new HttpError(400, "Le fichier reçu ne correspond pas au fichier annoncé");
    const digest = createHash("sha256").update(bytes).digest("hex");
    const jobId = randomUUID();
    const confirmation = await db.transaction(async (tx) => {
      const [quarantined] = await tx
        .update(siteContentAssets)
        .set({ status: "quarantine", scanDetail: "awaiting_antivirus", sha256: digest })
        .where(and(eq(siteContentAssets.id, id), eq(siteContentAssets.status, "pending")))
        .returning();
      if (!quarantined) {
        const [current] = await tx.select().from(siteContentAssets)
          .where(eq(siteContentAssets.id, id)).limit(1);
        if (!current || !["quarantine", "ready"].includes(current.status)) {
          throw new HttpError(409, "Ce fichier ne peut plus être utilisé");
        }
        return current;
      }
      await tx.insert(siteContentAudit).values({
        resourceType: "asset",
        resourceId: id,
        action: "confirm_upload",
        actorId: user.id,
        summary: { sizeBytes: asset.sizeBytes, mimeType: asset.mimeType },
      });
      await tx.execute(sql`
        select pgmq.send(
          'site_content_file_scan',
          jsonb_build_object(
            'job_id', ${jobId}::uuid,
            'job_type', 'scan_site_content_asset',
            'asset_id', ${id}::uuid,
            'attempt', 0
          )
        )
      `);
      return quarantined;
    });
    res.status(confirmation.status === "quarantine" ? 202 : 200);
    return projectSiteContentAssetConfirmationPayload(confirmation, asset);
  });
}

export const config = { api: { bodyParser: false } };
