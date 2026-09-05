// Contrat pur du coffre de codes (ENT, cantine, Koxo/session lycée).
//
// LOT 1 du plan du 5 septembre 2026 : aucune base, aucun réseau, aucune valeur
// de code. Ce module ne reçoit et ne produit jamais la valeur d'un code ; il
// ne modélise que ce qui entoure cette valeur (statut, autorisation, refus).
// La messagerie académique n'a pas de code à remettre ici : seul l'email est
// vérifiable, via `identity-directory-lookup.ts`.

import type { LyceeGestRole } from "./role-access.js";
import type { SupportService } from "./support-agent-access.js";

export const VAULT_SERVICES = ["ent", "cantine", "koxo"] as const;
export type VaultService = (typeof VAULT_SERVICES)[number];

// ---------------------------------------------------------------------------
// Cycle de vie
// ---------------------------------------------------------------------------

export const VAULT_CODE_STATUSES = ["disponible", "reserve", "remis", "utilise"] as const;
export type VaultCodeStatus = (typeof VAULT_CODE_STATUSES)[number];

/**
 * Ordre strict du cycle de vie, inchangé depuis le LOT 1. Le LOT 3 ajoute
 * l'expiration de la visibilité et le remplacement humain tracé, mais ni
 * l'un ni l'autre ne fait régresser ce statut : l'expiration se lit sur un
 * horodatage de remise (`isVaultDisplayStillVisible` ci-dessous) et un
 * remplacement crée une nouvelle version de l'attribution (nouveau
 * quadruplet) plutôt que de faire reculer celle-ci.
 */
const VAULT_LIFECYCLE_ORDER: readonly VaultCodeStatus[] = [
  "disponible",
  "reserve",
  "remis",
  "utilise",
];

export function isLegalVaultTransition(from: VaultCodeStatus, to: VaultCodeStatus): boolean {
  const fromIndex = VAULT_LIFECYCLE_ORDER.indexOf(from);
  const toIndex = VAULT_LIFECYCLE_ORDER.indexOf(to);
  return fromIndex !== -1 && toIndex === fromIndex + 1;
}

export class VaultTransitionError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("Transition de statut de code coffre invalide");
    this.reason = reason;
  }
}

/**
 * Une consultation seule (affichage, relecture) ne fait jamais progresser le
 * statut : ce n'est pas une preuve d'usage. Seul un contrôle d'activation réel
 * ou une validation autorisée peut marquer `utilise`, et seulement depuis
 * `remis`.
 */
export type VaultCodeEvent =
  | { kind: "consult" }
  | { kind: "activation_confirmed" }
  | { kind: "authorized_validation" };

export function applyVaultCodeEvent(
  current: VaultCodeStatus,
  event: VaultCodeEvent
): VaultCodeStatus {
  if (event.kind === "consult") return current;

  if (!isLegalVaultTransition(current, "utilise")) {
    throw new VaultTransitionError("illegal_transition_to_utilise");
  }
  return "utilise";
}

// ---------------------------------------------------------------------------
// Identité d'une attribution
// ---------------------------------------------------------------------------

/**
 * Personne, service, année scolaire, version : le quadruplet du plan. Une
 * seule attribution active peut exister par quadruplet ; la contrainte réelle
 * (base + LOT 2) est vérifiée ici sous forme pure pour que la règle soit
 * testable sans base.
 */
export type VaultAssignmentIdentity = {
  institutionId: string;
  personRef: string;
  service: VaultService;
  schoolYear: string;
  version: number;
};

export function vaultAssignmentKey(identity: VaultAssignmentIdentity): string {
  return [
    identity.institutionId,
    identity.personRef,
    identity.service,
    identity.schoolYear,
    identity.version,
  ].join(":");
}

export function hasConflictingActiveVaultAssignment(
  candidate: VaultAssignmentIdentity,
  existingActive: readonly VaultAssignmentIdentity[]
): boolean {
  const key = vaultAssignmentKey(candidate);
  return existingActive.some((existing) => vaultAssignmentKey(existing) === key);
}

// ---------------------------------------------------------------------------
// Ce que le modèle a le droit de recevoir
// ---------------------------------------------------------------------------

