export type KnowledgeClassification =
  | "public"
  | "internal"
  | "personal"
  | "sensitive";

export type KnowledgeActorLevel =
  | "visitor"
  | "contact_verified"
  | "school_identity"
  | "agent"
  | "service_manager"
  | "admin";

export type KnowledgeActor = {
  level: KnowledgeActorLevel;
  institutionId: string;
  serviceCodes: string[];
};

export type KnowledgeSource = {
  id: string;
  institutionId: string;
  serviceCodes: string[];
  status: "draft" | "published" | "expired" | "revoked";
  classification: KnowledgeClassification;
  ownerUserId: string;
  validFrom: string;
  expiresAt: string | null;
  checksum: string;
};

export type SkillEvaluation = {
  testCaseKey: string;
  kind: "positive" | "ambiguous" | "forbidden";
  result: "pass" | "fail" | "needs_review";
};

export type SkillVersion = {
  id: string;
  institutionId: string;
  skillKey: string;
  version: string;
  status: "draft" | "review" | "published" | "retired";
  ownerUserId: string;
  createdBy: string;
  approvedBy: string | null;
  dataClassification: KnowledgeClassification;
  sourceIds: string[];
  allowedTools: string[];
  evaluations: SkillEvaluation[];
  publishedAt: string | null;
  reviewDueAt: string;
};

export type SkillPublicationError =
  | "candidate_not_in_review"
  | "invalid_skill_key"
  | "invalid_version"
  | "owner_required"
  | "review_date_invalid"
  | "independent_approval_required"
  | "source_required"
  | "source_missing"
  | "source_unavailable"
  | "source_not_current"
  | "source_scope_mismatch"
  | "source_metadata_incomplete"
  | "allowed_tool_invalid"
  | "test_coverage_incomplete"
  | "test_failed";

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isPlaceholder(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  return (
    normalized.length === 0 ||
    normalized.includes("A_NOMMER") ||
    normalized.includes("A_CONFIGURER") ||
    normalized.includes("TODO")
  );
}

function sourceIsCurrent(source: KnowledgeSource, now: number): boolean {
  const validFrom = timestamp(source.validFrom);
  const expiresAt = source.expiresAt
    ? timestamp(source.expiresAt)
    : Number.POSITIVE_INFINITY;
  return (
    source.status === "published" &&
    Number.isFinite(validFrom) &&
    validFrom <= now &&
    expiresAt >= now
  );
}

export function validateSkillForPublication(input: {
  candidate: SkillVersion;
  sources: KnowledgeSource[];
  now: string;
}): { ok: boolean; errors: SkillPublicationError[] } {
  const errors = new Set<SkillPublicationError>();
  const now = timestamp(input.now);
  const candidate = input.candidate;

  if (candidate.status !== "review") errors.add("candidate_not_in_review");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.skillKey)) {
    errors.add("invalid_skill_key");
  }
  if (!/^\d+\.\d+\.\d+$/.test(candidate.version)) errors.add("invalid_version");
  if (isPlaceholder(candidate.ownerUserId)) errors.add("owner_required");

  const reviewDueAt = timestamp(candidate.reviewDueAt);
  if (!Number.isFinite(now) || !Number.isFinite(reviewDueAt) || reviewDueAt <= now) {
    errors.add("review_date_invalid");
  }

  if (
    ["personal", "sensitive"].includes(candidate.dataClassification) &&
    (candidate.approvedBy === null ||
      candidate.approvedBy === candidate.createdBy ||
      isPlaceholder(candidate.approvedBy))
  ) {
    errors.add("independent_approval_required");
  }

  const uniqueSourceIds = [...new Set(candidate.sourceIds)];
  if (uniqueSourceIds.length === 0) errors.add("source_required");
  for (const sourceId of uniqueSourceIds) {
    const source = input.sources.find((entry) => entry.id === sourceId);
    if (!source) {
      errors.add("source_missing");
      continue;
    }
    if (["expired", "revoked"].includes(source.status)) {
      errors.add("source_unavailable");
    } else if (!sourceIsCurrent(source, now)) {
      errors.add("source_not_current");
    }
    if (isPlaceholder(source.ownerUserId) || source.checksum.trim().length < 16) {
      errors.add("source_metadata_incomplete");
    }
    if (source.institutionId !== candidate.institutionId) {
      errors.add("source_scope_mismatch");
    }
  }

  if (
    candidate.allowedTools.some(
      (tool) => !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(tool)
    )
  ) {
    errors.add("allowed_tool_invalid");
  }

  const coveredKinds = new Set(candidate.evaluations.map((evaluation) => evaluation.kind));
  const requiredKinds: SkillEvaluation["kind"][] = ["positive", "ambiguous", "forbidden"];
  if (!requiredKinds.every((kind) => coveredKinds.has(kind))) {
    errors.add("test_coverage_incomplete");
  }
  if (candidate.evaluations.some((evaluation) => evaluation.result !== "pass")) {
    errors.add("test_failed");
  }

  return { ok: errors.size === 0, errors: [...errors] };
}

export function authorizeKnowledgeSource(input: {
  source: KnowledgeSource;
  actor: KnowledgeActor;
  purpose: "answer" | "tool";
  now: string;
}): { ok: true } | { ok: false; reason: "source_unavailable" | "access_denied" | "tool_required" } {
  const now = timestamp(input.now);
  if (!sourceIsCurrent(input.source, now)) {
    return { ok: false, reason: "source_unavailable" };
  }

  const actorRank: Record<KnowledgeActorLevel, number> = {
    visitor: 0,
    contact_verified: 1,
    school_identity: 2,
    agent: 3,
    service_manager: 4,
    admin: 5,
  };
  const minimumRank: Record<KnowledgeClassification, number> = {
    public: 0,
    internal: 3,
    personal: 2,
    sensitive: 4,
  };

  if (input.actor.institutionId !== input.source.institutionId) {
    return { ok: false, reason: "access_denied" };
  }
  if (actorRank[input.actor.level] < minimumRank[input.source.classification]) {
    return { ok: false, reason: "access_denied" };
  }
  if (
    actorRank[input.actor.level] >= actorRank.agent &&
    input.source.serviceCodes.length > 0 &&
    !input.source.serviceCodes.some((service) => input.actor.serviceCodes.includes(service))
  ) {
    return { ok: false, reason: "access_denied" };
  }
  if (["personal", "sensitive"].includes(input.source.classification) && input.purpose !== "tool") {
    return { ok: false, reason: "tool_required" };
  }
  return { ok: true };
}

export function selectActiveSkillVersion(input: {
  versions: SkillVersion[];
  sources: KnowledgeSource[];
  now: string;
}): SkillVersion | null {
  const now = timestamp(input.now);
  return (
    input.versions
      .filter((version) => {
        if (
          version.status !== "published" ||
          version.publishedAt === null ||
          timestamp(version.publishedAt) > now ||
          timestamp(version.reviewDueAt) <= now
        ) {
          return false;
        }
        return version.sourceIds.every((sourceId) => {
          const source = input.sources.find((entry) => entry.id === sourceId);
          return source ? sourceIsCurrent(source, now) : false;
        });
      })
      .sort(
        (left, right) =>
          timestamp(right.publishedAt as string) - timestamp(left.publishedAt as string)
      )[0] ?? null
  );
}
