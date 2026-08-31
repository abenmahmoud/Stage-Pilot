import { createHash, randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  supportAttachments,
  supportEvents,
  supportRequests,
} from "../../../../../db/schema.js";
import { HttpError, supabaseAdmin } from "../../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";
import {
  assertSupportRequestAccess,
  requireSupportAgent,
} from "../../../../_shared/support-agent-access.js";
import { enforceAgentWriteRateLimit } from "../../../../_shared/support-rate-limits.js";
import { readBoundedBlobBytes } from "../../../../../shared/bounded-blob.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function detectMime(bytes: Buffer, declaredMime: string): string | null {
  if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x25, 0x50, 0x44, 0x46]))) return "application/pdf";
  if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return "image/png";
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp") {
    const brand = bytes.toString("ascii", 8, 12);
    if (["heic", "heix", "hevc", "hevx", "mif1"].includes(brand)) return "image/heic";
  }
  if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    return declaredMime.includes("openxmlformats") ? declaredMime : null;
  }
  if (declaredMime === "text/plain" && !bytes.includes(0)) return "text/plain";
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  return handleApi(res, async () => {
    const { user, access, institutionId } = await requireSupportAgent(req);
    await enforceAgentWriteRateLimit(user.id);
    const attachmentId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (!attachmentId || !/^[0-9a-f-]{36}$/i.test(attachmentId)) {
      throw new HttpError(400, "Pièce jointe invalide");
    }

    const [attachment] = await db
      .select({
        id: supportAttachments.id,
        requestId: supportAttachments.requestId,
        declaredMime: supportAttachments.declaredMime,
        sizeBytes: supportAttachments.sizeBytes,
        storageBucket: supportAttachments.storageBucket,
        storagePath: supportAttachments.storagePath,
        scanStatus: supportAttachments.scanStatus,
        assignedTeam: supportRequests.assignedTeam,
      })
      .from(supportAttachments)
      .innerJoin(supportRequests, eq(supportRequests.id, supportAttachments.requestId))
      .where(and(
        eq(supportRequests.institutionId, institutionId),
        eq(supportAttachments.id, attachmentId),
        eq(supportAttachments.direction, "agent"),
        eq(supportAttachments.uploadedByUser, user.id)
      ))
      .limit(1);
    if (!attachment) throw new HttpError(404, "Pièce jointe introuvable");
    assertSupportRequestAccess(access, attachment.assignedTeam);
    if (attachment.scanStatus !== "awaiting_upload") {
      return { attachment: { id: attachment.id, scanStatus: attachment.scanStatus }, duplicate: true };
    }

    const { data: file, error: downloadError } = await supabaseAdmin.storage
      .from(attachment.storageBucket)
      .download(attachment.storagePath);
    if (downloadError || !file) throw new HttpError(409, "Le fichier n'a pas été reçu");

    let bytes: Buffer | null = null;
    try {
      bytes = Buffer.from(await readBoundedBlobBytes(file, Number(attachment.sizeBytes), MAX_FILE_BYTES));
    } catch {
      bytes = null;
    }
    const detectedMime = bytes ? detectMime(bytes, attachment.declaredMime) : null;
    const accepted = bytes !== null && detectedMime !== null;
    const scanStatus = accepted ? "quarantine" : "blocked";
    const scanDetail = accepted ? "awaiting_antivirus" : "invalid_file_signature";
    const correlationId = randomUUID();
    const jobId = randomUUID();

    const confirmation = await db.transaction(async (tx) => {
      const [confirmed] = await tx
        .update(supportAttachments)
        .set({
          detectedMime,
          sizeBytes: Number(file.size),
          sha256: bytes ? createHash("sha256").update(bytes).digest("hex") : null,
          scanStatus,
          scanDetail,
          uploadedAt: new Date(),
        })
        .where(and(
          eq(supportAttachments.id, attachment.id),
          eq(supportAttachments.scanStatus, "awaiting_upload")
        ))
        .returning({ scanStatus: supportAttachments.scanStatus });

      if (!confirmed) {
        const [current] = await tx
          .select({ scanStatus: supportAttachments.scanStatus })
          .from(supportAttachments)
          .where(eq(supportAttachments.id, attachment.id))
          .limit(1);
        if (!current) throw new HttpError(404, "Pièce jointe introuvable");
        return { scanStatus: current.scanStatus, duplicate: true };
      }

      await tx.insert(supportEvents).values({
        requestId: attachment.requestId,
        eventType: accepted ? "attachment.uploaded" : "attachment.blocked",
        actorType: "agent",
        actorId: user.id,
        toValue: { attachmentId: attachment.id, direction: "agent", scanStatus, detectedMime },
        correlationId,
      });

      if (accepted) {
        await tx.execute(sql`
          select pgmq.send(
            'support_file_scan',
            jsonb_build_object(
              'job_id', ${jobId}::uuid,
              'job_type', 'scan_attachment',
              'institution_id', ${institutionId}::uuid,
              'request_id', ${attachment.requestId}::uuid,
              'attachment_id', ${attachment.id}::uuid,
              'idempotency_key', ${`scan-attachment:${attachment.id}`}::text,
              'attempt', 0
            )
          )
        `);
      }
      return { scanStatus, duplicate: false };
    });

    if (confirmation.duplicate) {
      return {
        attachment: { id: attachment.id, scanStatus: confirmation.scanStatus },
        duplicate: true,
      };
    }
    if (!accepted) throw new HttpError(422, "Le contenu du fichier n'est pas accepté");
    res.status(202);
    return { attachment: { id: attachment.id, scanStatus }, duplicate: false };
  });
}

export const config = { api: { bodyParser: false } };
