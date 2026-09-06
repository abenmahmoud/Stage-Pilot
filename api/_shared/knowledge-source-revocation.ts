// Extrait de `api/knowledge/admin/sources/[id]/action.ts` (revoke) pour etre
// reutilise par LOT 5 du plan de connaissance OB1 (2026-09-05) : une
// correction d'actualite deja publiee doit pouvoir declencher exactement la
// meme revocation qu'une action humaine explicite sur le registre, sans
// dupliquer la logique de desactivation des competences dependantes.

import { and, eq } from "drizzle-orm";
import type { db } from "../../db/index.js";
import {
  agentSkillAudit,
  agentSkills,
  agentSkillVersions,
  knowledgeSources,
  skillSourceLinks,
} from "../../db/schema.js";

type Transaction = Parameters<typeof db.transaction> extends [(tx: infer Tx) => unknown, ...unknown[]]
  ? Tx
  : never;

export async function revokeKnowledgeSourceAndDisableSkills(
  tx: Transaction,
  params: { institutionId: string; sourceId: string; actorId: string | null; auditSummary: Record<string, unknown> }
): Promise<{ disabledSkillCount: number } | null> {
  const [revoked] = await tx
    .update(knowledgeSources)
    .set({ status: "revoked" })
    .where(
      and(
        eq(knowledgeSources.id, params.sourceId),
        eq(knowledgeSources.institutionId, params.institutionId)
      )
    )
    .returning({ id: knowledgeSources.id, status: knowledgeSources.status });
  if (!revoked) return null;

  const affected = await tx
    .select({ skillId: agentSkills.id })
    .from(skillSourceLinks)
    .innerJoin(
      agentSkillVersions,
      eq(skillSourceLinks.skillVersionId, agentSkillVersions.id)
    )
    .innerJoin(agentSkills, eq(agentSkills.activeVersionId, agentSkillVersions.id))
    .where(
      and(
        eq(skillSourceLinks.institutionId, params.institutionId),
        eq(skillSourceLinks.sourceId, params.sourceId)
      )
    );
  for (const { skillId } of affected) {
    await tx
      .update(agentSkills)
      .set({ enabled: false, activeVersionId: null })
      .where(eq(agentSkills.id, skillId));
  }

  await tx.insert(agentSkillAudit).values({
    institutionId: params.institutionId,
    resourceType: "source",
    resourceId: params.sourceId,
    action: "revoke",
    actorId: params.actorId,
    summary: { ...params.auditSummary, disabledSkillCount: affected.length },
  });

  return { disabledSkillCount: affected.length };
}
