import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import { agentSkillAudit, knowledgeDocuments } from "../../../../../db/schema.js";
import { HttpError, supabaseAdmin } from "../../../../_shared/auth.js";
import { requireKnowledgeManager } from "../../../../_shared/knowledge-registry.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value) throw new HttpError(400, "Document manquant");
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const context = await requireKnowledgeManager(req);
    const id = routeId(req);
    const [document] = await db
      .select()
      .from(knowledgeDocuments)
      .where(
        and(
          eq(knowledgeDocuments.id, id),
          eq(knowledgeDocuments.institutionId, context.institutionId)
        )
      )
      .limit(1);
    if (!document) throw new HttpError(404, "Document introuvable");
    if (["quarantined", "processing", "review", "ready"].includes(document.status)) {
      return { document, duplicate: true };
    }
    if (!["reserved", "uploaded"].includes(document.status)) {
      throw new HttpError(409, "Ce dépôt ne peut plus être confirmé");
    }

    if (document.status === "reserved") {
      const separator = document.storagePath.lastIndexOf("/");
      const folder = document.storagePath.slice(0, separator);
      const fileName = document.storagePath.slice(separator + 1);
      const { data: files, error } = await supabaseAdmin.storage
        .from(document.storageBucket)
        .list(folder, { search: fileName, limit: 10 });
      const uploaded = files?.find((file) => file.name === fileName);
      if (error || !uploaded) {
        throw new HttpError(409, "Le fichier n’a pas été reçu complètement");
      }

      const metadata = (uploaded.metadata ?? {}) as Record<string, unknown>;
      const uploadedSize = Number(metadata.size ?? 0);
      const uploadedMime = String(metadata.mimetype ?? metadata.mimeType ?? "");
      if (
        uploadedSize !== document.sizeBytes ||
        (uploadedMime && uploadedMime !== document.mimeType)
      ) {
        await supabaseAdmin.storage.from(document.storageBucket).remove([document.storagePath]);
        await db
          .update(knowledgeDocuments)
          .set({ status: "rejected", analysisError: "Le fichier reçu diffère du fichier annoncé." })
          .where(eq(knowledgeDocuments.id, id));
        await db.insert(agentSkillAudit).values({
          institutionId: context.institutionId,
          resourceType: "document",
          resourceId: id,
          action: "reject_upload",
          actorId: context.user.id,
          summary: {
            uploadedSize,
            declaredSize: document.sizeBytes,
            uploadedMime,
            declaredMime: document.mimeType,
          },
        });
        throw new HttpError(400, "Le fichier reçu ne correspond pas au fichier annoncé");
      }
    }

    const jobId = randomUUID();
    const [confirmed] = await db.transaction(async (tx) => {
      const updated = await tx
        .update(knowledgeDocuments)
        .set({
          status: "quarantined",
          uploadedAt: document.uploadedAt ?? new Date(),
          analysisSummary: "Contrôle antivirus en attente.",
          analysisError: null,
        })
        .where(
          and(
            eq(knowledgeDocuments.id, id),
            eq(knowledgeDocuments.institutionId, context.institutionId),
            inArray(knowledgeDocuments.status, ["reserved", "uploaded"])
          )
        )
        .returning();
      if (!updated[0]) return [];
      await tx.insert(agentSkillAudit).values([
        {
          institutionId: context.institutionId,
          resourceType: "document",
          resourceId: id,
          action: "confirm_upload",
          actorId: context.user.id,
          summary: { mimeType: document.mimeType, sizeBytes: document.sizeBytes },
        },
        {
          institutionId: context.institutionId,
          resourceType: "document",
          resourceId: id,
          action: "queue_analysis",
          actorId: context.user.id,
          summary: { jobId },
        },
      ]);
      await tx.execute(sql`
        select pgmq.send(
          'knowledge_document_scan',
          jsonb_build_object(
            'job_id', ${jobId}::uuid,
            'job_type', 'scan_knowledge_document',
            'institution_id', ${context.institutionId}::uuid,
            'document_id', ${id}::uuid,
            'attempt', 0
          )
        )
      `);
      return updated;
    });
    if (!confirmed) throw new HttpError(409, "Ce dépôt a déjà été traité");
    res.status(202);
    return { document: confirmed, duplicate: false };
  });
}
