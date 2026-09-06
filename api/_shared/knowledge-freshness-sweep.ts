// LOT 6 du plan de connaissance OB1 (2026-09-05). Balayage réel de
// péremption/fraîcheur du registre de connaissance, extrait de
// `api/cron/knowledge-expiry.ts` (comportement inchangé, voir
// docs/operations/night-logs/OB1-LOT6.md) pour être rejoué sans être
// réimplémenté à trois endroits distincts :
//   - le passage planifié (`api/cron/knowledge-expiry.ts`, gardé par
//     `shared/knowledge-freshness-schedule.ts`) ;
//   - une publication de source ou de version de compétence, qui déclenche
//     désormais un contrôle supplémentaire immédiat plutôt que d'attendre le
//     prochain créneau planifié (règle du plan, LOT 6, bullet 3).
// Bascule les sources publiées dont l'échéance est dépassée vers `expired`,
// puis désactive toute compétence dont une source requise vient d'expirer ou
// dont la revue est en retard (`shared/knowledge-expiry-policy.ts`, logique
// pure inchangée).
import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import type { db } from "../../db/index.js";
import {
  agentSkillAudit,
  agentSkills,
  agentSkillVersions,
  knowledgeSources,
  skillSourceLinks,
} from "../../db/schema.js";
import { buildKnowledgeExpiryPlan } from "../../shared/knowledge-expiry-policy.js";

type SweepTx = Parameters<typeof db.transaction> extends [(tx: infer Tx) => unknown, ...unknown[]]
  ? Tx
  : never;

export type KnowledgeFreshnessSweepTrigger =
  | "scheduled_nightly_expiry"
  | "scheduled_freshness_check"
  | "publication";

export type KnowledgeFreshnessSweepResult = {
  expiredSources: number;
  disabledSkills: number;
  checkedAt: string;
};

export async function runKnowledgeFreshnessSweep(
  tx: SweepTx,
  now: Date,
  trigger: KnowledgeFreshnessSweepTrigger
): Promise<KnowledgeFreshnessSweepResult> {
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
        summary: { trigger, expiredAt: now.toISOString() },
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
          trigger,
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
}