export type VaultAccessRefusalReason =
  | "parent_to_child_forbidden"
  | "institution_mismatch"
  | "self_only"
  | "cantine_availability_not_validated"
  | "professeur_principal_ent_forbidden"
  | "professeur_principal_single_active_code_required"
  | "professeur_principal_class_not_validated"
  | "service_scope_required";

/**
 * Type explicite de ce que le modèle d'IA peut recevoir au sujet d'un code.
 * Il n'existe structurellement aucun champ capable de porter une valeur de
 * code : la garantie tient par l'absence de champ, pas par la discipline de
 * l'appelant. `buildModelVisibleVaultFact` ci-dessous construit toujours ce
 * type par une liste explicite de champs, jamais par un étalement (`...`)
 * d'un enregistrement interne susceptible de contenir la valeur.
 */
export type ModelVisibleVaultFact = {
  service: VaultService;
  status: VaultCodeStatus | null;
  validationRequired: boolean;
  deliveryAuthorized: boolean;
  refusalReason: VaultAccessRefusalReason | null;
  receipt: { deliveredAt: string; deliveredByPersonRef: string } | null;
};

export function buildModelVisibleVaultFact(input: {
  service: VaultService;
  status: VaultCodeStatus | null;
  validationRequired: boolean;
  deliveryAuthorized: boolean;
  refusalReason: VaultAccessRefusalReason | null;
  receipt: { deliveredAt: string; deliveredByPersonRef: string } | null;
}): ModelVisibleVaultFact {
  return {
    service: input.service,
    status: input.status,
    validationRequired: input.validationRequired,
    deliveryAuthorized: input.deliveryAuthorized,
    refusalReason: input.refusalReason,
    receipt: input.receipt,
  };
}

// ---------------------------------------------------------------------------
// Matrice d'autorisation (§7 de la politique opérationnelle 2026-2027)
// ---------------------------------------------------------------------------

export type VaultActor =
  | { profile: "eleve"; personRef: string; institutionId: string }
  | { profile: "professeur"; personRef: string; institutionId: string }
  | {
      profile: "professeur_principal";
      personRef: string;
      institutionId: string;
      validatedClassRefs: readonly string[];
    }
  | { profile: "service"; institutionId: string; grantedServices: readonly SupportService[] }
  | { profile: "superadmin" }
  | { profile: "parent"; personRef: string; institutionId: string };

export type VaultAccessTarget = {
  service: VaultService;
  institutionId: string;
  subjectKind: "self" | "student" | "institution_wide";
  subjectPersonRef: string | null;
  subjectClassRef: string | null;
};

export type VaultAccessDecision =
  | { allowed: true }
  | { allowed: false; reason: VaultAccessRefusalReason };

const INSTITUTION_WIDE_SERVICE_CODES: readonly SupportService[] = [
  "administration",
  "ddfpt",
  "referent_numerique",
];

export function decideVaultAccess(input: {
  actor: VaultActor;
  target: VaultAccessTarget;
  /** Cantine du professeur pour lui-même : « selon disponibilité validée ». */
  cantineAvailabilityValidated?: boolean;
  /** « Un code élève à la fois » pour le professeur principal. */
  professeurPrincipalAlreadyHoldingAnotherActiveCode?: boolean;
}): VaultAccessDecision {
  const { actor, target } = input;
  const refuse = (reason: VaultAccessRefusalReason): VaultAccessDecision => ({
    allowed: false,
    reason,
  });

  if (actor.profile === "superadmin") return { allowed: true };

  // La remise des codes d'un enfant à un parent reste désactivée (T064A) :
  // ce n'est pas une question de relation ou d'établissement, c'est un refus
  // de principe avec motif explicite.
  if (actor.profile === "parent") return refuse("parent_to_child_forbidden");

  if (actor.institutionId !== target.institutionId) return refuse("institution_mismatch");

  if (actor.profile === "eleve") {
    if (target.subjectKind === "self" && target.subjectPersonRef === actor.personRef) {
      return { allowed: true };
    }
    return refuse("self_only");
  }

  if (actor.profile === "professeur") {
    if (target.subjectKind !== "self" || target.subjectPersonRef !== actor.personRef) {
      return refuse("self_only");
    }
    if (target.service === "cantine" && !input.cantineAvailabilityValidated) {
      return refuse("cantine_availability_not_validated");
    }
    return { allowed: true };
  }

  if (actor.profile === "professeur_principal") {
    if (target.service === "ent") return refuse("professeur_principal_ent_forbidden");
    if (target.subjectKind !== "student") return refuse("self_only");
    if (input.professeurPrincipalAlreadyHoldingAnotherActiveCode) {
      return refuse("professeur_principal_single_active_code_required");
    }
    if (
      target.subjectClassRef === null ||
      !actor.validatedClassRefs.includes(target.subjectClassRef)
    ) {
      return refuse("professeur_principal_class_not_validated");
    }
    return { allowed: true };
  }

  // actor.profile === "service" : intendance (cantine), administration,
  // DDFPT et référent numérique — ouvert par le service porté par le
  // membre, jamais par son rôle seul (même motif que
  // `flash-validation-access.ts`).
  if (target.service === "cantine" && actor.grantedServices.includes("intendance")) {
    return { allowed: true };
  }
  if (INSTITUTION_WIDE_SERVICE_CODES.some((service) => actor.grantedServices.includes(service))) {
    return { allowed: true };
  }
  return refuse("service_scope_required");
}

