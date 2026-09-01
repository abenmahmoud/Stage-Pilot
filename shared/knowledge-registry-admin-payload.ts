import type { KnowledgeClassification } from "./skill-registry-policy.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;
const CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const SINGLE_LINE_CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;
const CLASSIFICATIONS = ["public", "internal", "personal", "sensitive"] as const;
const SOURCE_STATUSES = ["draft", "published", "expired", "revoked"] as const;
const VERSION_STATUSES = ["draft", "review", "published", "retired"] as const;
const EVALUATION_KINDS = ["positive", "ambiguous", "forbidden"] as const;
const EVALUATION_RESULTS = ["pass", "fail", "needs_review"] as const;

export const KNOWLEDGE_REGISTRY_PAYLOAD_LIMITS = Object.freeze({
  sources: 500,
  skills: 300,
  versions: 1_000,
  links: 5_000,
  evaluations: 5_000,
  audit: 100,
});

export type RegistrySourceStatus = (typeof SOURCE_STATUSES)[number];
export type RegistryVersionStatus = (typeof VERSION_STATUSES)[number];
export type RegistrySourcePayload = {
  id: string;
  title: string;
  uri: string;
  classification: KnowledgeClassification;
  expiresAt: string | null;
  status: RegistrySourceStatus;
  updatedAt: string;
};
export type RegistrySkillPayload = {
  id: string;
  skillKey: string;
  name: string;
  domain: string;
  activeVersionId: string | null;
  enabled: boolean;
};
export type RegistryVersionPayload = {
  id: string;
  skillId: string;
  version: string;
  status: RegistryVersionStatus;
  definition: { instructions: string; allowedTools: string[] };
  dataClassification: KnowledgeClassification;
  reviewDueAt: string;
  createdAt: string;
};
export type RegistrySourceLinkPayload = { skillVersionId: string; sourceId: string };
export type RegistryEvaluationPayload = {
  skillVersionId: string;
  testCaseKey: string;
  kind: (typeof EVALUATION_KINDS)[number];
  result: (typeof EVALUATION_RESULTS)[number];
  evidence: {
    runner: "manual" | "deterministic";
    fixture: "fictitious";
    scenario: string;
    expected: string;
    observed: string;
  };
  runAt: string;
};
export type RegistryAuditPayload = {
  id: string;
  resourceType: string;
  action: string;
  createdAt: string;
};
export type KnowledgeRegistryPayload = {
  sources: RegistrySourcePayload[];
  skills: RegistrySkillPayload[];
  versions: RegistryVersionPayload[];
  links: RegistrySourceLinkPayload[];
  evaluations: RegistryEvaluationPayload[];
  audit: RegistryAuditPayload[];
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  const candidate = record(value);
  if (!candidate) return null;
  const actual = Object.keys(candidate).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index])
    ? candidate
    : null;
}

function text(value: unknown, minimum: number, maximum: number): string | null {
  return typeof value === "string"
    && value.length >= minimum
    && value.length <= maximum
    && !CONTROL_PATTERN.test(value)
    ? value
    : null;
}

function timestamp(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_PATTERN.test(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value ? value : null;
}

function nullableTimestamp(value: unknown): string | null | undefined {
  if (value === null) return null;
  return timestamp(value) ?? undefined;
}

function isoValue(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

function sourcePayload(value: unknown): RegistrySourcePayload | null {
  const row = exactRecord(value, ["id", "title", "uri", "classification", "expiresAt", "status", "updatedAt"]);
  const title = row ? text(row.title, 2, 180) : null;
  const uri = row ? text(row.uri, 3, 1_000) : null;
  const expiresAt = row ? nullableTimestamp(row.expiresAt) : undefined;
  const updatedAt = row ? timestamp(row.updatedAt) : null;
  if (
    !row
    || typeof row.id !== "string"
    || !UUID_PATTERN.test(row.id)
    || !title
    || !uri
    || SINGLE_LINE_CONTROL_PATTERN.test(uri)
    || !CLASSIFICATIONS.includes(row.classification as KnowledgeClassification)
    || expiresAt === undefined
    || !SOURCE_STATUSES.includes(row.status as RegistrySourceStatus)
    || !updatedAt
  ) return null;
  return {
    id: row.id,
    title,
    uri,
    classification: row.classification as KnowledgeClassification,
    expiresAt,
    status: row.status as RegistrySourceStatus,
    updatedAt,
  };
}

function skillPayload(value: unknown): RegistrySkillPayload | null {
  const row = exactRecord(value, ["id", "skillKey", "name", "domain", "activeVersionId", "enabled"]);
  const name = row ? text(row.name, 2, 160) : null;
  const domain = row ? text(row.domain, 2, 100) : null;
  if (
    !row
    || typeof row.id !== "string"
    || !UUID_PATTERN.test(row.id)
    || typeof row.skillKey !== "string"
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.skillKey)
    || row.skillKey.length > 100
    || !name
    || !domain
    || !(row.activeVersionId === null || (typeof row.activeVersionId === "string" && UUID_PATTERN.test(row.activeVersionId)))
    || typeof row.enabled !== "boolean"
    || (row.enabled !== (row.activeVersionId !== null))
  ) return null;
  return {
    id: row.id,
    skillKey: row.skillKey,
    name,
    domain,
    activeVersionId: row.activeVersionId as string | null,
    enabled: row.enabled,
  };
}

function allowedTools(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 20) return null;
  const tools: string[] = [];
  for (const tool of value) {
    if (
      typeof tool !== "string"
      || tool.length > 120
      || !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(tool)
      || tools.includes(tool)
    ) return null;
    tools.push(tool);
  }
  return tools;
}

function versionPayload(value: unknown): RegistryVersionPayload | null {
  const row = exactRecord(value, ["id", "skillId", "version", "status", "definition", "dataClassification", "reviewDueAt", "createdAt"]);
  const definition = row ? exactRecord(row.definition, ["instructions", "allowedTools"]) : null;
  const instructions = definition ? text(definition.instructions, 20, 12_000) : null;
  const tools = definition ? allowedTools(definition.allowedTools) : null;
  const reviewDueAt = row ? timestamp(row.reviewDueAt) : null;
  const createdAt = row ? timestamp(row.createdAt) : null;
  if (
    !row
    || typeof row.id !== "string"
    || !UUID_PATTERN.test(row.id)
    || typeof row.skillId !== "string"
    || !UUID_PATTERN.test(row.skillId)
    || typeof row.version !== "string"
    || !/^\d+\.\d+\.\d+$/.test(row.version)
    || row.version.length > 30
    || !VERSION_STATUSES.includes(row.status as RegistryVersionStatus)
    || !instructions
    || !tools
    || !CLASSIFICATIONS.includes(row.dataClassification as KnowledgeClassification)
    || !reviewDueAt
    || !createdAt
  ) return null;
  return {
    id: row.id,
    skillId: row.skillId,
    version: row.version,
    status: row.status as RegistryVersionStatus,
    definition: { instructions, allowedTools: tools },
    dataClassification: row.dataClassification as KnowledgeClassification,
    reviewDueAt,
    createdAt,
  };
}

function linkPayload(value: unknown): RegistrySourceLinkPayload | null {
  const row = exactRecord(value, ["skillVersionId", "sourceId"]);
  return row
    && typeof row.skillVersionId === "string"
    && UUID_PATTERN.test(row.skillVersionId)
    && typeof row.sourceId === "string"
    && UUID_PATTERN.test(row.sourceId)
    ? { skillVersionId: row.skillVersionId, sourceId: row.sourceId }
    : null;
}

