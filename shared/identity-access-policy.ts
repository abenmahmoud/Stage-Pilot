import { identityAtLeast } from "./agent-identity-policy.js";
import type { AgentIdentityLevel } from "./agent-identity-policy.js";

export type SchoolIdentityAssurance = "directory_matched" | "official_sso";
export type InstitutionRole = "agent" | "service_manager" | "admin" | "auditor";

export type SchoolIdentityContext = {
  institutionId: string;
  officialPersonRef: string;
  assuranceLevel: SchoolIdentityAssurance;
  revokedAt: string | null;
};

export type SchoolRelationshipContext = {
  institutionId: string;
  subjectPersonRef: string;
  objectPersonRef: string;
  status: "active" | "revoked" | "expired";
  validFrom: string;
  validUntil: string | null;
};

export type InstitutionMembershipContext = {
  institutionId: string;
  role: InstitutionRole;
  serviceCodes: string[];
  status: "invited" | "active" | "disabled";
};

export type InstitutionActor = {
  userId: string | null;
  verifiedContactInstitutionIds: string[];
  schoolIdentity: SchoolIdentityContext | null;
  relationships: SchoolRelationshipContext[];
  memberships: InstitutionMembershipContext[];
  authenticatorLevel: "aal1" | "aal2";
};

export type InstitutionAccessTarget =
  | { kind: "public_information"; institutionId: string }
  | { kind: "support_followup"; institutionId: string; ownerUserId: string }
  | { kind: "school_data"; institutionId: string; subjectPersonRef: string }
  | { kind: "service_queue"; institutionId: string; serviceCode: string }
  | { kind: "skill_publication"; institutionId: string; serviceCode: string }
  | { kind: "membership_admin"; institutionId: string }
  | { kind: "audit_log"; institutionId: string; serviceCode: string | null };

export type InstitutionAccessReason =
  | "contact_verification_required"
  | "owner_mismatch"
  | "identity_i3_required"
  | "identity_revoked"
  | "institution_mismatch"
  | "relationship_missing"
  | "membership_required"
  | "service_scope_required"
  | "role_insufficient"
  | "mfa_required";

export type InstitutionAccessDecision =
  | { ok: true; basis: "public" | "verified_owner" | "school_relationship" | "membership" }
  | { ok: false; reason: InstitutionAccessReason };

export type IdentityRoleActionReason =
  | "institution_mismatch"
  | "identity_insufficient"
  | "role_insufficient"
  | "service_scope_required"
  | "relationship_required"
  | "mfa_required";

export type IdentityRoleActionDecision =
  | { ok: true }
  | { ok: false; reason: IdentityRoleActionReason };

