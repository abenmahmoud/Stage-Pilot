import type { UserRole } from "./types";

const AGENT_ROLES = new Set<UserRole>([
  "superadmin",
  "administration",
  "proviseur",
]);

export const AGENT_MFA_ENFORCED =
  import.meta.env.VITE_REQUIRE_AGENT_MFA === "true";

export function isAgentRole(role: UserRole): boolean {
  return AGENT_ROLES.has(role);
}
