import type { KnowledgeActor, KnowledgeActorLevel } from "./skill-registry-policy.js";

export type PublicAgentSkillSource = {
  id: string;
  institutionId: string;
  title: string;
  status: "draft" | "published" | "expired" | "revoked";
  classification: "public" | "internal" | "personal" | "sensitive";
  serviceCodes: string[];
  validFrom: string;
  expiresAt: string | null;
  required: boolean;
};

export type PublicAgentSkillCandidate = {
  institutionId: string;
  skillKey: string;
  name: string;
  domain: string;
  enabled: boolean;
  activeVersionId: string | null;
  versionId: string;
  version: string;
  versionStatus: "draft" | "review" | "published" | "retired";
  dataClassification: "public" | "internal" | "personal" | "sensitive";
  publishedAt: string | null;
  reviewDueAt: string;
  instructions: string;
  allowedTools: string[];
  sources: PublicAgentSkillSource[];
};

export type PublicAgentSkillContext = {
  institutionId: string;
  versionId: string;
  skillKey: string;
  name: string;
  domain: string;
  version: string;
  accessLevel: KnowledgeActorLevel;
  instructions: string;
  allowedTools: string[];
  sources: Array<{ id: string; title: string; expiresAt: string | null }>;
};

const MAX_SKILLS = 4;
const MAX_SKILL_INSTRUCTIONS = 3_000;
const MAX_TOTAL_INSTRUCTIONS = 6_000;
const STOP_WORDS = new Set([
  "avec", "avoir", "dans", "elle", "elles", "etre", "faire", "pour", "sans",
  "sont", "tout", "tous", "une", "vous", "votre", "mais", "comme", "plus",
  "quoi", "quel", "quelle", "besoin", "aide", "lycee",
]);

function timestamp(value: string | null): number {
  if (!value) return Number.NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return [...new Set(
    normalize(value)
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
  )];
}

const ACTOR_RANK: Record<KnowledgeActorLevel, number> = {
  visitor: 0,
  contact_verified: 1,
  school_identity: 2,
  agent: 3,
  service_manager: 4,
  admin: 5,
};

function classificationIsPromptSafe(
  classification: PublicAgentSkillCandidate["dataClassification"],
  actor: KnowledgeActor
): boolean {
  if (classification === "public") return true;
  if (classification !== "internal") return false;
  return ACTOR_RANK[actor.level] >= ACTOR_RANK.agent;
}

function sourceIsAuthorizedAndCurrent(
  source: PublicAgentSkillSource,
  actor: KnowledgeActor,
  now: number
): boolean {
  const validFrom = timestamp(source.validFrom);
  const expiresAt = source.expiresAt ? timestamp(source.expiresAt) : Number.POSITIVE_INFINITY;
  return (
    source.institutionId === actor.institutionId &&
    source.status === "published" &&
    classificationIsPromptSafe(source.classification, actor) &&
    Number.isFinite(validFrom) &&
    validFrom <= now &&
    expiresAt >= now &&
    (
      source.classification === "public" ||
      source.serviceCodes.length === 0 ||
      source.serviceCodes.some((service) => actor.serviceCodes.includes(service))
    )
  );
}

function skillIsAuthorizedAndCurrent(
  candidate: PublicAgentSkillCandidate,
  actor: KnowledgeActor,
  now: number
): boolean {
  const instructions = candidate.instructions.trim();
  const requiredSources = candidate.sources.filter((source) => source.required);
  return (
    candidate.institutionId === actor.institutionId &&
    candidate.enabled &&
    candidate.activeVersionId === candidate.versionId &&
    candidate.versionStatus === "published" &&
    classificationIsPromptSafe(candidate.dataClassification, actor) &&
    candidate.publishedAt !== null &&
    timestamp(candidate.publishedAt) <= now &&
    timestamp(candidate.reviewDueAt) > now &&
    instructions.length >= 20 &&
    instructions.length <= MAX_SKILL_INSTRUCTIONS &&
    requiredSources.length > 0 &&
    requiredSources.every((source) => sourceIsAuthorizedAndCurrent(source, actor, now))
  );
}

function relevance(candidate: PublicAgentSkillCandidate, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  const identity = new Set(tokens(`${candidate.skillKey} ${candidate.name} ${candidate.domain}`));
  const sourceTitles = new Set(tokens(candidate.sources.map((source) => source.title).join(" ")));
  const instructions = new Set(tokens(candidate.instructions));
  return queryTokens.reduce((score, token) => {
    if (identity.has(token)) return score + 5;
    if (sourceTitles.has(token)) return score + 3;
    if (instructions.has(token)) return score + 1;
    return score;
  }, 0);
}

export function selectPublicAgentSkillContext(input: {
  candidates: PublicAgentSkillCandidate[];
  institutionId: string;
  query: string;
  now: string;
}): PublicAgentSkillContext[] {
  return selectAuthorizedAgentSkillContext({
    candidates: input.candidates,
    actor: {
      level: "visitor",
      institutionId: input.institutionId,
      serviceCodes: [],
    },
    query: input.query,
    now: input.now,
  });
}

export function selectAuthorizedAgentSkillContext(input: {
  candidates: PublicAgentSkillCandidate[];
  actor: KnowledgeActor;
  query: string;
  now: string;
}): PublicAgentSkillContext[] {
  const now = timestamp(input.now);
  if (!Number.isFinite(now)) return [];
  const queryTokens = tokens(input.query);
  let usedCharacters = 0;
  const selected: PublicAgentSkillContext[] = [];

  const ranked = input.candidates
    .filter((candidate) => skillIsAuthorizedAndCurrent(candidate, input.actor, now))
    .map((candidate) => ({ candidate, score: relevance(candidate, queryTokens) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.candidate.skillKey.localeCompare(right.candidate.skillKey));

  for (const { candidate } of ranked) {
    const instructions = candidate.instructions.trim();
    if (selected.length >= MAX_SKILLS || usedCharacters + instructions.length > MAX_TOTAL_INSTRUCTIONS) {
      continue;
    }
    selected.push({
      institutionId: candidate.institutionId,
      versionId: candidate.versionId,
      skillKey: candidate.skillKey,
      name: candidate.name,
      domain: candidate.domain,
      version: candidate.version,
      accessLevel: input.actor.level,
      instructions,
      allowedTools: [...new Set(candidate.allowedTools)].sort(),
      sources: candidate.sources
        .filter((source) => source.required)
        .map((source) => ({
          id: source.id,
          title: source.title,
          expiresAt: source.expiresAt,
        })),
    });
    usedCharacters += instructions.length;
  }
  return selected;
}

export function formatPublicAgentSkillContext(skills: PublicAgentSkillContext[]): string {
  if (skills.length === 0) return "";
  const blocks = skills.map((skill, index) => {
    const sources = skill.sources
      .map((source) => `${source.title}${source.expiresAt ? ` (valide jusqu'au ${source.expiresAt})` : ""}`)
      .join(" ; ");
    const tools = skill.allowedTools.length > 0
      ? `Outils déclarés mais non exécutables dans cette conversation : ${skill.allowedTools.join(", ")}.`
      : "Aucun outil externe n'est autorisé pour cette compétence.";
    return `${index + 1}. ${skill.name} [${skill.skillKey}@${skill.version}]\nDomaine : ${skill.domain}\nNiveau d'accès vérifié : ${skill.accessLevel}\nSources autorisées et validées : ${sources}\n${tools}\nInstructions validées :\n${skill.instructions}`;
  });
  return `<registre_autorise_valide>\n${blocks.join("\n\n")}\n</registre_autorise_valide>`;
}
