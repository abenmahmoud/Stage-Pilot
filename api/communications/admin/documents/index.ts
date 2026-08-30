import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  communicationSourceDocuments,
  communicationSourceEvents,
} from "../../../../db/schema.js";
import { parseCommunicationDocumentInput } from "../../../../shared/communication-document-input.js";
import { HttpError, supabaseAdmin } from "../../../_shared/auth.js";
import {
  COMMUNICATION_DOCUMENT_BUCKET,
  communicationDocumentUploadEnabled,
  communicationDocumentStoragePath,
} from "../../../_shared/communication-documents.js";
import { requireCommunicationEditor } from "../../../_shared/communications.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

function invalidDocumentInput(error: unknown): never {
  const reason = error instanceof Error ? error.message : "input_invalid";
  if (reason === "size_invalid") {
    throw new HttpError(400, "Le fichier doit peser moins de 10 Mo.");
  }
  throw new HttpError(400, "Seuls les fichiers PDF et DOCX valides sont acceptés.");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      const context = await requireCommunicationEditor(req);
      const documents = await db
        .select({
          id: communicationSourceDocuments.id,
          communicationId: communicationSourceDocuments.communicationId,
          originalName: communicationSourceDocuments.originalName,
          mimeType: communicationSourceDocuments.mimeType,
          sizeBytes: communicationSourceDocuments.sizeBytes,
          status: communicationSourceDocuments.status,
          analysisError: communicationSourceDocuments.analysisError,
          uploadedAt: communicationSourceDocuments.uploadedAt,
          analyzedAt: communicationSourceDocuments.analyzedAt,
          createdAt: communicationSourceDocuments.createdAt,
          updatedAt: communicationSourceDocuments.updatedAt,
        })
        .from(communicationSourceDocuments)
        .where(eq(communicationSourceDocuments.institutionId, context.institutionId))
        .orderBy(desc(communicationSourceDocuments.createdAt))
        .limit(100);
      return { documents };
    });
  }

  if (req.method === "POST") {
    return handleApi(res, async () => {
      const context = await requireCommunicationEditor(req);
      if (!communicationDocumentUploadEnabled()) {
        throw new HttpError(503, "Le dépôt documentaire n’est pas encore ouvert");
      }
      let input;
      try {
        input = parseCommunicationDocumentInput(req.body);
      } catch (error) {
        invalidDocumentInput(error);
      }

      const storagePath = communicationDocumentStoragePath(input.originalName);
      const { data: upload, error: uploadError } = await supabaseAdmin.storage
        .from(COMMUNICATION_DOCUMENT_BUCKET)
        .createSignedUploadUrl(storagePath);
      if (uploadError || !upload) {
        throw new Error("Le dépôt privé est momentanément indisponible");
      }

      const document = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(communicationSourceDocuments)
          .values({
            institutionId: context.institutionId,
            originalName: input.originalName,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
            storageBucket: COMMUNICATION_DOCUMENT_BUCKET,
            storagePath,
            status: "reserved",
            uploadedBy: context.user.id,
          })
          .returning({
            id: communicationSourceDocuments.id,
            originalName: communicationSourceDocuments.originalName,
            mimeType: communicationSourceDocuments.mimeType,
            sizeBytes: communicationSourceDocuments.sizeBytes,
            status: communicationSourceDocuments.status,
            createdAt: communicationSourceDocuments.createdAt,
          });
        await tx.insert(communicationSourceEvents).values({
          institutionId: context.institutionId,
          sourceDocumentId: created.id,
          eventType: "source.reserved",
          actorUserId: context.user.id,
          actorType: "user",
          summary: { mimeType: input.mimeType, sizeBytes: input.sizeBytes },
        });
        return created;
      });

      res.status(201);
      return {
        document,
        upload: {
          bucket: COMMUNICATION_DOCUMENT_BUCKET,
          path: upload.path,
          token: upload.token,
        },
      };
    });
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
