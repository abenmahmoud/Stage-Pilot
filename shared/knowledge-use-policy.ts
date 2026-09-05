import { classificationIsPromptSafe } from "./public-agent-skill-policy.js";
import type { KnowledgeActor, KnowledgeClassification } from "./skill-registry-policy.js";

// Meme famille que public-agent-skill-policy.ts (LOT 2 du plan de connaissance
// OB1, 2026-09-05) : reutilise sa verification de classification plutot que
// de la dupliquer, pour ne jamais faire diverger les deux couches.

export type KnowledgeSourceProvenanceStatus =
  | "observed"
  | "inferred"
  | "user_confirmed"
  | "imported"
  | "generated"
  | "superseded"
  | "disputed";

export type KnowledgeSourceUsePolicy =
  | "can_use_as_instruction"
  | "can_use_as_evidence"
  | "requires_human_confirmation"
  | "do_not_inject_automatically";

export type KnowledgeUsageCandidateSource = {
  id: string;
  institutionId: string;
  serviceCodes: string[];
  status: "draft" | "published" | "expired" | "revoked";
  classification: KnowledgeClassification;
  provenanceStatus: KnowledgeSourceProvenanceStatus;
  usePolicy: KnowledgeSourceUsePolicy;
  validFrom: string;
  expiresAt: string | null;
};

export type KnowledgeUsageDecisionKind =
  | "instruction"
  | "evidence"
  | "requires_confirmation"
  | "do_not_inject";

// Code stable (pas une phrase) : LOT 4 l'ecrit tel quel dans la trace de
// rappel, comme motif de retenue ou d'ecart.
export type KnowledgeUsageReasonCode =
  | "evaluation_time_invalid"
  | "institution_mismatch"
  | "source_not_published"
  | "source_not_yet_valid"
  | "source_expired"
  | "source_superseded"
  | "source_disputed"
  | "use_policy_blocks_automatic_injection"
  | "service_scope_required"
  | "classification_not_safe_for_actor"
  | "policy_requires_human_confirmation"
  | "policy_allows_cited_evidence"
  | "policy_allows_instruction";

export type KnowledgeUsageDecision = {
  decision: KnowledgeUsageDecisionKind;
  reasonCode: KnowledgeUsageReasonCode;
};

function timestamp(value: string | null): number {
  if (!value) return Number.NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function excluded(reasonCode: KnowledgeUsageReasonCode): KnowledgeUsageDecision {
  return { decision: "do_not_inject", reasonCode };
}

/**
 * Decide, pour une source candidate et un acteur, si elle peut etre injectee
 * comme instruction, citee comme preuve, retenue en attente de confirmation
 * humaine, ou jamais injectee automatiquement. Sans base ni reseau : toutes
 * les donnees necessaires sont passees en entree.
 */
export function decideKnowledgeSourceUsage(input: {
  source: KnowledgeUsageCandidateSource;
  actor: KnowledgeActor;
  now: string;
}): KnowledgeUsageDecision {
  const { source, actor } = input;
  const now = timestamp(input.now);
  if (!Number.isFinite(now)) return excluded("evaluation_time_invalid");

  if (source.institutionId !== actor.institutionId) {
    return excluded("institution_mismatch");
  }

  if (source.status !== "published") {
    return excluded(source.status === "expired" ? "source_expired" : "source_not_published");
  }

  const validFrom = timestamp(source.validFrom);
  const expiresAt = source.expiresAt ? timestamp(source.expiresAt) : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(validFrom) || validFrom > now) {
    return excluded("source_not_yet_valid");
  }
  if (!(expiresAt >= now)) {
    return excluded("source_expired");
  }

  if (source.provenanceStatus === "superseded") return excluded("source_superseded");
  if (source.provenanceStatus === "disputed") return excluded("source_disputed");

  if (source.usePolicy === "do_not_inject_automatically") {
    return excluded("use_policy_blocks_automatic_injection");
  }

  if (
    source.serviceCodes.length > 0 &&
    !source.serviceCodes.some((service) => actor.serviceCodes.includes(service))
  ) {
    return excluded("service_scope_required");
  }

  const classificationSafe =
    source.classification === "public" ||
    classificationIsPromptSafe(source.classification, actor, source.serviceCodes);
  if (!classificationSafe) return excluded("classification_not_safe_for_actor");

  if (source.usePolicy === "requires_human_confirmation") {
    return { decision: "requires_confirmation", reasonCode: "policy_requires_human_confirmation" };
  }
  if (source.usePolicy === "can_use_as_evidence") {
    return { decision: "evidence", reasonCode: "policy_allows_cited_evidence" };
  }
  return { decision: "instruction", reasonCode: "policy_allows_instruction" };
}
