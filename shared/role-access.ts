export type LyceeGestRole =
  | "superadmin"
  | "administration"
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
  "proviseur",
];

export function roleIsAllowed(
  role: LyceeGestRole,
  allowedRoles: readonly LyceeGestRole[]
): boolean {
  return allowedRoles.includes(role);
}
