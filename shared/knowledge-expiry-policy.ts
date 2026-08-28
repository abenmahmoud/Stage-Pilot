export type ActiveKnowledgeSkill = {
  skillId: string;
  institutionId: string;
  activeVersionId: string;
  reviewDueAt: string;
};

export type ActiveKnowledgeSourceLink = {
  skillVersionId: string;
  sourceId: string;
  required: boolean;
};

export type KnowledgeExpiryPlanItem = {
  skillId: string;
  institutionId: string;
  reasons: Array<"source_expired" | "review_overdue">;
  expiredSourceIds: string[];
};

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function buildKnowledgeExpiryPlan(input: {
  skills: ActiveKnowledgeSkill[];
  links: ActiveKnowledgeSourceLink[];
  expiredSourceIds: string[];
  now: string;
}): KnowledgeExpiryPlanItem[] {
  const now = timestamp(input.now);
  if (!Number.isFinite(now)) return [];

  const expiredSources = new Set(input.expiredSourceIds);
  const linksByVersion = new Map<string, ActiveKnowledgeSourceLink[]>();
  for (const link of input.links) {
    if (!link.required || !expiredSources.has(link.sourceId)) continue;
    const current = linksByVersion.get(link.skillVersionId) ?? [];
    current.push(link);
    linksByVersion.set(link.skillVersionId, current);
  }

  return input.skills.flatMap((skill) => {
    const expiredLinks = linksByVersion.get(skill.activeVersionId) ?? [];
    const reviewDueAt = timestamp(skill.reviewDueAt);
    const reviewOverdue = Number.isFinite(reviewDueAt) && reviewDueAt <= now;
    if (expiredLinks.length === 0 && !reviewOverdue) return [];

    const reasons: KnowledgeExpiryPlanItem["reasons"] = [];
    if (expiredLinks.length > 0) reasons.push("source_expired");
    if (reviewOverdue) reasons.push("review_overdue");
    return [{
      skillId: skill.skillId,
      institutionId: skill.institutionId,
      reasons,
      expiredSourceIds: [...new Set(expiredLinks.map((link) => link.sourceId))].sort(),
    }];
  });
}
