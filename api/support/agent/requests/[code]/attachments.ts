import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import { supportAttachments, supportRequests } from "../../../../../db/schema.js";
import { HttpError, supabaseAdmin } from "../../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";
import { assertNoForbiddenSupportSecret } from "../../../../_shared/support.js";
import {
  assertSupportRequestAccess,
  requireSupportAgent,
} from "../../../../_shared/support-agent-access.js";
import { enforceAgentWriteRateLimit } from "../../../../_shared/support-rate-limits.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_AGENT_PENDING_FILES = 5;
const MAX_TOTAL_FILES = 10;
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
    const { user, access, institutionId } = await requireSupportAgent(req);
    await enforceAgentWriteRateLimit(user.id);
    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    if (!code || !/^BC-\d{4}-\d{6}$/.test(code)) {
      throw new HttpError(400, "Numéro de demande invalide");
    }

    const [request] = await db
      .select({
        id: supportRequests.id,
        status: supportRequests.status,
        assignedTeam: supportRequests.assignedTeam,
      })
      .from(supportRequests)
      .where(and(
        eq(supportRequests.institutionId, institutionId),
        eq(supportRequests.publicCode, code)
      ))
      .limit(1);
    if (!request) throw new HttpError(404, "Demande introuvable");
    assertSupportRequestAccess(access, request.assignedTeam);
    if (request.status === "clos") throw new HttpError(409, "Ce dossier est fermé");

    const body = (req.body ?? {}) as Record<string, unknown>;
    const originalName = requiredText(body.fileName, "Nom du fichier", 180);
    assertNoForbiddenSupportSecret(originalName);
    const declaredMime = requiredText(body.mimeType, "Type du fichier", 150).toLowerCase();
    const sizeBytes = Number(body.sizeBytes);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_FILE_BYTES) {
      throw new HttpError(400, "Le fichier doit peser moins de 10 Mo");
    }
    if (!ALLOWED_MIME_TYPES.has(declaredMime)) {
      throw new HttpError(400, "Ce type de fichier n'est pas accepté");
    }

    const attachmentId = randomUUID();
    const storagePath = `${request.id}/${attachmentId}/${safeFileName(originalName)}`;
    const { data: signed, error: signingError } = await supabaseAdmin.storage
      .from(QUARANTINE_BUCKET)
      .createSignedUploadUrl(storagePath);
    if (signingError || !signed?.token) {
      throw new HttpError(503, "Le dépôt de fichiers est momentanément indisponible");
    }

    await db.transaction(async (tx) => {
      await tx.execute(sql`
        select pg_advisory_xact_lock(hashtextextended(${request.id}::text, 0))
      `);
      const existing = await tx
        .select({
          direction: supportAttachments.direction,
          releasedAt: supportAttachments.releasedAt,
        })
        .from(supportAttachments)
        .where(eq(supportAttachments.requestId, request.id))
        .limit(MAX_TOTAL_FILES);
      if (existing.length >= MAX_TOTAL_FILES) {
        throw new HttpError(400, "Ce dossier contient déjà le nombre maximal de documents");
      }
      const pendingAgentFiles = existing.filter((attachment) => (
        attachment.direction === "agent" && attachment.releasedAt === null
      ));
      if (pendingAgentFiles.length >= MAX_AGENT_PENDING_FILES) {
        throw new HttpError(400, "Retirez ou envoyez les documents déjà préparés");
      }

      await tx.insert(supportAttachments).values({
        id: attachmentId,
        requestId: request.id,
        concernsType: "demande",
        documentType: "document_reponse",
        originalName,
        declaredMime,
        sizeBytes,
        storageBucket: QUARANTINE_BUCKET,
        storagePath,
        scanStatus: "awaiting_upload",
        direction: "agent",
        uploadedByUser: user.id,
        retentionUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });
    });

    res.status(201);
    return {
      attachment: { id: attachmentId, originalName, scanStatus: "awaiting_upload" },
      upload: { bucket: QUARANTINE_BUCKET, path: storagePath, token: signed.token },
    };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };
