import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  agentSkills,
  agentSkillAudit,
  agentSkillVersions,
  institutions,
  knowledgeSourceExcerpts,
  knowledgeSources,
  skillSourceLinks,
} from "../../db/schema.js";
import {
  formatPublicAgentSkillContext,
  selectAuthorizedAgentSkillContext,
  type PublicAgentSkillCandidate,
} from "../../shared/public-agent-skill-policy.js";
import {
  formatKnowledgeExcerptContext,
  selectKnowledgeExcerpts,
} from "../../shared/knowledge-excerpts.js";
import {
  buildKnowledgeRecallTrace,
  decideKnowledgeSourceUsage,
  formatKnowledgeEvidenceCitations,
  type KnowledgeRecallSourceEntry,
} from "../../shared/knowledge-use-policy.js";
import type { KnowledgeActor } from "../../shared/skill-registry-policy.js";

const DEFAULT_INSTITUTION_SLUG = "blaise-cendrars-sevran";
const MAX_DATABASE_CANDIDATES = 30;

export type PublicKnowledgeVersionRef = {
  institutionId: string;
  versionId: string;
  allowedTools?: string[];
};

export type PublicKnowledgeSourceRef = {
  institutionId: string;
  sourceId: string;
  title: string;
  updatedAt: string;
};

export type LoadedPublicKnowledgeContext = {
  instructions: string;
  versions: PublicKnowledgeVersionRef[];
  sources: PublicKnowledgeSourceRef[];
  // LOT 4 du plan de connaissance OB1 (2026-09-05) : motif LOT 2 de chaque
  // source candidate a ce rappel (proposee, retenue ou ecartee).
  recalledSources: KnowledgeRecallSourceEntry[];
};

const EMPTY_CONTEXT: LoadedPublicKnowledgeContext = {
  instructions: "",
  versions: [],
  sources: [],
  recalledSources: [],
};

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
  actor?: KnowledgeActor | null;
  now?: Date;
}): Promise<LoadedPublicKnowledgeContext> {
  const now = input.now ?? new Date();
  const slug = process.env.SUPPORT_INSTITUTION_SLUG?.trim() || DEFAULT_INSTITUTION_SLUG;
  const [institution] = await db
    .select({ id: institutions.id })
    .from(institutions)
    .where(eq(institutions.slug, slug))
    .limit(1);
  if (!institution) return EMPTY_CONTEXT;
  const actor: KnowledgeActor = input.actor?.institutionId === institution.id
    ? input.actor
    : {
        identityLevel: "I0",
        role: "visitor",
        institutionId: institution.id,
        serviceCodes: [],
      };

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
  if (versionIds.length === 0) return EMPTY_CONTEXT;

  const sourceRows = await db
    .select({
      skillVersionId: skillSourceLinks.skillVersionId,
      required: skillSourceLinks.required,
      id: knowledgeSources.id,
      institutionId: knowledgeSources.institutionId,
      title: knowledgeSources.title,
      status: knowledgeSources.status,
      classification: knowledgeSources.classification,
      serviceCodes: knowledgeSources.serviceCodes,
      provenanceStatus: knowledgeSources.provenanceStatus,
      usePolicy: knowledgeSources.usePolicy,
      validFrom: knowledgeSources.validFrom,
      expiresAt: knowledgeSources.expiresAt,
      updatedAt: knowledgeSources.updatedAt,
      checksum: knowledgeSources.checksum,
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
          serviceCodes: source.serviceCodes,
          provenanceStatus: source.provenanceStatus as PublicAgentSkillCandidate["sources"][number]["provenanceStatus"],
          usePolicy: source.usePolicy as PublicAgentSkillCandidate["sources"][number]["usePolicy"],
          validFrom: source.validFrom.toISOString(),
          expiresAt: source.expiresAt?.toISOString() ?? null,
          required: source.required,
        })),
    };
  });

  const selected = selectAuthorizedAgentSkillContext({
    candidates,
    actor,
    query: input.query,
    now: now.toISOString(),
  });
  const selectedSources = new Map(
    selected.flatMap((skill) => skill.sources).map((source) => [source.id, source])
  );
  const selectedSourceIds = [...selectedSources.keys()];
  const excerptRows = selectedSourceIds.length === 0
    ? []
    : await db
        .select({
          id: knowledgeSourceExcerpts.id,
          sourceId: knowledgeSourceExcerpts.sourceId,
          ordinal: knowledgeSourceExcerpts.ordinal,
          text: knowledgeSourceExcerpts.excerptText,
        })
        .from(knowledgeSourceExcerpts)
        .where(
          and(
            eq(knowledgeSourceExcerpts.institutionId, institution.id),
            inArray(knowledgeSourceExcerpts.sourceId, selectedSourceIds)
          )
        )
        .orderBy(asc(knowledgeSourceExcerpts.sourceId), asc(knowledgeSourceExcerpts.ordinal))
        .limit(240);
  const selectedExcerpts = selectKnowledgeExcerpts({
    query: input.query,
    candidates: excerptRows.flatMap((excerpt) => {
      const source = selectedSources.get(excerpt.sourceId);
      return source
        ? [{
            ...excerpt,
            sourceTitle: source.title,
            sourceExpiresAt: source.expiresAt,
          }]
        : [];
    }),
  });
  const excerptContext = formatKnowledgeExcerptContext(selectedExcerpts);
  const skillContext = formatPublicAgentSkillContext(selected);

  // LOT 3 du plan de connaissance OB1 (2026-09-05) : une source
  // `can_use_as_evidence` doit atteindre le contexte comme element cite
  // (titre, date, statut), jamais comme consigne. Elle est evaluee ici
  // independamment de l'autorisation d'un skill (`selected`) : une source
  // requise devenue `evidence` fait echouer son skill (LOT 3,
  // `sourceIsAuthorizedAndCurrent`) et disparait donc du registre de
  // consignes, mais reste citee ici tant qu'elle est publiee, courante et
  // sure pour cet acteur.
  const nowIso = now.toISOString();
  const dedupedSourceRows = [
    ...new Map(sourceRows.map((source) => [source.id, source])).values(),
  ];
  const evidenceSourceRows = dedupedSourceRows.filter(
    (source) =>
      decideKnowledgeSourceUsage({
        source: {
          id: source.id,
          institutionId: source.institutionId,
          serviceCodes: source.serviceCodes,
          status: source.status as PublicAgentSkillCandidate["sources"][number]["status"],
          classification: source.classification as PublicAgentSkillCandidate["sources"][number]["classification"],
          provenanceStatus: source.provenanceStatus as PublicAgentSkillCandidate["sources"][number]["provenanceStatus"],
          usePolicy: source.usePolicy as PublicAgentSkillCandidate["sources"][number]["usePolicy"],
          validFrom: source.validFrom.toISOString(),
          expiresAt: source.expiresAt?.toISOString() ?? null,
        },
        actor,
        now: nowIso,
      }).decision === "evidence"
  );
  const evidenceContext = formatKnowledgeEvidenceCitations(
    evidenceSourceRows.map((source) => ({
      title: source.title,
      status: source.status as PublicAgentSkillCandidate["sources"][number]["status"],
      expiresAt: source.expiresAt?.toISOString() ?? null,
    }))
  );

  const instructions = [skillContext, excerptContext, evidenceContext]
    .filter((part) => part.length > 0)
    .join("\n\n");

  const citedSourceIds = new Set([
    ...selectedExcerpts.map((excerpt) => excerpt.sourceId),
    ...evidenceSourceRows.map((source) => source.id),
  ]);
  // LOT 4 du plan de connaissance OB1 (2026-09-05) : motif LOT 2 de chaque
  // source proposee a ce rappel (`dedupedSourceRows`), qu'elle finisse
  // retenue (`citedSourceIds`) ou ecartee. Pure ; sans base ni reseau au-dela
  // des lignes deja chargees ci-dessus.
  const recalledSources = buildKnowledgeRecallTrace({
    sources: dedupedSourceRows.map((source) => ({
      id: source.id,
      institutionId: source.institutionId,
      serviceCodes: source.serviceCodes,
      status: source.status as PublicAgentSkillCandidate["sources"][number]["status"],
      classification: source.classification as PublicAgentSkillCandidate["sources"][number]["classification"],
      provenanceStatus: source.provenanceStatus as PublicAgentSkillCandidate["sources"][number]["provenanceStatus"],
      usePolicy: source.usePolicy as PublicAgentSkillCandidate["sources"][number]["usePolicy"],
      validFrom: source.validFrom.toISOString(),
      expiresAt: source.expiresAt?.toISOString() ?? null,
      checksum: source.checksum,
    })),
    retainedSourceIds: citedSourceIds,
    actor,
    now: nowIso,
  });
  return {
    instructions,
    versions: selected.map((skill) => ({
      institutionId: skill.institutionId,
      versionId: skill.versionId,
      allowedTools: skill.allowedTools,
    })),
    sources: [...citedSourceIds].flatMap((sourceId) => {
      const source = sourceRows.find((candidate) => candidate.id === sourceId);
      return source
        ? [{
            institutionId: institution.id,
            sourceId,
            title: source.title,
            updatedAt: source.updatedAt.toISOString(),
          }]
        : [];
    }),
    recalledSources,
  };
}

export async function recordPublicKnowledgeUsage(input: {
  versions: PublicKnowledgeVersionRef[];
  // LOT 4 du plan de connaissance OB1 (2026-09-05) : sources proposees a ce
  // rappel, avec leur devenir (`outcome`), le motif LOT 2 (`reasonCode`), la
  // politique qui a autorise l'usage (`usePolicy`) et l'empreinte de contenu
  // de la source (`sourceVersion`). Remplace l'ancien parametre `sources`
  // (institutionId/sourceId seuls) : ce dernier ne portait aucun motif.
  recalledSources?: KnowledgeRecallSourceEntry[];
  sessionHash: string;
  model: string;
  turnCount: number;
}): Promise<void> {
  const versions = [...new Map(
    input.versions.map((version) => [
      `${version.institutionId}:${version.versionId}`,
      version,
    ])
  ).values()];
  const recalledSources = [...new Map(
    (input.recalledSources ?? []).map((source) => [
      `${source.institutionId}:${source.sourceId}`,
      source,
    ])
  ).values()];
  if (versions.length === 0 && recalledSources.length === 0) return;
  const summary = {
    channel: "support_assistant",
    sessionHash: input.sessionHash,
    model: input.model.slice(0, 80),
    turnCount: input.turnCount,
  };
  await db.insert(agentSkillAudit).values(
    [
      ...versions.map((version) => ({
        institutionId: version.institutionId,
        resourceType: "version",
        resourceId: version.versionId,
        action: "consult_public",
        actorId: null,
        summary,
      })),
      ...recalledSources.map((source) => ({
        institutionId: source.institutionId,
        resourceType: "source",
        resourceId: source.sourceId,
        action: "consult_public",
        actorId: null,
        summary: {
          ...summary,
          outcome: source.outcome,
          reasonCode: source.reasonCode,
          usePolicy: source.usePolicy,
          sourceVersion: source.sourceVersion,
        },
      })),
    ]
  );
}
