import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import { supportAttachments } from "../../../../db/schema.js";
import { HttpError, supabaseAdmin } from "../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";
import { requireSupportAccess } from "../../../_shared/support.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 5;
const QUARANTINE_BUCKET = "support-quarantine";
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function requiredText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new HttpError(400, `${label} est requis`);
  const clean = value.replace(/[\u0000-\u001F]/g, "").trim();
  if (!clean || clean.length > maxLength) throw new HttpError(400, `${label} est invalide`);
  return clean;
}

function safeFileName(value: string): string {
  const clean = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(-90);
  return clean || "document";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  return handleApi(res, async () => {
    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    if (!code || !/^BC-\d{4}-\d{6}$/.test(code)) {
      throw new HttpError(400, "Numéro de demande invalide");
    }

    const access = await requireSupportAccess(req, code);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const originalName = requiredText(body.fileName, "Nom du fichier", 180);
    const declaredMime = requiredText(body.mimeType, "Type du fichier", 150).toLowerCase();
    const sizeBytes = Number(body.sizeBytes);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_FILE_BYTES) {
      throw new HttpError(400, "Le fichier doit peser moins de 10 Mo");
    }
    if (!ALLOWED_MIME_TYPES.has(declaredMime)) {
      throw new HttpError(400, "Ce type de fichier n'est pas accepté");
    }

    const existing = await db
      .select({ id: supportAttachments.id })
      .from(supportAttachments)
      .where(eq(supportAttachments.requestId, access.requestId))
      .limit(MAX_FILES_PER_REQUEST);
    if (existing.length >= MAX_FILES_PER_REQUEST) {
      throw new HttpError(400, "Une demande peut contenir au maximum 5 fichiers");
    }

    const attachmentId = randomUUID();
    const storagePath = `${access.requestId}/${attachmentId}/${safeFileName(originalName)}`;
    const { data: signed, error: signingError } = await supabaseAdmin.storage
      .from(QUARANTINE_BUCKET)
      .createSignedUploadUrl(storagePath);
    if (signingError || !signed?.token) {
      throw new HttpError(503, "Le dépôt de fichiers est momentanément indisponible");
    }

    await db.insert(supportAttachments).values({
      id: attachmentId,
      requestId: access.requestId,
      concernsType: requiredText(body.concernsType ?? "demande", "Personne concernée", 50),
      concernsLabel:
        typeof body.concernsLabel === "string" && body.concernsLabel.trim()
          ? body.concernsLabel.trim().slice(0, 180)
          : null,
      documentType: requiredText(body.documentType ?? "justificatif", "Type de document", 80),
      note:
        typeof body.note === "string" && body.note.trim()
          ? body.note.trim().slice(0, 500)
          : null,
      originalName,
      declaredMime,
      sizeBytes,
      storageBucket: QUARANTINE_BUCKET,
      storagePath,
      uploadedBySession: access.sessionId,
      retentionUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    });

    res.status(201);
    return {
      attachment: { id: attachmentId, originalName, scanStatus: "awaiting_upload" },
      upload: { bucket: QUARANTINE_BUCKET, path: storagePath, token: signed.token },
    };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };
