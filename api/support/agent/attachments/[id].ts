import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import { supportAttachments } from "../../../../db/schema.js";
import { HttpError, requireRole, supabaseAdmin } from "../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

const AGENT_ROLES = ["superadmin", "administration", "proviseur"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  return handleApi(res, async () => {
    await requireRole(req, AGENT_ROLES);
    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "Pièce jointe invalide");
    const [attachment] = await db
      .select({
        originalName: supportAttachments.originalName,
        storageBucket: supportAttachments.storageBucket,
        storagePath: supportAttachments.storagePath,
        scanStatus: supportAttachments.scanStatus,
      })
      .from(supportAttachments)
      .where(eq(supportAttachments.id, id))
      .limit(1);
    if (!attachment) throw new HttpError(404, "Pièce jointe introuvable");
    if (attachment.scanStatus !== "clean") {
      throw new HttpError(423, "Le fichier n'est pas encore disponible");
    }
    const { data, error } = await supabaseAdmin.storage
      .from(attachment.storageBucket)
      .createSignedUrl(attachment.storagePath, 60, { download: attachment.originalName });
    if (error || !data?.signedUrl) throw new HttpError(503, "Ouverture du fichier impossible");
    return { url: data.signedUrl, expiresIn: 60 };
  });
}
