import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import { supportAttachments, supportRequests } from "../../../../db/schema.js";
import { HttpError, supabaseAdmin } from "../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";
import {
  assertSupportRequestAccess,
  requireSupportAgent,
} from "../../../_shared/support-agent-access.js";


export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  return handleApi(res, async () => {
    const { access } = await requireSupportAgent(req);
    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "Pièce jointe invalide");
    const [attachment] = await db
      .select({
        originalName: supportAttachments.originalName,
        storageBucket: supportAttachments.storageBucket,
        storagePath: supportAttachments.storagePath,
        scanStatus: supportAttachments.scanStatus,
        assignedTeam: supportRequests.assignedTeam,
      })
      .from(supportAttachments)
      .innerJoin(supportRequests, eq(supportRequests.id, supportAttachments.requestId))
      .where(eq(supportAttachments.id, id))
      .limit(1);
    if (!attachment) throw new HttpError(404, "Pièce jointe introuvable");
    assertSupportRequestAccess(access, attachment.assignedTeam);
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
