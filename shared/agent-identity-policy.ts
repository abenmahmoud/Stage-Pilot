export type AgentIdentityLevel = "I0" | "I1" | "I2" | "I3" | "I4";

export type AgentInstitutionRole =
  | "visitor"
  | "requester"
  | "student"
  | "guardian"
  | "staff"
  | "agent"
  | "service_manager"
  | "admin";

export type LegacyActorLevel =
  | "visitor"
  | "contact_verified"
  | "school_identity"
  | "agent"
  | "service_manager"
  | "admin";

const IDENTITY_RANK: Record<AgentIdentityLevel, number> = {
  I0: 0,
  I1: 1,
  I2: 2,
  I3: 3,
  I4: 4,
};

const LEGACY_ACTOR_MAPPING: Record<
  LegacyActorLevel,
  { identityLevel: AgentIdentityLevel; role: AgentInstitutionRole }
> = {
  visitor: { identityLevel: "I0", role: "visitor" },
  contact_verified: { identityLevel: "I2", role: "requester" },
  school_identity: { identityLevel: "I3", role: "requester" },
  agent: { identityLevel: "I3", role: "agent" },
  service_manager: { identityLevel: "I3", role: "service_manager" },
  admin: { identityLevel: "I3", role: "admin" },
};

export function identityAtLeast(
  actual: AgentIdentityLevel,
  required: AgentIdentityLevel
): boolean {
  return IDENTITY_RANK[actual] >= IDENTITY_RANK[required];
}

/**
 * Read-only compatibility for historical labels. It never infers I4 because
 * the old value did not prove a recent reinforced session.
 */
export function migrateLegacyActorLevel(
  level: string
): { identityLevel: AgentIdentityLevel; role: AgentInstitutionRole } | null {
  const migrated = LEGACY_ACTOR_MAPPING[level as LegacyActorLevel];
  return migrated ? { ...migrated } : null;
}
