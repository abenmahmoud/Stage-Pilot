import type { KnowledgeActor, KnowledgeActorLevel } from "./skill-registry-policy.js";

export type KnowledgeMembershipEvidence = {
  institutionId: string;
  role: "agent" | "service_manager" | "admin" | "auditor" | string;
  serviceCodes: string[];
  status: "invited" | "active" | "disabled" | string;
};

const STAFF_LEVELS: Partial<Record<KnowledgeMembershipEvidence["role"], KnowledgeActorLevel>> = {
  agent: "agent",
  service_manager: "service_manager",
  admin: "admin",
};

export function resolveKnowledgeActor(input: {
  institutionId: string;
  authenticated: boolean;
  emailConfirmed: boolean;
  schoolRecordMatched: boolean;
  membership: KnowledgeMembershipEvidence | null;
}): KnowledgeActor {
  const membership = input.membership;
  const staffLevel = membership?.institutionId === input.institutionId && membership.status === "active"
    ? STAFF_LEVELS[membership.role]
    : undefined;

  if (staffLevel) {
    return {
      level: staffLevel,
      institutionId: input.institutionId,
      serviceCodes: [...new Set(membership?.serviceCodes ?? [])].sort(),
    };
  }
  if (input.authenticated && input.schoolRecordMatched) {
    return {
      level: "school_identity",
      institutionId: input.institutionId,
      serviceCodes: [],
    };
  }
  if (input.authenticated && input.emailConfirmed) {
    return {
      level: "contact_verified",
      institutionId: input.institutionId,
      serviceCodes: [],
    };
  }
  return {
    level: "visitor",
    institutionId: input.institutionId,
    serviceCodes: [],
  };
}