function evaluationPayload(value: unknown): RegistryEvaluationPayload | null {
  const row = exactRecord(value, ["skillVersionId", "testCaseKey", "kind", "result", "evidence", "runAt"]);
  const evidence = row ? exactRecord(row.evidence, ["runner", "fixture", "scenario", "expected", "observed"]) : null;
  const scenario = evidence ? text(evidence.scenario, 10, 1_500) : null;
  const expected = evidence ? text(evidence.expected, 10, 1_500) : null;
  const observed = evidence ? text(evidence.observed, 10, 2_500) : null;
  const runAt = row ? timestamp(row.runAt) : null;
  if (
    !row
    || typeof row.skillVersionId !== "string"
    || !UUID_PATTERN.test(row.skillVersionId)
    || typeof row.testCaseKey !== "string"
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.testCaseKey)
    || row.testCaseKey.length > 100
    || !EVALUATION_KINDS.includes(row.kind as RegistryEvaluationPayload["kind"])
    || !EVALUATION_RESULTS.includes(row.result as RegistryEvaluationPayload["result"])
    || !evidence
    || (evidence.runner !== "manual" && evidence.runner !== "deterministic")
    || evidence.fixture !== "fictitious"
    || !scenario
    || !expected
    || !observed
    || !runAt
  ) return null;
  return {
    skillVersionId: row.skillVersionId,
    testCaseKey: row.testCaseKey,
    kind: row.kind as RegistryEvaluationPayload["kind"],
    result: row.result as RegistryEvaluationPayload["result"],
    evidence: {
      runner: evidence.runner,
      fixture: "fictitious",
      scenario,
      expected,
      observed,
    },
    runAt,
  };
}

function auditPayload(value: unknown): RegistryAuditPayload | null {
  const row = exactRecord(value, ["id", "resourceType", "action", "createdAt"]);
  const resourceType = row ? text(row.resourceType, 1, 80) : null;
  const action = row ? text(row.action, 1, 80) : null;
  const createdAt = row ? timestamp(row.createdAt) : null;
  return row
    && typeof row.id === "string"
    && UUID_PATTERN.test(row.id)
    && resourceType
    && action
    && createdAt
    ? { id: row.id, resourceType, action, createdAt }
    : null;
}

export function projectRegistrySource(value: unknown): RegistrySourcePayload {
  const row = record(value);
  const projected = row ? sourcePayload({
    id: row.id,
    title: row.title,
    uri: row.uri,
    classification: row.classification,
    expiresAt: isoValue(row.expiresAt),
    status: row.status,
    updatedAt: isoValue(row.updatedAt),
  }) : null;
  if (!projected) throw new Error("Invalid registry source projection");
  return projected;
}

export function projectRegistrySkill(value: unknown): RegistrySkillPayload {
  const row = record(value);
  const projected = row ? skillPayload({
    id: row.id,
    skillKey: row.skillKey,
    name: row.name,
    domain: row.domain,
    activeVersionId: row.activeVersionId,
    enabled: row.enabled,
  }) : null;
  if (!projected) throw new Error("Invalid registry skill projection");
  return projected;
}

export function projectRegistryVersion(value: unknown): RegistryVersionPayload {
  const row = record(value);
  const definition = record(row?.definition);
  const projected = row ? versionPayload({
    id: row.id,
    skillId: row.skillId,
    version: row.version,
    status: row.status,
    definition: {
      instructions: definition?.instructions,
      allowedTools: definition?.allowedTools,
    },
    dataClassification: row.dataClassification,
    reviewDueAt: isoValue(row.reviewDueAt),
    createdAt: isoValue(row.createdAt),
  }) : null;
  if (!projected) throw new Error("Invalid registry version projection");
  return projected;
}

export function projectRegistryLink(value: unknown): RegistrySourceLinkPayload {
  const row = record(value);
  const projected = row ? linkPayload({ skillVersionId: row.skillVersionId, sourceId: row.sourceId }) : null;
  if (!projected) throw new Error("Invalid registry link projection");
  return projected;
}

export function projectRegistryEvaluation(value: unknown): RegistryEvaluationPayload {
  const row = record(value);
  const projected = row ? evaluationPayload({
    skillVersionId: row.skillVersionId,
    testCaseKey: row.testCaseKey,
    kind: row.kind,
    result: row.result,
    evidence: row.evidence,
    runAt: isoValue(row.runAt),
  }) : null;
  if (!projected) throw new Error("Invalid registry evaluation projection");
  return projected;
}

export function projectRegistryAudit(value: unknown): RegistryAuditPayload {
  const row = record(value);
  const projected = row ? auditPayload({
    id: row.id,
    resourceType: row.resourceType,
    action: row.action,
    createdAt: isoValue(row.createdAt),
  }) : null;
  if (!projected) throw new Error("Invalid registry audit projection");
  return projected;
}

