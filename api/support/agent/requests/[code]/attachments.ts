import { createHash, randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  supportAttachments,
  supportEvents,
  supportRequests,
} from "../../../../../db/schema.js";
import { HttpError, supabaseAdmin } from "../../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";
import {
  assertNoForbiddenSupportSecret,
  idempotencyKey,
} from "../../../../_shared/support.js";
import {
  assertSupportRequestAccess,
  requireSupportAgent,
} from "../../../../_shared/support-agent-access.js";
import { enforceAgentWriteRateLimit } from "../../../../_shared/support-rate-limits.js";
import {
  isSupportAgentAttachmentReservationInput,
  singleSupportAgentRouteValue,
} from "../../../../../shared/support-agent-mutation-input-policy.js";

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

function operationId(req: VercelRequest): string {
  const value = idempotencyKey(req);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, "Clé de dépôt invalide");
  }
  return value;
}

function fileFingerprint(input: {
  originalName: string;
  declaredMime: string;
  sizeBytes: number;
}): string {
  return createHash("sha256")
    .update(JSON.stringify({
      originalName: input.originalName.normalize("NFC"),
      declaredMime: input.declaredMime,
      sizeBytes: input.sizeBytes,
    }), "utf8")
    .digest("hex");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  return handleApi(res, async () => {
    const { user, access, institutionId } = await requireSupportAgent(req);
    await enforceAgentWriteRateLimit(user.id);
    const code = singleSupportAgentRouteValue(req.query.code);
    if (!code || !/^BC-\d{4}-\d{6}$/.test(code)) {
      throw new HttpError(400, "Numéro de demande invalide");
    }
    if (!isSupportAgentAttachmentReservationInput(req.body)) {
      throw new HttpError(400, "Dépôt de fichier invalide");
    }
    const body = req.body;

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

    const originalName = requiredText(body.fileName, "Nom du fichier", 180);
    assertNoForbiddenSupportSecret(originalName);
    const declaredMime = requiredText(body.mimeType, "Type du fichier", 150).toLowerCase();
    const sizeBytes = body.sizeBytes;
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_FILE_BYTES) {
      throw new HttpError(400, "Le fichier doit peser moins de 10 Mo");
    }
    if (!ALLOWED_MIME_TYPES.has(declaredMime)) {
      throw new HttpError(400, "Ce type de fichier n'est pas accepté");
    }
    const reservationOperationId = operationId(req);
    const reservationFingerprint = fileFingerprint({ originalName, declaredMime, sizeBytes });

    const attachmentId = randomUUID();
    const storagePath = `${request.id}/${attachmentId}/${safeFileName(originalName)}`;
    const reservation = await db.transaction(async (tx) => {
      await tx.execute(sql`
        select pg_advisory_xact_lock(hashtextextended(${request.id}::text, 0))
      `);
      const [operationEvent] = await tx
        .select({
          eventType: supportEvents.eventType,
          actorType: supportEvents.actorType,
          actorId: supportEvents.actorId,
          attachmentId: sql<string | null>`${supportEvents.toValue}->>'attachmentId'`,
          fileFingerprint: sql<string | null>`${supportEvents.toValue}->>'fileFingerprint'`,
        })
        .from(supportEvents)
        .where(and(
          eq(supportEvents.requestId, request.id),
          eq(supportEvents.correlationId, reservationOperationId)
        ))
        .orderBy(desc(supportEvents.createdAt))
        .limit(1);
      if (operationEvent) {
        if (
          operationEvent.eventType !== "attachment.draft_reserved"
          || operationEvent.actorType !== "agent"
          || operationEvent.actorId !== user.id
          || operationEvent.fileFingerprint !== reservationFingerprint
          || !operationEvent.attachmentId
        ) {
          throw new HttpError(409, "Cette clé de dépôt a déjà été utilisée pour un autre fichier");
        }
        const [existingAttachment] = await tx
          .select()
          .from(supportAttachments)
          .where(and(
            eq(supportAttachments.id, operationEvent.attachmentId),
            eq(supportAttachments.requestId, request.id),
            eq(supportAttachments.direction, "agent"),
            eq(supportAttachments.uploadedByUser, user.id)
          ))
          .limit(1);
        if (
          !existingAttachment
          || existingAttachment.originalName !== originalName
          || existingAttachment.declaredMime !== declaredMime
          || Number(existingAttachment.sizeBytes) !== sizeBytes
          || existingAttachment.storageBucket !== QUARANTINE_BUCKET
        ) {
          throw new HttpError(409, "La réservation existante ne correspond plus à ce fichier");
        }
        if (
          existingAttachment.messageId
          || existingAttachment.releasedAt
          || existingAttachment.scanStatus === "removal_pending"
        ) {
          throw new HttpError(409, "Ce brouillon n'est plus disponible pour un nouvel envoi");
        }
        return { attachment: existingAttachment, duplicate: true };
      }

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

      const [created] = await tx.insert(supportAttachments).values({
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
      }).returning();
      await tx.insert(supportEvents).values({
        requestId: request.id,
        eventType: "attachment.draft_reserved",
        actorType: "agent",
        actorId: user.id,
        toValue: {
          attachmentId: created.id,
          direction: "agent",
          fileFingerprint: reservationFingerprint,
          scanStatus: created.scanStatus,
        },
        correlationId: reservationOperationId,
      });
      return { attachment: created, duplicate: false };
    });

    if (reservation.attachment.scanStatus !== "awaiting_upload") {
      return {
        attachment: {
          id: reservation.attachment.id,
          originalName: reservation.attachment.originalName,
          scanStatus: reservation.attachment.scanStatus,
        },
        upload: null,
        duplicate: true,
      };
    }

    const { data: signed, error: signingError } = await supabaseAdmin.storage
      .from(reservation.attachment.storageBucket)
      .createSignedUploadUrl(reservation.attachment.storagePath, { upsert: true });
    if (signingError || !signed?.token) {
      throw new HttpError(503, "Le dépôt de fichiers est momentanément indisponible");
    }

    res.status(reservation.duplicate ? 200 : 201);
    return {
      attachment: {
        id: reservation.attachment.id,
        originalName: reservation.attachment.originalName,
        scanStatus: reservation.attachment.scanStatus,
      },
      upload: {
        bucket: QUARANTINE_BUCKET,
        path: reservation.attachment.storagePath,
        token: signed.token,
      },
      duplicate: reservation.duplicate,
    };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };
