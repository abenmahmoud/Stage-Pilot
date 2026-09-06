import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import { agentSkillAudit, knowledgeSources } from "../../../../../db/schema.js";
import { projectKnowledgeRegistrySourceActionPayload } from "../../../../../shared/knowledge-registry-admin-action-payload.js";
import { HttpError } from "../../../../_shared/auth.js";
import { requireKnowledgeManager } from "../../../../_shared/knowledge-registry.js";
import { revokeKnowledgeSourceAndDisableSkills } from "../../../../_shared/knowledge-source-revocation.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

type SourceAction = "publish" | "revoke";

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value) throw new HttpError(400, "Source manquante.");
  return value;
}

function actionFromBody(body: unknown): SourceAction {
  const value = body && typeof body === "object"
    ? (body as Record<string, unknown>).action
    : null;
  if (value !== "publish" && value !== "revoke") {
    throw new HttpError(400, "Action invalide.");
  }
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const context = await requireKnowledgeManager(req, { publish: true });
    const id = routeId(req);
    const action = actionFromBody(req.body);
    const [source] = await db
      .select()
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.id, id),
          eq(knowledgeSources.institutionId, context.institutionId)
        )
      )
      .limit(1);
    if (!source) throw new HttpError(404, "Source introuvable.");

    if (action === "publish") {
      if (source.status !== "draft") throw new HttpError(409, "Cette source n’est pas un brouillon.");
      const now = new Date();
      if (source.validFrom > now || (source.expiresAt && source.expiresAt <= now)) {
        throw new HttpError(409, "La période de validité de cette source est incorrecte.");
      }
      const [published] = await db
        .update(knowledgeSources)
        .set({ status: "published" })
        .where(eq(knowledgeSources.id, id))
        .returning();
      await db.insert(agentSkillAudit).values({
        institutionId: context.institutionId,
        resourceType: "source",
        resourceId: id,
        action: "publish",
        actorId: context.user.id,
        summary: { checksum: source.checksum, expiresAt: source.expiresAt },
      });
      return projectKnowledgeRegistrySourceActionPayload({
        source: published,
        action: "publish",
        disabledSkillCount: 0,
      });
    }

    if (source.status === "revoked") throw new HttpError(409, "Cette source est déjà révoquée.");
    return db.transaction(async (tx) => {
      const outcome = await revokeKnowledgeSourceAndDisableSkills(tx, {
        institutionId: context.institutionId,
        sourceId: id,
        actorId: context.user.id,
        auditSummary: {},
      });
      if (!outcome) throw new HttpError(409, "Cette source a déjà été traitée.");
      const [revoked] = await tx
        .select()
        .from(knowledgeSources)
        .where(eq(knowledgeSources.id, id))
        .limit(1);
      return projectKnowledgeRegistrySourceActionPayload({
        source: revoked,
        action: "revoke",
        disabledSkillCount: outcome.disabledSkillCount,
      });
    });
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