export function projectKnowledgeRegistryPayload(value: {
  sources: unknown[];
  skills: unknown[];
  versions: unknown[];
  links: unknown[];
  evaluations: unknown[];
  audit: unknown[];
}): KnowledgeRegistryPayload {
  for (const key of Object.keys(KNOWLEDGE_REGISTRY_PAYLOAD_LIMITS) as Array<keyof typeof KNOWLEDGE_REGISTRY_PAYLOAD_LIMITS>) {
    if (value[key].length > KNOWLEDGE_REGISTRY_PAYLOAD_LIMITS[key]) {
      throw new Error(`Registry ${key} projection exceeds its payload limit`);
    }
  }
  return {
    sources: value.sources.map(projectRegistrySource),
    skills: value.skills.map(projectRegistrySkill),
    versions: value.versions.map(projectRegistryVersion),
    links: value.links.map(projectRegistryLink),
    evaluations: value.evaluations.map(projectRegistryEvaluation),
    audit: value.audit.map(projectRegistryAudit),
  };
}

function parseList<T>(
  value: unknown,
  maximum: number,
  parse: (entry: unknown) => T | null,
  key: (entry: T) => string,
  order?: (entry: T) => string
): T[] | null {
  if (!Array.isArray(value) || value.length > maximum) return null;
  const keys = new Set<string>();
  const result: T[] = [];
  let previous = Number.POSITIVE_INFINITY;
  for (const item of value) {
    const parsed = parse(item);
    if (!parsed) return null;
    const itemKey = key(parsed);
    const time = order ? Date.parse(order(parsed)) : previous;
    if (keys.has(itemKey) || (order && time > previous)) return null;
    keys.add(itemKey);
    result.push(parsed);
    previous = time;
  }
  return result;
}

export function parseKnowledgeRegistryPayload(value: unknown): KnowledgeRegistryPayload | null {
  const root = exactRecord(value, ["sources", "skills", "versions", "links", "evaluations", "audit"]);
  if (!root) return null;
  const sources = parseList(root.sources, KNOWLEDGE_REGISTRY_PAYLOAD_LIMITS.sources, sourcePayload, (item) => item.id, (item) => item.updatedAt);
  const skills = parseList(root.skills, KNOWLEDGE_REGISTRY_PAYLOAD_LIMITS.skills, skillPayload, (item) => item.id);
  const versions = parseList(root.versions, KNOWLEDGE_REGISTRY_PAYLOAD_LIMITS.versions, versionPayload, (item) => item.id, (item) => item.createdAt);
  const links = parseList(root.links, KNOWLEDGE_REGISTRY_PAYLOAD_LIMITS.links, linkPayload, (item) => `${item.skillVersionId}:${item.sourceId}`);
  const evaluations = parseList(root.evaluations, KNOWLEDGE_REGISTRY_PAYLOAD_LIMITS.evaluations, evaluationPayload, (item) => `${item.skillVersionId}:${item.testCaseKey}`, (item) => item.runAt);
  const audit = parseList(root.audit, KNOWLEDGE_REGISTRY_PAYLOAD_LIMITS.audit, auditPayload, (item) => item.id, (item) => item.createdAt);
  if (!sources || !skills || !versions || !links || !evaluations || !audit) return null;
  const sourceIds = new Set(sources.map((item) => item.id));
  const skillById = new Map(skills.map((item) => [item.id, item]));
  const versionById = new Map(versions.map((item) => [item.id, item]));
  for (const version of versions) if (!skillById.has(version.skillId)) return null;
  for (const skill of skills) {
    if (skill.activeVersionId === null) continue;
    const version = versionById.get(skill.activeVersionId);
    if (!version || version.skillId !== skill.id || version.status !== "published") return null;
  }
  for (const link of links) {
    if (!versionById.has(link.skillVersionId) || !sourceIds.has(link.sourceId)) return null;
  }
  for (const evaluation of evaluations) if (!versionById.has(evaluation.skillVersionId)) return null;
  return { sources, skills, versions, links, evaluations, audit };
}
