import { createHash, randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import { supportAttachments, supportEvents } from "../../../../db/schema.js";
import { HttpError, supabaseAdmin } from "../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";
import { requireSupportAccess } from "../../../_shared/support.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function detectMime(bytes: Buffer, declaredMime: string): string | null {
  if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x25, 0x50, 0x44, 0x46]))) {
    return "application/pdf";
  }
  if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return "image/jpeg";
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp") {
    const brand = bytes.toString("ascii", 8, 12);
    if (["heic", "heix", "hevc", "hevx", "mif1"].includes(brand)) return "image/heic";
  }
  if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    if (declaredMime.includes("openxmlformats")) return declaredMime;
    return null;
  }
  if (declaredMime === "text/plain" && !bytes.includes(0)) return "text/plain";
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  return handleApi(res, async () => {
    const attachmentId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    const publicCode = (req.body as Record<string, unknown> | undefined)?.publicCode;
    if (!attachmentId || !/^[0-9a-f-]{36}$/i.test(attachmentId)) {
      throw new HttpError(400, "Pièce jointe invalide");
    }
    if (typeof publicCode !== "string" || !/^BC-\d{4}-\d{6}$/.test(publicCode)) {
      throw new HttpError(400, "Numéro de demande invalide");
    }

    const access = await requireSupportAccess(req, publicCode);
    const [attachment] = await db
      .select()
      .from(supportAttachments)
      .where(
        and(
          eq(supportAttachments.id, attachmentId),
          eq(supportAttachments.requestId, access.requestId)
        )
      )
      .limit(1);
    if (!attachment) throw new HttpError(404, "Pièce jointe introuvable");
    if (attachment.scanStatus !== "awaiting_upload") {
      return { attachment: { id: attachment.id, scanStatus: attachment.scanStatus }, duplicate: true };
    }

    const { data: file, error: downloadError } = await supabaseAdmin.storage
      .from(attachment.storageBucket)
      .download(attachment.storagePath);
    if (downloadError || !file) throw new HttpError(409, "Le fichier n'a pas été reçu");

    const bytes = Buffer.from(await file.arrayBuffer());
    const detectedMime = detectMime(bytes, attachment.declaredMime);
    const accepted = bytes.length > 0 && bytes.length <= MAX_FILE_BYTES && detectedMime !== null;
    const scanStatus = accepted ? "quarantine" : "blocked";
    const scanDetail = accepted ? "awaiting_antivirus" : "invalid_file_signature";
    const correlationId = randomUUID();
    const jobId = randomUUID();

    await db.transaction(async (tx) => {
      await tx
        .update(supportAttachments)
        .set({
          detectedMime,
          sizeBytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          scanStatus,
          scanDetail,
          uploadedAt: new Date(),
        })
        .where(eq(supportAttachments.id, attachment.id));

      await tx.insert(supportEvents).values({
        requestId: access.requestId,
        eventType: accepted ? "attachment.uploaded" : "attachment.blocked",
        actorType: "requester",
        actorId: access.sessionId,
        toValue: { attachmentId: attachment.id, scanStatus, detectedMime },
        correlationId,
      });

      if (accepted) {
        await tx.execute(sql`
          select pgmq.send(
            'support_file_scan',
            jsonb_build_object(
              'job_id', ${jobId}::uuid,
              'job_type', 'scan_attachment',
              'request_id', ${access.requestId}::uuid,
              'attachment_id', ${attachment.id}::uuid,
              'idempotency_key', ${`scan-attachment:${attachment.id}`}::text,
              'attempt', 0
            )
          )
        `);
      }
    });

    if (!accepted) throw new HttpError(422, "Le contenu du fichier n'est pas accepté");
    res.status(202);
    return { attachment: { id: attachment.id, scanStatus }, duplicate: false };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "8kb" } } };
