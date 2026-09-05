export type LyceeGestRole =
  | "superadmin"
  | "administration"
  | "agent"
  | "pp"
  | "professeur"
  | "proviseur"
  | "eleve";

export const ADMINISTRATION_ROLES: readonly LyceeGestRole[] = [
  "superadmin",
  "administration",
];

export const AGENT_ROLES: readonly LyceeGestRole[] = [
  "superadmin",
  "administration",
  "agent",
  "proviseur",
];

export const CONTENT_MANAGER_ROLES: readonly LyceeGestRole[] = [
  "superadmin",
  "administration",
  "proviseur",
];

// §13 de la politique operationnelle (informations flash) : « un personnel ou
// professeur verifie propose ». Distinct de CONTENT_MANAGER_ROLES, qui ne
// couvre pas "professeur"/"pp".
export const FLASH_PROPOSAL_ROLES: readonly LyceeGestRole[] = [
  "superadmin",
  "administration",
  "proviseur",
  "professeur",
  "pp",
];

export function roleIsAllowed(
  role: LyceeGestRole,
  allowedRoles: readonly LyceeGestRole[]
): boolean {
  return allowedRoles.includes(role);
}
