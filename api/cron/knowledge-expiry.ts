import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  agentSkillAudit,
  agentSkills,
  agentSkillVersions,
  knowledgeSources,
  skillSourceLinks,
} from "../../db/schema.js";
import { secretMatches, HttpError } from "../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { buildKnowledgeExpiryPlan } from "../../shared/knowledge-expiry-policy.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  return handleApi(res, async () => {
    const authorization = req.headers.authorization;
    const provided = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : undefined;
    if (!secretMatches(process.env.CRON_SECRET, provided)) {
      throw new HttpError(401, "Accès refusé");
    }

    const now = new Date();
    return db.transaction(async (tx) => {
      const expiredSources = await tx
        .update(knowledgeSources)
        .set({ status: "expired", updatedAt: now })
        .where(
          and(
            eq(knowledgeSources.status, "published"),
            isNotNull(knowledgeSources.expiresAt),
            lte(knowledgeSources.expiresAt, now)
          )
        )
        .returning({
          id: knowledgeSources.id,
          institutionId: knowledgeSources.institutionId,
        });

      const activeSkills = await tx
        .select({
          skillId: agentSkills.id,
          institutionId: agentSkills.institutionId,
          activeVersionId: agentSkillVersions.id,
          reviewDueAt: agentSkillVersions.reviewDueAt,
        })
        .from(agentSkills)
        .innerJoin(
          agentSkillVersions,
          eq(agentSkills.activeVersionId, agentSkillVersions.id)
        )
        .where(eq(agentSkills.enabled, true));

      const activeVersionIds = activeSkills.map((skill) => skill.activeVersionId);
      const links = activeVersionIds.length > 0
        ? await tx
            .select({
              skillVersionId: skillSourceLinks.skillVersionId,
              sourceId: skillSourceLinks.sourceId,
              required: skillSourceLinks.required,
            })
            .from(skillSourceLinks)
            .where(inArray(skillSourceLinks.skillVersionId, activeVersionIds))
        : [];
      const plan = buildKnowledgeExpiryPlan({
        skills: activeSkills.map((skill) => ({
          ...skill,
          reviewDueAt: skill.reviewDueAt.toISOString(),
        })),
        links,
        expiredSourceIds: expiredSources.map((source) => source.id),
        now: now.toISOString(),
      });

      const disabled = plan.length > 0
        ? await tx
            .update(agentSkills)
            .set({ enabled: false, activeVersionId: null, updatedAt: now })
            .where(
              and(
                eq(agentSkills.enabled, true),
                inArray(agentSkills.id, plan.map((item) => item.skillId))
              )
            )
            .returning({ id: agentSkills.id })
        : [];
      const disabledIds = new Set(disabled.map((skill) => skill.id));

      if (expiredSources.length > 0) {
        await tx.insert(agentSkillAudit).values(
          expiredSources.map((source) => ({
            institutionId: source.institutionId,
            resourceType: "source",
            resourceId: source.id,
            action: "expire_automatic",
            actorId: null,
            summary: { trigger: "schedule", expiredAt: now.toISOString() },
          }))
        );
      }
      const disabledPlan = plan.filter((item) => disabledIds.has(item.skillId));
      if (disabledPlan.length > 0) {
        await tx.insert(agentSkillAudit).values(
          disabledPlan.map((item) => ({
            institutionId: item.institutionId,
            resourceType: "skill",
            resourceId: item.skillId,
            action: "disable_automatic",
            actorId: null,
            summary: {
              trigger: "schedule",
              reasons: item.reasons,
              expiredSourceIds: item.expiredSourceIds,
            },
          }))
        );
      }

      return {
        expiredSources: expiredSources.length,
        disabledSkills: disabledPlan.length,
        checkedAt: now.toISOString(),
      };
    });
  });
}

export const config = { maxDuration: 60 };
