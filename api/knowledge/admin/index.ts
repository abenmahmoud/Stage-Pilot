import { createHash } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  agentEvaluations,
  agentSkillAudit,
  agentSkills,
  agentSkillVersions,
  knowledgeSources,
  skillSourceLinks,
} from "../../../db/schema.js";
import {
  parseAgentSkillDraftInput,
  parseKnowledgeSourceInput,
} from "../../../shared/knowledge-registry-input.js";
import { HttpError } from "../../_shared/auth.js";
import {
  registryInputError,
  requireKnowledgeManager,
} from "../../_shared/knowledge-registry.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

function bodyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Les données sont invalides.");
  }
  return value as Record<string, unknown>;
}

function definitionHash(definition: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(definition)).digest("hex");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      const context = await requireKnowledgeManager(req);
      const [sources, skills, versions, links, evaluations, audit] = await Promise.all([
        db
          .select()
          .from(knowledgeSources)
          .where(eq(knowledgeSources.institutionId, context.institutionId))
          .orderBy(desc(knowledgeSources.updatedAt)),
        db
          .select()
          .from(agentSkills)
          .where(eq(agentSkills.institutionId, context.institutionId))
          .orderBy(asc(agentSkills.name)),
        db
          .select()
          .from(agentSkillVersions)
          .where(eq(agentSkillVersions.institutionId, context.institutionId))
          .orderBy(desc(agentSkillVersions.createdAt)),
        db
          .select()
          .from(skillSourceLinks)
          .where(eq(skillSourceLinks.institutionId, context.institutionId)),
        db
          .select()
          .from(agentEvaluations)
          .where(eq(agentEvaluations.institutionId, context.institutionId))
          .orderBy(desc(agentEvaluations.runAt)),
        db
          .select()
          .from(agentSkillAudit)
          .where(eq(agentSkillAudit.institutionId, context.institutionId))
          .orderBy(desc(agentSkillAudit.createdAt))
          .limit(100),
      ]);
      return { sources, skills, versions, links, evaluations, audit };
    });
  }

  if (req.method === "POST") {
    return handleApi(res, async () => {
      const context = await requireKnowledgeManager(req);
      const body = bodyRecord(req.body);
      const resource = body.resource;

      if (resource === "source") {
        let input;
        try {
          input = parseKnowledgeSourceInput(body.input);
        } catch (error) {
          registryInputError(error);
        }
        const [source] = await db
          .insert(knowledgeSources)
          .values({
            institutionId: context.institutionId,
            ...input,
            ownerUserId: context.user.id,
            status: "draft",
          })
          .returning();
        await db.insert(agentSkillAudit).values({
          institutionId: context.institutionId,
          resourceType: "source",
          resourceId: source.id,
          action: "create",
          actorId: context.user.id,
          summary: { classification: source.classification, sourceType: source.sourceType },
        });
        return { source };
      }

      if (resource === "skill") {
        let input;
        try {
          input = parseAgentSkillDraftInput(body.input);
        } catch (error) {
          registryInputError(error);
        }
        const [existing] = await db
          .select({ id: agentSkills.id })
          .from(agentSkills)
          .where(
            and(
              eq(agentSkills.institutionId, context.institutionId),
              eq(agentSkills.skillKey, input.skillKey)
            )
          )
          .limit(1);
        if (existing) throw new HttpError(409, "Cette compétence existe déjà.");

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
          ownerUserId: context.user.id,
        };
        return db.transaction(async (tx) => {
          const [skill] = await tx
            .insert(agentSkills)
            .values({
              institutionId: context.institutionId,
              skillKey: input.skillKey,
              name: input.name,
              domain: input.domain,
              enabled: false,
            })
            .returning();
          const [version] = await tx
            .insert(agentSkillVersions)
            .values({
              institutionId: context.institutionId,
              skillId: skill.id,
              version: input.version,
              status: "draft",
              definition,
              contentHash: definitionHash(definition),
              dataClassification: input.dataClassification,
              createdBy: context.user.id,
              reviewDueAt: input.reviewDueAt,
            })
            .returning();
          if (input.sourceIds.length > 0) {
            await tx.insert(skillSourceLinks).values(
              input.sourceIds.map((sourceId) => ({
                institutionId: context.institutionId,
                skillVersionId: version.id,
                sourceId,
              }))
            );
          }
          await tx.insert(agentSkillAudit).values({
            institutionId: context.institutionId,
            resourceType: "skill",
            resourceId: skill.id,
            action: "create",
            actorId: context.user.id,
            summary: { version: input.version, status: "draft" },
          });
          return { skill, version };
        });
      }

      if (resource === "version") {
        const skillId = typeof body.skillId === "string" ? body.skillId : "";
        if (!skillId) throw new HttpError(400, "Compétence manquante.");
        let input;
        try {
          input = parseAgentSkillDraftInput(body.input);
        } catch (error) {
          registryInputError(error);
        }
        const [skill] = await db
          .select()
          .from(agentSkills)
          .where(
            and(
              eq(agentSkills.id, skillId),
              eq(agentSkills.institutionId, context.institutionId)
            )
          )
          .limit(1);
        if (!skill) throw new HttpError(404, "Compétence introuvable.");
        if (skill.skillKey !== input.skillKey) {
          throw new HttpError(409, "L’identifiant stable de la compétence ne peut pas changer.");
        }
        const [existingVersion] = await db
          .select({ id: agentSkillVersions.id })
          .from(agentSkillVersions)
          .where(
            and(
              eq(agentSkillVersions.skillId, skillId),
              eq(agentSkillVersions.version, input.version)
            )
          )
          .limit(1);
        if (existingVersion) throw new HttpError(409, "Cette version existe déjà.");

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
          ownerUserId: context.user.id,
        };
        return db.transaction(async (tx) => {
          const [version] = await tx
            .insert(agentSkillVersions)
            .values({
              institutionId: context.institutionId,
              skillId,
              version: input.version,
              status: "draft",
              definition,
              contentHash: definitionHash(definition),
              dataClassification: input.dataClassification,
              createdBy: context.user.id,
              reviewDueAt: input.reviewDueAt,
            })
            .returning();
          if (input.sourceIds.length > 0) {
            await tx.insert(skillSourceLinks).values(
              input.sourceIds.map((sourceId) => ({
                institutionId: context.institutionId,
                skillVersionId: version.id,
                sourceId,
              }))
            );
          }
          await tx.insert(agentSkillAudit).values({
            institutionId: context.institutionId,
            resourceType: "version",
            resourceId: version.id,
            action: "create_version",
            actorId: context.user.id,
            summary: { skillId, version: input.version, status: "draft" },
          });
          return { skill, version };
        });
      }

      throw new HttpError(400, "Type de ressource invalide.");
    });
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}

export const config = { api: { bodyParser: { sizeLimit: "64kb" } } };
