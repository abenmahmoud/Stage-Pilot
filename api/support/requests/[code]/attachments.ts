import { createHash, randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import { supportAttachments, supportEvents } from "../../../../db/schema.js";
import { HttpError, supabaseAdmin } from "../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";
import {
  assertNoForbiddenSupportSecret,
  idempotencyKey,
  requireSupportAccess,
} from "../../../_shared/support.js";
import { enforceAttachmentReservationRateLimit } from "../../../_shared/support-rate-limits.js";
import {
  isSupportRequesterAttachmentReservationInput,
  singleSupportQueryValue,
} from "../../../../shared/support-public-mutation-input-policy.js";

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
  concernsType: string;
  concernsLabel: string | null;
  documentType: string;
  note: string | null;
}): string {
  return createHash("sha256")
    .update(JSON.stringify({
      originalName: input.originalName.normalize("NFC"),
      declaredMime: input.declaredMime,
      sizeBytes: input.sizeBytes,
      concernsType: input.concernsType,
      concernsLabel: input.concernsLabel?.normalize("NFC") ?? null,
      documentType: input.documentType,
      note: input.note?.normalize("NFC") ?? null,
    }), "utf8")
    .digest("hex");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  return handleApi(res, async () => {
    const code = singleSupportQueryValue(req.query.code);
    if (!code || !/^BC-\d{4}-\d{6}$/.test(code)) {
      throw new HttpError(400, "Numéro de demande invalide");
    }

    const access = await requireSupportAccess(req, code);
    await enforceAttachmentReservationRateLimit(access.sessionId);
    if (!isSupportRequesterAttachmentReservationInput(req.body)) {
      throw new HttpError(400, "Données du fichier invalides");
    }
    const body = req.body;
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

    const concernsType = requiredText(body.concernsType ?? "demande", "Personne concernée", 50);
    const concernsLabel =
      typeof body.concernsLabel === "string" && body.concernsLabel.trim()
        ? body.concernsLabel.trim().slice(0, 180)
        : null;
    const documentType = requiredText(body.documentType ?? "justificatif", "Type de document", 80);
    const note =
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 500)
        : null;
    for (const value of [concernsType, concernsLabel, documentType, note]) {
      if (value) assertNoForbiddenSupportSecret(value);
    }
    const reservationOperationId = operationId(req);
    const reservationFingerprint = fileFingerprint({
      originalName,
      declaredMime,
      sizeBytes,
      concernsType,
      concernsLabel,
      documentType,
      note,
    });

    const attachmentId = randomUUID();
    const storagePath = `${access.requestId}/${attachmentId}/${safeFileName(originalName)}`;
    const reservation = await db.transaction(async (tx) => {
      await tx.execute(sql`
        select pg_advisory_xact_lock(hashtextextended(${access.requestId}::text, 0))
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
          eq(supportEvents.requestId, access.requestId),
          eq(supportEvents.correlationId, reservationOperationId)
        ))
        .orderBy(desc(supportEvents.createdAt))
        .limit(1);
      if (operationEvent) {
        if (
          operationEvent.eventType !== "attachment.draft_reserved"
          || operationEvent.actorType !== "requester"
          || operationEvent.actorId !== access.sessionId
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
            eq(supportAttachments.requestId, access.requestId),
            eq(supportAttachments.direction, "requester"),
            eq(supportAttachments.uploadedBySession, access.sessionId)
          ))
          .limit(1);
        if (
          !existingAttachment
          || existingAttachment.originalName !== originalName
          || existingAttachment.declaredMime !== declaredMime
          || Number(existingAttachment.sizeBytes) !== sizeBytes
          || existingAttachment.concernsType !== concernsType
          || existingAttachment.concernsLabel !== concernsLabel
          || existingAttachment.documentType !== documentType
          || existingAttachment.note !== note
          || existingAttachment.storageBucket !== QUARANTINE_BUCKET
        ) {
          throw new HttpError(409, "La réservation existante ne correspond plus à ce fichier");
        }
        return { attachment: existingAttachment, duplicate: true };
      }

      const existing = await tx
        .select({ id: supportAttachments.id })
        .from(supportAttachments)
        .where(and(
          eq(supportAttachments.requestId, access.requestId),
          eq(supportAttachments.direction, "requester")
        ))
        .limit(MAX_FILES_PER_REQUEST);
      if (existing.length >= MAX_FILES_PER_REQUEST) {
        throw new HttpError(400, "Une demande peut contenir au maximum 5 fichiers");
      }

      const [created] = await tx.insert(supportAttachments).values({
        id: attachmentId,
        requestId: access.requestId,
        concernsType,
        concernsLabel,
        documentType,
        note,
        originalName,
        declaredMime,
        sizeBytes,
        storageBucket: QUARANTINE_BUCKET,
        storagePath,
        scanStatus: "awaiting_upload",
        uploadedBySession: access.sessionId,
        retentionUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      }).returning();
      await tx.insert(supportEvents).values({
        requestId: access.requestId,
        eventType: "attachment.draft_reserved",
        actorType: "requester",
        actorId: access.sessionId,
        toValue: {
          attachmentId: created.id,
          direction: "requester",
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
