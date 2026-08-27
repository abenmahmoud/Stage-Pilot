import { AGENT_ROLES, roleIsAllowed } from "../../shared/role-access";
import type { UserRole } from "./types";

export const AGENT_MFA_ENFORCED =
  import.meta.env.VITE_REQUIRE_AGENT_MFA === "true";

export function isAgentRole(role: UserRole): boolean {
  return roleIsAllowed(role, AGENT_ROLES);
}
