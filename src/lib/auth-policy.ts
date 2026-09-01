import { AGENT_ROLES, roleIsAllowed } from "../../shared/role-access";
import type { UserRole } from "./types";

export function isAgentRole(role: UserRole): boolean {
  return roleIsAllowed(role, AGENT_ROLES);
}
