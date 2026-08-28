import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import { agentSkillAudit, knowledgeDocuments } from "../../../../db/schema.js";
import { parseKnowledgeDocumentInput } from "../../../../shared/knowledge-document-input.js";
import { supabaseAdmin } from "../../../_shared/auth.js";
import {
  KNOWLEDGE_DOCUMENT_BUCKET,
  knowledgeDocumentStoragePath,
} from "../../../_shared/knowledge-documents.js";
import {
  registryInputError,
  requireKnowledgeManager,
} from "../../../_shared/knowledge-registry.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      const context = await requireKnowledgeManager(req);
      const documents = await db
        .select()
        .from(knowledgeDocuments)
        .where(eq(knowledgeDocuments.institutionId, context.institutionId))
        .orderBy(desc(knowledgeDocuments.createdAt))
        .limit(200);
      return { documents };
    });
  }

  if (req.method === "POST") {
    return handleApi(res, async () => {
      const context = await requireKnowledgeManager(req);
      let input;
      try {
        input = parseKnowledgeDocumentInput(req.body);
      } catch (error) {
        registryInputError(error);
      }

      const storagePath = knowledgeDocumentStoragePath(
        context.institutionId,
        context.user.id,
        input.originalName
      );
      const { data: upload, error: uploadError } = await supabaseAdmin.storage
        .from(KNOWLEDGE_DOCUMENT_BUCKET)
        .createSignedUploadUrl(storagePath);
      if (uploadError || !upload) {
        throw new Error("Le dépôt privé est momentanément indisponible");
      }

      const [document] = await db
        .insert(knowledgeDocuments)
        .values({
          institutionId: context.institutionId,
          ...input,
          reviewDueAt: new Date(input.reviewDueAt),
          storageBucket: KNOWLEDGE_DOCUMENT_BUCKET,
          storagePath,
          uploadedBy: context.user.id,
          status: "reserved",
        })
        .returning();
      await db.insert(agentSkillAudit).values({
        institutionId: context.institutionId,
        resourceType: "document",
        resourceId: document.id,
        action: "reserve_upload",
        actorId: context.user.id,
        summary: {
          classification: document.classification,
          mimeType: document.mimeType,
          sizeBytes: document.sizeBytes,
        },
      });
      return {
        document,
        upload: {
          bucket: KNOWLEDGE_DOCUMENT_BUCKET,
          path: upload.path,
          token: upload.token,
        },
      };
    });
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}
