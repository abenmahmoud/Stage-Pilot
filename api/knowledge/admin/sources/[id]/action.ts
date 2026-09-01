import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  agentSkillAudit,
  agentSkills,
  agentSkillVersions,
  knowledgeSources,
  skillSourceLinks,
} from "../../../../../db/schema.js";
import { projectKnowledgeRegistrySourceActionPayload } from "../../../../../shared/knowledge-registry-admin-action-payload.js";
import { HttpError } from "../../../../_shared/auth.js";
import { requireKnowledgeManager } from "../../../../_shared/knowledge-registry.js";
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
      const [revoked] = await tx
        .update(knowledgeSources)
        .set({ status: "revoked" })
        .where(eq(knowledgeSources.id, id))
        .returning();
      const affected = await tx
        .select({ skillId: agentSkills.id })
        .from(skillSourceLinks)
        .innerJoin(
          agentSkillVersions,
          eq(skillSourceLinks.skillVersionId, agentSkillVersions.id)
        )
        .innerJoin(
          agentSkills,
          eq(agentSkills.activeVersionId, agentSkillVersions.id)
        )
        .where(
          and(
            eq(skillSourceLinks.institutionId, context.institutionId),
            eq(skillSourceLinks.sourceId, id)
          )
        );
      for (const { skillId } of affected) {
        await tx
          .update(agentSkills)
          .set({ enabled: false, activeVersionId: null })
          .where(eq(agentSkills.id, skillId));
      }
      await tx.insert(agentSkillAudit).values({
        institutionId: context.institutionId,
        resourceType: "source",
        resourceId: id,
        action: "revoke",
        actorId: context.user.id,
        summary: { disabledSkillCount: affected.length },
      });
      return projectKnowledgeRegistrySourceActionPayload({
        source: revoked,
        action: "revoke",
        disabledSkillCount: affected.length,
      });
    });
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
