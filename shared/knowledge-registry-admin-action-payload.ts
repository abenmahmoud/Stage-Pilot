const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;
const TEST_CASE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type KnowledgeRegistryCreateResource = "source" | "skill" | "version";
export type KnowledgeRegistrySourceAction = "publish" | "revoke";
export type KnowledgeRegistryVersionAction = "submit_review" | "publish" | "rollback" | "retire";
export type KnowledgeRegistryEvaluationKind = "positive" | "ambiguous" | "forbidden";
export type KnowledgeRegistryEvaluationResult = "pass" | "fail" | "needs_review";

export type KnowledgeRegistryCreationPayload =
  | { resource: "source"; sourceId: string; status: "draft" }
  | { resource: "skill"; skillId: string; versionId: string; status: "draft" }
  | { resource: "version"; skillId: string; versionId: string; status: "draft" };

export type KnowledgeRegistryVersionUpdatePayload = {
  resource: "version";
  action: "update";
  skillId: string;
  versionId: string;
  status: "draft";
};

export type KnowledgeRegistrySourceActionPayload = {
  resource: "source";
  sourceId: string;
  action: KnowledgeRegistrySourceAction;
  status: "published" | "revoked";
  disabledSkillCount: number;
};

export type KnowledgeRegistryVersionActionPayload = {
  resource: "version";
  skillId: string;
  versionId: string;
  action: KnowledgeRegistryVersionAction;
  status: "review" | "published" | "retired";
  active: boolean;
};

