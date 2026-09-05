// Decision pure de la porte client de l'ecran de validation des informations
// flash (T071E, LOT 5 du plan de publication publique).
//
// Jusqu'ici cette porte reposait sur `RoleRoute allowedRoles={CONTENT_MANAGER_ROLES}`
// (src/App.tsx) : un compte `administration`/`proviseur` sans le service
// `referent_numerique`/`ddfpt` voyait quand meme l'ecran (boutons desactives
// cote serveur, mais l'ecran restait affiche). §13 dit que c'est le service,
// jamais le role, qui ouvre la validation — deja applique aux routes qui
// mutent une version (`assertFlashValidationAccess`) et a la file
// (`assertFlashValidationQueueAccess`, api/_shared/flash-access.ts). Cette
// fonction applique la meme regle a la porte de l'ecran lui-meme, a partir de
// la reponse du serveur (`GET /api/flash/validation/screen-access`), jamais
// d'un role recalcule ici : le serveur reste seul a decider, cette fonction
// ne fait que choisir quoi afficher pendant/apres cette decision.

import type { LyceeGestRole } from "./role-access.js";

export type FlashValidationScreenAccessState =
  | { status: "loading" }
  | { status: "checked"; allowed: boolean };

export type FlashValidationRouteDecision =
  | { kind: "wait" }
  | { kind: "redirect"; to: string }
  | { kind: "render" };

export const FLASH_VALIDATION_STAFF_LOGIN_PATH = "/login?mode=staff";

export function decideFlashValidationRoute(input: {
  user: { role: LyceeGestRole } | null;
  authLoading: boolean;
  access: FlashValidationScreenAccessState;
  roleHome: Readonly<Record<LyceeGestRole, string>>;
}): FlashValidationRouteDecision {
  if (input.authLoading) return { kind: "wait" };
  if (!input.user) return { kind: "redirect", to: FLASH_VALIDATION_STAFF_LOGIN_PATH };
  if (input.access.status === "loading") return { kind: "wait" };
  if (!input.access.allowed) return { kind: "redirect", to: input.roleHome[input.user.role] };
  return { kind: "render" };
}
