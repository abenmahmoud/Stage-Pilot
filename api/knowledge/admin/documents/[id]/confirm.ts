import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
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
    if (document.status === "uploaded") return { document };
    if (document.status !== "reserved") {
      throw new HttpError(409, "Ce dépôt ne peut plus être confirmé");
    }

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

    const [confirmed] = await db
      .update(knowledgeDocuments)
      .set({ status: "uploaded", uploadedAt: new Date(), analysisError: null })
      .where(eq(knowledgeDocuments.id, id))
      .returning();
    await db.insert(agentSkillAudit).values({
      institutionId: context.institutionId,
      resourceType: "document",
      resourceId: id,
      action: "confirm_upload",
      actorId: context.user.id,
      summary: { mimeType: document.mimeType, sizeBytes: document.sizeBytes },
    });
    return { document: confirmed };
  });
}