export type KnowledgeRegistryEvaluationMutationPayload = {
  resource: "evaluation";
  versionId: string;
  testCaseKey: string;
  kind: KnowledgeRegistryEvaluationKind;
  result: KnowledgeRegistryEvaluationResult;
  runAt: string;
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

function uuid(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

function timestamp(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_PATTERN.test(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value ? value : null;
}

export function parseKnowledgeRegistryCreationPayload(
  value: unknown,
  expected: { resource: "source" } | { resource: "skill" } | { resource: "version"; skillId: string }
): KnowledgeRegistryCreationPayload | null {
  if (expected.resource === "source") {
    const row = exactRecord(value, ["resource", "sourceId", "status"]);
    const sourceId = row ? uuid(row.sourceId) : null;
    return row && row.resource === "source" && sourceId && row.status === "draft"
      ? { resource: "source", sourceId, status: "draft" }
      : null;
  }
  const row = exactRecord(value, ["resource", "skillId", "versionId", "status"]);
  const skillId = row ? uuid(row.skillId) : null;
  const versionId = row ? uuid(row.versionId) : null;
  if (
    !row
    || row.resource !== expected.resource
    || !skillId
    || !versionId
    || row.status !== "draft"
    || (expected.resource === "version" && skillId !== expected.skillId)
  ) return null;
  return { resource: expected.resource, skillId, versionId, status: "draft" };
}

export function projectKnowledgeRegistryCreationPayload(input: {
  resource: KnowledgeRegistryCreateResource;
  source?: unknown;
  skill?: unknown;
  version?: unknown;
}): KnowledgeRegistryCreationPayload {
  const source = record(input.source);
  const skill = record(input.skill);
  const version = record(input.version);
  const payload = input.resource === "source"
    ? { resource: "source", sourceId: source?.id, status: source?.status }
    : { resource: input.resource, skillId: skill?.id, versionId: version?.id, status: version?.status };
  const parsed = parseKnowledgeRegistryCreationPayload(
    payload,
    input.resource === "version"
      ? { resource: "version", skillId: typeof skill?.id === "string" ? skill.id : "" }
      : { resource: input.resource }
  );
  if (!parsed) throw new Error("Invalid knowledge registry creation projection");
  return parsed;
}

export function parseKnowledgeRegistryVersionUpdatePayload(
  value: unknown,
  expected: { skillId: string; versionId: string }
): KnowledgeRegistryVersionUpdatePayload | null {
  const row = exactRecord(value, ["resource", "action", "skillId", "versionId", "status"]);
  return row
    && row.resource === "version"
    && row.action === "update"
    && row.skillId === expected.skillId
    && row.versionId === expected.versionId
    && uuid(row.skillId)
    && uuid(row.versionId)
    && row.status === "draft"
    ? {
      resource: "version",
      action: "update",
      skillId: row.skillId,
      versionId: row.versionId,
      status: "draft",
    }
    : null;
}

export function projectKnowledgeRegistryVersionUpdatePayload(
  skill: unknown,
  version: unknown
): KnowledgeRegistryVersionUpdatePayload {
  const skillRow = record(skill);
  const versionRow = record(version);
  const parsed = parseKnowledgeRegistryVersionUpdatePayload({
    resource: "version",
    action: "update",
    skillId: skillRow?.id,
    versionId: versionRow?.id,
    status: versionRow?.status,
  }, {
    skillId: typeof skillRow?.id === "string" ? skillRow.id : "",
    versionId: typeof versionRow?.id === "string" ? versionRow.id : "",
  });
  if (!parsed) throw new Error("Invalid knowledge registry version update projection");
  return parsed;
}

export function parseKnowledgeRegistrySourceActionPayload(
  value: unknown,
  expected: { sourceId: string; action: KnowledgeRegistrySourceAction }
): KnowledgeRegistrySourceActionPayload | null {
  const row = exactRecord(value, ["resource", "sourceId", "action", "status", "disabledSkillCount"]);
  const expectedStatus = expected.action === "publish" ? "published" : "revoked";
  return row
    && row.resource === "source"
    && row.sourceId === expected.sourceId
    && uuid(row.sourceId)
    && row.action === expected.action
    && row.status === expectedStatus
    && Number.isInteger(row.disabledSkillCount)
    && Number(row.disabledSkillCount) >= 0
    && Number(row.disabledSkillCount) <= 1_000_000
    && (expected.action === "revoke" || row.disabledSkillCount === 0)
    ? {
      resource: "source",
      sourceId: row.sourceId,
      action: expected.action,
      status: expectedStatus,
      disabledSkillCount: Number(row.disabledSkillCount),
    }
    : null;
}

export function projectKnowledgeRegistrySourceActionPayload(input: {
  source: unknown;
  action: KnowledgeRegistrySourceAction;
  disabledSkillCount: number;
}): KnowledgeRegistrySourceActionPayload {
  const source = record(input.source);
  const parsed = parseKnowledgeRegistrySourceActionPayload({
    resource: "source",
    sourceId: source?.id,
    action: input.action,
    status: source?.status,
    disabledSkillCount: input.disabledSkillCount,
  }, {
    sourceId: typeof source?.id === "string" ? source.id : "",
    action: input.action,
  });
  if (!parsed) throw new Error("Invalid knowledge registry source action projection");
  return parsed;
}

export function parseKnowledgeRegistryVersionActionPayload(
  value: unknown,
  expected: { versionId: string; action: KnowledgeRegistryVersionAction }
): KnowledgeRegistryVersionActionPayload | null {
  const row = exactRecord(value, ["resource", "skillId", "versionId", "action", "status", "active"]);
  const matrix = {
    submit_review: { status: "review", active: false },
    publish: { status: "published", active: true },
    rollback: { status: "published", active: true },
    retire: { status: "retired", active: false },
  } as const;
  const expectedState = matrix[expected.action];
  const skillId = row ? uuid(row.skillId) : null;
  return row
    && row.resource === "version"
    && skillId
    && row.versionId === expected.versionId
    && uuid(row.versionId)
    && row.action === expected.action
    && row.status === expectedState.status
    && row.active === expectedState.active
    ? {
      resource: "version",
      skillId,
      versionId: row.versionId,
      action: expected.action,
      status: expectedState.status,
      active: expectedState.active,
    }
    : null;
}

export function projectKnowledgeRegistryVersionActionPayload(input: {
  skill: unknown;
  version: unknown;
  action: KnowledgeRegistryVersionAction;
}): KnowledgeRegistryVersionActionPayload {
  const skill = record(input.skill);
  const version = record(input.version);
  const versionId = typeof version?.id === "string" ? version.id : "";
  const parsed = parseKnowledgeRegistryVersionActionPayload({
    resource: "version",
    skillId: skill?.id,
    versionId,
    action: input.action,
    status: version?.status,
    active: skill?.enabled === true && skill?.activeVersionId === versionId,
  }, { versionId, action: input.action });
  if (!parsed) throw new Error("Invalid knowledge registry version action projection");
  return parsed;
}

export function parseKnowledgeRegistryEvaluationMutationPayload(
  value: unknown,
  expected: {
    versionId: string;
    testCaseKey: string;
    kind: KnowledgeRegistryEvaluationKind;
    result: KnowledgeRegistryEvaluationResult;
  }
): KnowledgeRegistryEvaluationMutationPayload | null {
  const row = exactRecord(value, ["resource", "versionId", "testCaseKey", "kind", "result", "runAt"]);
  const runAt = row ? timestamp(row.runAt) : null;
  return row
    && row.resource === "evaluation"
    && row.versionId === expected.versionId
    && uuid(row.versionId)
    && row.testCaseKey === expected.testCaseKey
    && TEST_CASE_PATTERN.test(expected.testCaseKey)
    && expected.testCaseKey.length <= 100
    && row.kind === expected.kind
    && row.result === expected.result
    && runAt
    ? {
      resource: "evaluation",
      versionId: row.versionId,
      testCaseKey: expected.testCaseKey,
      kind: expected.kind,
      result: expected.result,
      runAt,
    }
    : null;
}

export function projectKnowledgeRegistryEvaluationMutationPayload(
  evaluation: unknown
): KnowledgeRegistryEvaluationMutationPayload {
  const row = record(evaluation);
  const expected = {
    versionId: typeof row?.skillVersionId === "string" ? row.skillVersionId : "",
    testCaseKey: typeof row?.testCaseKey === "string" ? row.testCaseKey : "",
    kind: row?.kind as KnowledgeRegistryEvaluationKind,
    result: row?.result as KnowledgeRegistryEvaluationResult,
  };
  const parsed = parseKnowledgeRegistryEvaluationMutationPayload({
    resource: "evaluation",
    versionId: row?.skillVersionId,
    testCaseKey: row?.testCaseKey,
    kind: row?.kind,
    result: row?.result,
    runAt: row?.runAt instanceof Date ? row.runAt.toISOString() : row?.runAt,
  }, expected);
  if (!parsed) throw new Error("Invalid knowledge registry evaluation projection");
  return parsed;
}
