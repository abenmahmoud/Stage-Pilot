import type { AgentInstitutionRole } from "./agent-identity-policy.js";
import type { KnowledgeActor } from "./skill-registry-policy.js";

export type KnowledgeMembershipEvidence = {
  institutionId: string;
  role: "agent" | "service_manager" | "admin" | "auditor" | string;
  serviceCodes: string[];
  status: "invited" | "active" | "disabled" | string;
};

export type SchoolIdentityEvidence = {
  institutionId: string;
  sourceInstitutionId: string;
  sourceStatus: string;
  personType: string;
  assuranceLevel: string;
  verifiedBy: string | null;
  verifiedAt: string;
  revokedAt: string | null;
};

const SCHOOL_ROLES = new Set<AgentInstitutionRole>(["student", "guardian", "staff"]);

const STAFF_ROLES: Partial<Record<KnowledgeMembershipEvidence["role"], AgentInstitutionRole>> = {
  agent: "agent",
  service_manager: "service_manager",
  admin: "admin",
};

export function resolveSchoolIdentityRole(input: {
  institutionId: string;
  rows: SchoolIdentityEvidence[];
  now: string;
}): "student" | "guardian" | "staff" | null {
  if (input.rows.length !== 1) return null;
  const [identity] = input.rows;
  const verifiedAt = Date.parse(identity.verifiedAt);
  const now = Date.parse(input.now);
  if (
    identity.institutionId !== input.institutionId
    || identity.sourceInstitutionId !== input.institutionId
    || identity.sourceStatus !== "active"
    || identity.revokedAt !== null
    || !["directory_matched", "official_sso"].includes(identity.assuranceLevel)
    || (identity.assuranceLevel === "directory_matched" && identity.verifiedBy === null)
    || !SCHOOL_ROLES.has(identity.personType as AgentInstitutionRole)
    || !Number.isFinite(verifiedAt)
    || !Number.isFinite(now)
    || verifiedAt > now
  ) {
    return null;
  }
  return identity.personType as "student" | "guardian" | "staff";
}

export function resolveKnowledgeActor(input: {
  institutionId: string;
  authenticated: boolean;
  emailConfirmed: boolean;
  schoolRecordMatched: boolean;
  schoolRole?: "student" | "guardian" | "staff" | null;
  authenticatorLevel?: "aal1" | "aal2";
  membership: KnowledgeMembershipEvidence | null;
}): KnowledgeActor {
  const membership = input.membership;
  const staffRole = membership?.institutionId === input.institutionId && membership.status === "active"
    ? STAFF_ROLES[membership.role]
    : undefined;

  if (staffRole) {
    return {
      identityLevel: input.authenticatorLevel === "aal2" ? "I4" : "I3",
      role: staffRole,
      institutionId: input.institutionId,
      serviceCodes: [...new Set(membership?.serviceCodes ?? [])].sort(),
    };
  }
  if (input.authenticated && input.schoolRecordMatched) {
    return {
      identityLevel: "I3",
      role: input.schoolRole ?? "requester",
      institutionId: input.institutionId,
      serviceCodes: [],
    };
  }
  if (input.authenticated && input.emailConfirmed) {
    return {
      identityLevel: "I2",
      role: "requester",
      institutionId: input.institutionId,
      serviceCodes: [],
    };
  }
  if (input.authenticated) {
    return {
      identityLevel: "I1",
      role: "requester",
      institutionId: input.institutionId,
      serviceCodes: [],
    };
  }
  return {
    identityLevel: "I0",
    role: "visitor",
    institutionId: input.institutionId,
    serviceCodes: [],
  };
}