/** Rôle LyceeGest correspondant à chaque profil vérifié du §7, pour les appelants qui ne connaissent que le rôle. */
export const VAULT_PROFILE_ROLES: Readonly<Record<"eleve" | "professeur" | "professeur_principal", LyceeGestRole>> = {
  eleve: "eleve",
  professeur: "professeur",
  professeur_principal: "pp",
};

// ---------------------------------------------------------------------------
// LOT 3 — quota d'affichage quotidien et fenêtre de visibilité
// ---------------------------------------------------------------------------

/** Trois affichages maximum par personne, par code, par jour (plan §LOT 3). */
export const VAULT_MAX_DAILY_DISPLAYS = 3;

/** Visible 30 minutes après la remise, puis invalide (plan §LOT 3). */
export const VAULT_DISPLAY_VISIBILITY_SECONDS = 30 * 60;

export type VaultDisplayQuotaDecision =
  | { allowed: true; remainingDisplaysToday: number }
  | { allowed: false; reason: "daily_display_quota_exceeded" };

/**
 * Au-delà de trois affichages dans la même journée, le formulaire enrichi
 * prend le relais : ce n'est jamais une erreur, seulement l'épuisement du
 * quota. `displayCountToday` doit déjà avoir été remis à zéro par l'appelant
 * si le dernier affichage remonte à un autre jour — cette fonction ne connaît
 * volontairement aucune notion de date, pour rester pure et testable sans
 * horloge.
 */
export function decideVaultDisplayQuota(input: {
  displayCountToday: number;
}): VaultDisplayQuotaDecision {
  if (input.displayCountToday >= VAULT_MAX_DAILY_DISPLAYS) {
    return { allowed: false, reason: "daily_display_quota_exceeded" };
  }
  return {
    allowed: true,
    remainingDisplaysToday: VAULT_MAX_DAILY_DISPLAYS - input.displayCountToday - 1,
  };
}

/**
 * Un code remis reste visible 30 minutes puis devient invalide : au-delà,
 * une nouvelle vérification d'identité est nécessaire avant toute nouvelle
 * remise (plan §LOT 3). `revealedAt` nul signifie qu'aucune remise n'a
 * encore eu lieu : jamais visible.
 */
export function isVaultDisplayStillVisible(revealedAt: Date | null, now: Date): boolean {
  if (!revealedAt) return false;
  const elapsedSeconds = (now.getTime() - revealedAt.getTime()) / 1000;
  return elapsedSeconds >= 0 && elapsedSeconds < VAULT_DISPLAY_VISIBILITY_SECONDS;
}

// ---------------------------------------------------------------------------
// LOT 3 — signalement défectueux
// ---------------------------------------------------------------------------

/**
 * Un code signalé défectueux attend toujours une intervention humaine :
 * cette fonction retourne structurellement `false`, sans aucune branche,
 * pour qu'aucun appelant ne puisse un jour y glisser une condition qui
 * déclencherait un remplacement ou une réactivation automatique. Le
 * déclencheur `code_vault_assignment_defect_flag_is_immutable` (LOT 3, SQL)
 * porte la même garantie côté base.
 */
export function canAutoReplaceDefectiveVaultCode(): false {
  return false;
}
