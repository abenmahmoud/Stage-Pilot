import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  communicationSourceDocuments,
  communicationSourceEvents,
} from "../../../../../db/schema.js";
import { HttpError, supabaseAdmin } from "../../../../_shared/auth.js";
import { communicationDocumentUploadEnabled } from "../../../../_shared/communication-documents.js";
import { requireCommunicationEditor } from "../../../../_shared/communications.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value) throw new HttpError(400, "Document manquant");
  return value;
}

type CommunicationDocumentRecord = {
  id: string;
  communicationId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageBucket: string;
  storagePath: string;
  status: string;
  analysisError: string | null;
  uploadedAt: Date | null;
  analyzedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function publicDocument(document: CommunicationDocumentRecord) {
  return {
    id: document.id,
    communicationId: document.communicationId,
    originalName: document.originalName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    status: document.status,
    analysisError: document.analysisError,
    uploadedAt: document.uploadedAt,
    analyzedAt: document.analyzedAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const context = await requireCommunicationEditor(req);
    if (!communicationDocumentUploadEnabled()) {
      throw new HttpError(503, "Le dépôt documentaire n’est pas encore ouvert");
    }
    const id = routeId(req);
    const [document] = await db
      .select({
        id: communicationSourceDocuments.id,
        communicationId: communicationSourceDocuments.communicationId,
        originalName: communicationSourceDocuments.originalName,
        mimeType: communicationSourceDocuments.mimeType,
        sizeBytes: communicationSourceDocuments.sizeBytes,
        storageBucket: communicationSourceDocuments.storageBucket,
        storagePath: communicationSourceDocuments.storagePath,
        status: communicationSourceDocuments.status,
        analysisError: communicationSourceDocuments.analysisError,
        uploadedAt: communicationSourceDocuments.uploadedAt,
        analyzedAt: communicationSourceDocuments.analyzedAt,
        createdAt: communicationSourceDocuments.createdAt,
        updatedAt: communicationSourceDocuments.updatedAt,
      })
      .from(communicationSourceDocuments)
      .where(and(
        eq(communicationSourceDocuments.id, id),
        eq(communicationSourceDocuments.institutionId, context.institutionId)
      ))
      .limit(1);
    if (!document) throw new HttpError(404, "Document introuvable");
    if (["quarantined", "processing", "review", "used"].includes(document.status)) {
      return { document: publicDocument(document), duplicate: true };
    }
    if (!["reserved", "uploaded"].includes(document.status)) {
      throw new HttpError(409, "Ce dépôt ne peut plus être confirmé");
    }

    const separator = document.storagePath.lastIndexOf("/");
    const folder = document.storagePath.slice(0, separator);
    const fileName = document.storagePath.slice(separator + 1);
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from(document.storageBucket)
      .list(folder, { search: fileName, limit: 10 });
    const uploaded = files?.find((file) => file.name === fileName);
    if (listError || !uploaded) {
      throw new HttpError(409, "Le fichier n’a pas été reçu complètement");
    }

    const metadata = (uploaded.metadata ?? {}) as Record<string, unknown>;
    const uploadedSize = Number(metadata.size ?? 0);
    const uploadedMime = String(metadata.mimetype ?? metadata.mimeType ?? "");
    if (uploadedSize !== document.sizeBytes || uploadedMime !== document.mimeType) {
      const { error: removeError } = await supabaseAdmin.storage
        .from(document.storageBucket)
        .remove([document.storagePath]);
      if (removeError) throw new Error("Le fichier non conforme n’a pas pu être supprimé");
      await db.transaction(async (tx) => {
        await tx
          .update(communicationSourceDocuments)
          .set({ status: "rejected", analysisError: "Le fichier reçu diffère du fichier annoncé." })
          .where(and(
            eq(communicationSourceDocuments.id, id),
            eq(communicationSourceDocuments.institutionId, context.institutionId)
          ));
        await tx.insert(communicationSourceEvents).values({
          institutionId: context.institutionId,
          sourceDocumentId: id,
          eventType: "source.rejected",
          actorUserId: context.user.id,
          actorType: "user",
          summary: {
            reason: "upload_metadata_mismatch",
            declaredSize: document.sizeBytes,
            uploadedSize,
            declaredMime: document.mimeType,
            uploadedMime,
          },
        });
      });
      throw new HttpError(400, "Le fichier reçu ne correspond pas au fichier annoncé");
    }

    const jobId = randomUUID();
    const [confirmed] = await db.transaction(async (tx) => {
      const updated = await tx
        .update(communicationSourceDocuments)
        .set({
          status: "quarantined",
          uploadedAt: document.uploadedAt ?? new Date(),
          analysisError: null,
        })
        .where(and(
          eq(communicationSourceDocuments.id, id),
          eq(communicationSourceDocuments.institutionId, context.institutionId),
          inArray(communicationSourceDocuments.status, ["reserved", "uploaded"])
        ))
        .returning({
          id: communicationSourceDocuments.id,
          communicationId: communicationSourceDocuments.communicationId,
          originalName: communicationSourceDocuments.originalName,
          mimeType: communicationSourceDocuments.mimeType,
          sizeBytes: communicationSourceDocuments.sizeBytes,
          storageBucket: communicationSourceDocuments.storageBucket,
          storagePath: communicationSourceDocuments.storagePath,
          status: communicationSourceDocuments.status,
          analysisError: communicationSourceDocuments.analysisError,
          uploadedAt: communicationSourceDocuments.uploadedAt,
          analyzedAt: communicationSourceDocuments.analyzedAt,
          createdAt: communicationSourceDocuments.createdAt,
          updatedAt: communicationSourceDocuments.updatedAt,
        });
      if (!updated[0]) return [];
      await tx.insert(communicationSourceEvents).values({
        institutionId: context.institutionId,
        sourceDocumentId: id,
        eventType: "source.confirmed",
        actorUserId: context.user.id,
        actorType: "user",
        summary: { jobId, mimeType: document.mimeType, sizeBytes: document.sizeBytes },
      });
      await tx.execute(sql`
        select pgmq.send(
          'communication_document_scan',
          jsonb_build_object(
            'job_id', ${jobId}::uuid,
            'job_type', 'scan_communication_document',
            'institution_id', ${context.institutionId}::uuid,
            'source_document_id', ${id}::uuid,
            'attempt', 0
          )
        )
      `);
      return updated;
    });
    if (!confirmed) throw new HttpError(409, "Ce dépôt a déjà été traité");
    res.status(202);
    return { document: publicDocument(confirmed), duplicate: false };
  });
}

export const config = { api: { bodyParser: false } };
