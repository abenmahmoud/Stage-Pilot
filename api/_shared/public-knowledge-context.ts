import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  agentSkills,
  agentSkillVersions,
  institutions,
  knowledgeSources,
  skillSourceLinks,
} from "../../db/schema.js";
import {
  formatPublicAgentSkillContext,
  selectPublicAgentSkillContext,
  type PublicAgentSkillCandidate,
} from "../../shared/public-agent-skill-policy.js";

const DEFAULT_INSTITUTION_SLUG = "blaise-cendrars-sevran";
const MAX_DATABASE_CANDIDATES = 30;

function definitionFields(value: unknown): { instructions: string; allowedTools: string[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { instructions: "", allowedTools: [] };
  }
  const definition = value as Record<string, unknown>;
  return {
    instructions: typeof definition.instructions === "string" ? definition.instructions : "",
    allowedTools: Array.isArray(definition.allowedTools)
      ? definition.allowedTools.filter((tool): tool is string => typeof tool === "string")
      : [],
  };
}

export async function loadPublicKnowledgeContext(input: {
  query: string;
  now?: Date;
}): Promise<string> {
  const now = input.now ?? new Date();
  const slug = process.env.SUPPORT_INSTITUTION_SLUG?.trim() || DEFAULT_INSTITUTION_SLUG;
  const [institution] = await db
    .select({ id: institutions.id })
    .from(institutions)
    .where(eq(institutions.slug, slug))
    .limit(1);
  if (!institution) return "";

  const rows = await db
    .select({
      institutionId: agentSkills.institutionId,
      skillKey: agentSkills.skillKey,
      name: agentSkills.name,
      domain: agentSkills.domain,
      enabled: agentSkills.enabled,
      activeVersionId: agentSkills.activeVersionId,
      versionId: agentSkillVersions.id,
      version: agentSkillVersions.version,
      versionStatus: agentSkillVersions.status,
      dataClassification: agentSkillVersions.dataClassification,
      publishedAt: agentSkillVersions.publishedAt,
      reviewDueAt: agentSkillVersions.reviewDueAt,
      definition: agentSkillVersions.definition,
    })
    .from(agentSkills)
    .innerJoin(agentSkillVersions, eq(agentSkills.activeVersionId, agentSkillVersions.id))
    .where(and(eq(agentSkills.institutionId, institution.id), eq(agentSkills.enabled, true)))
    .orderBy(asc(agentSkills.skillKey))
    .limit(MAX_DATABASE_CANDIDATES);
  const versionIds = rows.map((row) => row.versionId);
  if (versionIds.length === 0) return "";

  const sourceRows = await db
    .select({
      skillVersionId: skillSourceLinks.skillVersionId,
      required: skillSourceLinks.required,
      id: knowledgeSources.id,
      institutionId: knowledgeSources.institutionId,
      title: knowledgeSources.title,
      status: knowledgeSources.status,
      classification: knowledgeSources.classification,
      validFrom: knowledgeSources.validFrom,
      expiresAt: knowledgeSources.expiresAt,
    })
    .from(skillSourceLinks)
    .innerJoin(knowledgeSources, eq(skillSourceLinks.sourceId, knowledgeSources.id))
    .where(
      and(
        eq(skillSourceLinks.institutionId, institution.id),
        inArray(skillSourceLinks.skillVersionId, versionIds)
      )
    );

  const candidates: PublicAgentSkillCandidate[] = rows.map((row) => {
    const definition = definitionFields(row.definition);
    return {
      institutionId: row.institutionId,
      skillKey: row.skillKey,
      name: row.name,
      domain: row.domain,
      enabled: row.enabled,
      activeVersionId: row.activeVersionId,
      versionId: row.versionId,
      version: row.version,
      versionStatus: row.versionStatus as PublicAgentSkillCandidate["versionStatus"],
      dataClassification: row.dataClassification as PublicAgentSkillCandidate["dataClassification"],
      publishedAt: row.publishedAt?.toISOString() ?? null,
      reviewDueAt: row.reviewDueAt.toISOString(),
      instructions: definition.instructions,
      allowedTools: definition.allowedTools,
      sources: sourceRows
        .filter((source) => source.skillVersionId === row.versionId)
        .map((source) => ({
          id: source.id,
          institutionId: source.institutionId,
          title: source.title,
          status: source.status as PublicAgentSkillCandidate["sources"][number]["status"],
          classification: source.classification as PublicAgentSkillCandidate["sources"][number]["classification"],
          validFrom: source.validFrom.toISOString(),
          expiresAt: source.expiresAt?.toISOString() ?? null,
          required: source.required,
        })),
    };
  });

  return formatPublicAgentSkillContext(
    selectPublicAgentSkillContext({
      candidates,
      institutionId: institution.id,
      query: input.query,
      now: now.toISOString(),
    })
  );
}
