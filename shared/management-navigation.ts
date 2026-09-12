import type { LyceeGestRole } from "./role-access.js";

/** Existing school permissions remain enforced by each API. No new role is granted here. */
export const SCHOOL_MANAGEMENT_ROLES: readonly LyceeGestRole[] = ["superadmin", "administration", "agent", "proviseur"];
export const AI_BUDGET_ROLES: readonly LyceeGestRole[] = ["superadmin"];
export const MANAGEMENT_HOME = "/gestion";
export const MANAGEMENT_REQUESTS = "/gestion/demandes";

const STAGE_ADMIN_PATHS = new Set([
  "/admin", "/admin/import", "/admin/codes-acces", "/admin/codes-profs",
  "/admin/affectations-classes", "/admin/affectations-eleves", "/admin/documents-classes", "/admin/parametres",
]);

export function isStageWorkspace(pathname: string): boolean {
  return pathname === "/app" || pathname === "/dashboard" || STAGE_ADMIN_PATHS.has(pathname)
    || /^\/(stages|grand-oral|coffre)(\/|$)/.test(pathname);
}

export function legacyAgentDestination(search: string): string {
  const params = new URLSearchParams(search);
  const service = params.get("service");
  return service && /^[a-z_]{2,40}$/.test(service)
    ? `${MANAGEMENT_REQUESTS}?service=${encodeURIComponent(service)}` : MANAGEMENT_REQUESTS;
}
