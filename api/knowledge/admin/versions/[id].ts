import { createHash } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  agentEvaluations,
  agentSkillAudit,
  agentSkills,
  agentSkillVersions,
  knowledgeSources,
  skillSourceLinks,
} from "../../../../db/schema.js";
import { parseAgentSkillDraftInput } from "../../../../shared/knowledge-registry-input.js";
import { HttpError } from "../../../_shared/auth.js";
import {
  registryInputError,
  requireKnowledgeManager,
} from "../../../_shared/knowledge-registry.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value) throw new HttpError(400, "Version manquante.");
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "PATCH") return methodNotAllowed(res, ["PATCH"]);
  return handleApi(res, async () => {
    const context = await requireKnowledgeManager(req);
    const id = routeId(req);
    const [current] = await db
      .select({ version: agentSkillVersions, skill: agentSkills })
      .from(agentSkillVersions)
      .innerJoin(agentSkills, eq(agentSkillVersions.skillId, agentSkills.id))
      .where(
        and(
          eq(agentSkillVersions.id, id),
          eq(agentSkillVersions.institutionId, context.institutionId)
        )
      )
      .limit(1);
    if (!current) throw new HttpError(404, "Version introuvable.");
    if (current.version.status !== "draft") {
      throw new HttpError(409, "Une version en validation ou publiée est immuable.");
    }
    let input;
    try {
      input = parseAgentSkillDraftInput(req.body);
    } catch (error) {
      registryInputError(error);
    }
    if (input.skillKey !== current.skill.skillKey) {
      throw new HttpError(409, "L’identifiant d’une compétence ne peut pas être modifié.");
    }
    if (input.sourceIds.length > 0) {
      const sources = await db
        .select({ id: knowledgeSources.id })
        .from(knowledgeSources)
        .where(
          and(
            eq(knowledgeSources.institutionId, context.institutionId),
            inArray(knowledgeSources.id, input.sourceIds)
          )
        );
      if (sources.length !== input.sourceIds.length) {
        throw new HttpError(409, "Une source n’appartient pas à cet établissement.");
      }
    }
    const definition = {
      instructions: input.instructions,
      allowedTools: input.allowedTools,
      ownerUserId: current.version.createdBy,
    };
    return db.transaction(async (tx) => {
      const [skill] = await tx
        .update(agentSkills)
        .set({ name: input.name, domain: input.domain })
        .where(eq(agentSkills.id, current.skill.id))
        .returning();
      const [version] = await tx
        .update(agentSkillVersions)
        .set({
          version: input.version,
          definition,
          contentHash: createHash("sha256").update(JSON.stringify(definition)).digest("hex"),
          dataClassification: input.dataClassification,
          reviewDueAt: input.reviewDueAt,
        })
        .where(eq(agentSkillVersions.id, id))
        .returning();
      await tx.delete(skillSourceLinks).where(eq(skillSourceLinks.skillVersionId, id));
      await tx.delete(agentEvaluations).where(eq(agentEvaluations.skillVersionId, id));
      if (input.sourceIds.length > 0) {
        await tx.insert(skillSourceLinks).values(
          input.sourceIds.map((sourceId) => ({
            institutionId: context.institutionId,
            skillVersionId: id,
            sourceId,
          }))
        );
      }
      await tx.insert(agentSkillAudit).values({
        institutionId: context.institutionId,
        resourceType: "version",
        resourceId: id,
        action: "update",
        actorId: context.user.id,
        summary: { version: input.version },
      });
      return { skill, version };
    });
  });
}
