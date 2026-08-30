import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, isNotNull, or } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { supportAttachments, supportEvents } from "../../../db/schema.js";
import { HttpError, supabaseAdmin } from "../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { requireSupportAccess } from "../../_shared/support.js";
import { enforceAttachmentDownloadRateLimit } from "../../_shared/support-rate-limits.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  return handleApi(res, async () => {
    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "Pièce jointe invalide");
    if (!code || !/^BC-\d{4}-\d{6}$/.test(code)) throw new HttpError(400, "Numéro de demande invalide");

    const access = await requireSupportAccess(req, code);
    await enforceAttachmentDownloadRateLimit(access.sessionId);
    const [attachment] = await db
      .select({
        requestId: supportAttachments.requestId,
        direction: supportAttachments.direction,
        originalName: supportAttachments.originalName,
        storageBucket: supportAttachments.storageBucket,
        storagePath: supportAttachments.storagePath,
        scanStatus: supportAttachments.scanStatus,
      })
      .from(supportAttachments)
      .where(and(
        eq(supportAttachments.id, id),
        eq(supportAttachments.requestId, access.requestId),
        or(
          eq(supportAttachments.direction, "requester"),
          and(
            eq(supportAttachments.direction, "agent"),
            isNotNull(supportAttachments.messageId),
            isNotNull(supportAttachments.releasedAt)
          )
        )
      ))
      .limit(1);
    if (!attachment) throw new HttpError(404, "Pièce jointe introuvable");
    if (attachment.scanStatus !== "clean") {
      throw new HttpError(423, "Le fichier n'est pas encore disponible");
    }

    const { data, error } = await supabaseAdmin.storage
      .from(attachment.storageBucket)
      .createSignedUrl(attachment.storagePath, 60, { download: attachment.originalName });
    if (error || !data?.signedUrl) throw new HttpError(503, "Ouverture du fichier impossible");
    await db.insert(supportEvents).values({
      requestId: attachment.requestId,
      eventType: "attachment.download_link_issued",
      actorType: "requester",
      actorId: access.sessionId,
      toValue: { attachmentId: id, direction: attachment.direction, expiresIn: 60 },
      correlationId: randomUUID(),
    });
    return { url: data.signedUrl, expiresIn: 60 };
  });
}
