import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import { agentSkillAudit, knowledgeDocuments } from "../../../../../db/schema.js";
import { HttpError, supabaseAdmin } from "../../../../_shared/auth.js";
import { requireKnowledgeManager } from "../../../../_shared/knowledge-registry.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, "Document invalide");
  }
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  return handleApi(res, async () => {
    const context = await requireKnowledgeManager(req);
    const id = routeId(req);
    const [document] = await db
      .select({
        id: knowledgeDocuments.id,
        originalName: knowledgeDocuments.originalName,
        storageBucket: knowledgeDocuments.storageBucket,
        storagePath: knowledgeDocuments.storagePath,
        status: knowledgeDocuments.status,
        classification: knowledgeDocuments.classification,
      })
      .from(knowledgeDocuments)
      .where(
        and(
          eq(knowledgeDocuments.id, id),
          eq(knowledgeDocuments.institutionId, context.institutionId),
          inArray(knowledgeDocuments.status, ["review", "ready"])
        )
      )
      .limit(1);
    if (!document) {
      throw new HttpError(404, "Document privé introuvable");
    }
    const downloadName = document.originalName
      .normalize("NFKC")
      .replace(/[\u0000-\u001F\u007F"';\\/]+/g, "-")
      .slice(0, 180) || "document";
    const { data, error } = await supabaseAdmin.storage
      .from(document.storageBucket)
      .createSignedUrl(document.storagePath, 60, { download: downloadName });
    if (error || !data?.signedUrl) {
      throw new Error("Le document privé est momentanément indisponible");
    }
    await db.insert(agentSkillAudit).values({
      institutionId: context.institutionId,
      resourceType: "document",
      resourceId: id,
      action: "access_document",
      actorId: context.user.id,
      summary: {
        decision: "open_for_review",
        purpose: "human_review",
        classification: document.classification,
        expiresInSeconds: 60,
      },
    });
    return { url: data.signedUrl, expiresInSeconds: 60 };
  });
}