export function authorizeIdentityRoleAction(input: {
  actor: {
    institutionId: string;
    identityLevel: AgentIdentityLevel;
    role: string;
    serviceCodes: string[];
    relationshipConfirmed: boolean;
    authenticatorLevel: "aal1" | "aal2";
  };
  requirement: {
    institutionId: string;
    requiredIdentity: AgentIdentityLevel;
    allowedRoles: string[];
    serviceCodes: string[];
    relationshipRequired: boolean;
    mfaRequired: boolean;
  };
}): IdentityRoleActionDecision {
  const { actor, requirement } = input;
  if (actor.institutionId !== requirement.institutionId) {
    return { ok: false, reason: "institution_mismatch" };
  }
  if (!identityAtLeast(actor.identityLevel, requirement.requiredIdentity)) {
    return { ok: false, reason: "identity_insufficient" };
  }
  if (!requirement.allowedRoles.includes(actor.role)) {
    return { ok: false, reason: "role_insufficient" };
  }
  if (
    requirement.serviceCodes.length > 0
    && !requirement.serviceCodes.some((service) => actor.serviceCodes.includes(service))
  ) {
    return { ok: false, reason: "service_scope_required" };
  }
  if (requirement.relationshipRequired && !actor.relationshipConfirmed) {
    return { ok: false, reason: "relationship_required" };
  }
  if (requirement.mfaRequired && actor.authenticatorLevel !== "aal2") {
    return { ok: false, reason: "mfa_required" };
  }
  return { ok: true };
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function relationshipIsActive(
  relationship: SchoolRelationshipContext,
  institutionId: string,
  subjectPersonRef: string,
  objectPersonRef: string,
  now: number
): boolean {
  const validFrom = timestamp(relationship.validFrom);
  const validUntil = relationship.validUntil
    ? timestamp(relationship.validUntil)
    : Number.POSITIVE_INFINITY;
  return (
    relationship.status === "active" &&
    relationship.institutionId === institutionId &&
    relationship.subjectPersonRef === subjectPersonRef &&
    relationship.objectPersonRef === objectPersonRef &&
    Number.isFinite(validFrom) &&
    validFrom <= now &&
    validUntil >= now
  );
}

function activeMembership(
  actor: InstitutionActor,
  institutionId: string
): InstitutionMembershipContext | null {
  return actor.memberships.find(
    (membership) =>
      membership.institutionId === institutionId && membership.status === "active"
  ) ?? null;
}

export function authorizeInstitutionAccess(input: {
  actor: InstitutionActor;
  target: InstitutionAccessTarget;
  now: string;
}): InstitutionAccessDecision {
  const { actor, target } = input;
  if (target.kind === "public_information") return { ok: true, basis: "public" };

  if (target.kind === "support_followup") {
    if (!actor.verifiedContactInstitutionIds.includes(target.institutionId)) {
      return { ok: false, reason: "contact_verification_required" };
    }
    if (actor.userId === null || actor.userId !== target.ownerUserId) {
      return { ok: false, reason: "owner_mismatch" };
    }
    return { ok: true, basis: "verified_owner" };
  }

  if (target.kind === "school_data") {
    const identity = actor.schoolIdentity;
    if (!identity) return { ok: false, reason: "identity_i3_required" };
    if (identity.revokedAt !== null) return { ok: false, reason: "identity_revoked" };
    if (identity.institutionId !== target.institutionId) {
      return { ok: false, reason: "institution_mismatch" };
    }
    if (identity.officialPersonRef === target.subjectPersonRef) {
      return { ok: true, basis: "school_relationship" };
    }
    const now = timestamp(input.now);
    if (
      !Number.isFinite(now) ||
      !actor.relationships.some((relationship) =>
        relationshipIsActive(
          relationship,
          target.institutionId,
          identity.officialPersonRef,
          target.subjectPersonRef,
          now
        )
      )
    ) {
      return { ok: false, reason: "relationship_missing" };
    }
    return { ok: true, basis: "school_relationship" };
  }

  const membership = activeMembership(actor, target.institutionId);
  if (!membership) return { ok: false, reason: "membership_required" };

  if (
    target.kind === "audit_log" &&
    target.serviceCode === null &&
    membership.role !== "admin"
  ) {
    return { ok: false, reason: "service_scope_required" };
  }

  const allowedRoles = target.kind === "membership_admin"
    ? ["admin"]
    : target.kind === "service_queue"
      ? ["agent", "service_manager", "admin"]
      : target.kind === "skill_publication"
        ? ["service_manager", "admin"]
        : target.serviceCode === null
          ? ["admin"]
          : ["auditor", "admin"];
  const serviceCodes = target.kind === "membership_admin"
    ? []
    : target.serviceCode === null
      ? []
      : [target.serviceCode];
  const decision = authorizeIdentityRoleAction({
    actor: {
      institutionId: membership.institutionId,
      identityLevel: "I3",
      role: membership.role,
      serviceCodes: membership.serviceCodes,
      relationshipConfirmed: false,
      authenticatorLevel: actor.authenticatorLevel,
    },
    requirement: {
      institutionId: target.institutionId,
      requiredIdentity: "I3",
      allowedRoles,
      serviceCodes,
      relationshipRequired: false,
      mfaRequired: true,
    },
  });
  if (!decision.ok) {
    const reason: InstitutionAccessReason = decision.reason === "identity_insufficient"
      ? "membership_required"
      : decision.reason === "relationship_required"
        ? "role_insufficient"
        : decision.reason;
    return { ok: false, reason };
  }
  return { ok: true, basis: "membership" };
}
