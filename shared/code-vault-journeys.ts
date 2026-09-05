// Les quatre parcours de connexion, en données fictives — LOT 5 du plan du
// 5 septembre 2026 (`docs/operations/PLAN_COFFRE_CODES_2026-09-05.md`).
//
// Module pur, sans base ni réseau : il orchestre la séquence de chaque
// parcours (preuve, remise, invitation, escalade) en réutilisant les
// contrats déjà écrits plutôt que de les réimplémenter :
//   - la preuve par email/téléphone déjà enregistré suit le même schéma que
//     `api/identity/device/request.ts` et `verify.ts` (une coordonnée DÉJÀ
//     au dossier, jamais une coordonnée saisie par le demandeur) ;
//   - la remise du code (ENT, cantine, Koxo) délègue au composant sécurisé du
//     LOT 4 via `reveal_in_secure_display`, jamais une valeur portée ici ;
//   - l'escalade s'appuie sur `SupportService` (`support-agent-access.ts`),
//     le même mécanisme d'ouverture par service que
//     `flash-validation-access.ts` et `code-vault-policy.ts`.
//
// Comme dans `code-vault-policy.ts`, ce module ne reçoit et ne produit
// jamais la valeur d'un code. Il ne connaît que la phase du parcours en
// cours ; c'est à l'appelant (hors périmètre du LOT 5) de faire progresser
// cette phase à partir d'événements réels (preuve envoyée, code saisi,
// recherche en échec...).

import type { SupportService } from "./support-agent-access.js";
import type { VaultService } from "./code-vault-policy.js";

export const CODE_VAULT_JOURNEY_TYPES = [
  "ent_inactif",
  "ent_actif",
  "cantine",
  "koxo",
  "messagerie_academique",
] as const;
export type CodeVaultJourneyType = (typeof CODE_VAULT_JOURNEY_TYPES)[number];

/** Une coordonnée déjà au dossier, jamais une valeur saisie par le demandeur. */
export const VAULT_PROOF_CHANNELS = ["email", "phone"] as const;
export type VaultProofChannel = (typeof VAULT_PROOF_CHANNELS)[number];

// ---------------------------------------------------------------------------
// Garde structurelle : l'agent ne modifie jamais une coordonnée
// ---------------------------------------------------------------------------

/**
 * Aucun parcours du coffre ne peut modifier une coordonnée (email, téléphone)
 * — seulement constater qu'elle est incorrecte et escalader vers un humain
 * (référent numérique). Comme `canAutoReplaceDefectiveVaultCode` dans
 * `code-vault-policy.ts`, cette fonction retourne structurellement `false`,
 * sans branche, pour qu'aucun appelant ne puisse un jour y glisser une
 * condition qui déclencherait une écriture.
 */
export function canVaultJourneyAgentModifyContact(): false {
  return false;
}

// ---------------------------------------------------------------------------
// Actions que peut produire un parcours
// ---------------------------------------------------------------------------

export type CodeVaultJourneyAction =
  | { kind: "send_proof"; channel: VaultProofChannel }
  | { kind: "await_verification" }
  | { kind: "reveal_in_secure_display"; service: VaultService }
  | { kind: "invite_password_reset" }
  | { kind: "guide_password_reset" }
  | { kind: "confirm_academic_email_only" }
  | { kind: "open_referral"; service: SupportService; reasonCode: string }
  | { kind: "form_fallback"; reasonCode: string }
  | { kind: "done" };

const REFERENT_NUMERIQUE: SupportService = "referent_numerique";
const INTENDANCE: SupportService = "intendance";

// ---------------------------------------------------------------------------
// ENT inactif — preuve, puis identifiant + code d'activation, puis
// invitation à réinitialiser le mot de passe.
// ---------------------------------------------------------------------------

export type EntInactifPhase =
  | "before_proof"
  | "awaiting_verification"
  | "verified"
  | "revealed";

export function decideEntInactifJourneyStep(input: {
  phase: EntInactifPhase;
  proofChannel: VaultProofChannel;
}): CodeVaultJourneyAction {
  switch (input.phase) {
    case "before_proof":
      return { kind: "send_proof", channel: input.proofChannel };
    case "awaiting_verification":
      return { kind: "await_verification" };
    case "verified":
      return { kind: "reveal_in_secure_display", service: "ent" };
    case "revealed":
      return { kind: "invite_password_reset" };
  }
}

// ---------------------------------------------------------------------------
// ENT actif — guider la réinitialisation ; échec ou coordonnée incorrecte
// ouvre une demande au référent numérique. L'agent ne modifie jamais une
// coordonnée : la seule issue en cas de coordonnée incorrecte est l'escalade.
// ---------------------------------------------------------------------------

export type EntActifOutcome = "start" | "succeeded" | "failed" | "coordinate_incorrect";

export function decideEntActifJourneyStep(input: {
  outcome: EntActifOutcome;
}): CodeVaultJourneyAction {
  if (input.outcome === "start") return { kind: "guide_password_reset" };
  if (input.outcome === "succeeded") return { kind: "done" };
  return {
    kind: "open_referral",
    service: REFERENT_NUMERIQUE,
    reasonCode: input.outcome === "failed" ? "ent_reset_failed" : "ent_coordinate_incorrect",
  };
}

// ---------------------------------------------------------------------------
// Cantine — preuve puis numéro annuel de badge ; erreur vers l'intendance.
// ---------------------------------------------------------------------------

export type ProofBackedJourneyPhase =
  | "before_proof"
  | "awaiting_verification"
  | "verified"
  | "lookup_failed";

export function decideCantineJourneyStep(input: {
  phase: ProofBackedJourneyPhase;
  proofChannel: VaultProofChannel;
}): CodeVaultJourneyAction {
  switch (input.phase) {
    case "before_proof":
      return { kind: "send_proof", channel: input.proofChannel };
    case "awaiting_verification":
      return { kind: "await_verification" };
    case "verified":
      return { kind: "reveal_in_secure_display", service: "cantine" };
    case "lookup_failed":
      return { kind: "open_referral", service: INTENDANCE, reasonCode: "cantine_badge_not_found" };
  }
}

// ---------------------------------------------------------------------------
// Koxo — preuve puis code fixe ; erreur vers le référent numérique.
// ---------------------------------------------------------------------------

export function decideKoxoJourneyStep(input: {
  phase: ProofBackedJourneyPhase;
  proofChannel: VaultProofChannel;
}): CodeVaultJourneyAction {
  switch (input.phase) {
    case "before_proof":
      return { kind: "send_proof", channel: input.proofChannel };
    case "awaiting_verification":
      return { kind: "await_verification" };
    case "verified":
      return { kind: "reveal_in_secure_display", service: "koxo" };
    case "lookup_failed":
      return { kind: "open_referral", service: REFERENT_NUMERIQUE, reasonCode: "koxo_code_not_found" };
  }
}

// ---------------------------------------------------------------------------
// Messagerie académique — seul l'email est vérifiable ; les autres cas
// passent par le formulaire enrichi. Il n'y a ici aucun code à remettre :
// une preuve email réussie ne fait que confirmer l'identité, jamais
// n'affiche l'identifiant académique unique.
// ---------------------------------------------------------------------------

export type MessagerieAcademiquePhase = "before_proof" | "awaiting_verification" | "verified";

export function decideMessagerieAcademiqueJourneyStep(input: {
  emailVerifiable: boolean;
  phase: MessagerieAcademiquePhase;
}): CodeVaultJourneyAction {
  if (!input.emailVerifiable) {
    return { kind: "form_fallback", reasonCode: "messagerie_academique_email_not_verifiable" };
  }
  switch (input.phase) {
    case "before_proof":
      return { kind: "send_proof", channel: "email" };
    case "awaiting_verification":
      return { kind: "await_verification" };
    case "verified":
      return { kind: "confirm_academic_email_only" };
  }
}

/**
 * Ce que le modèle a le droit de savoir sur une consultation « messagerie
 * académique ». Comme `ModelVisibleVaultFact` dans `code-vault-policy.ts`,
 * ce type est construit par une liste explicite de champs : il n'existe
 * structurellement aucun champ capable de porter l'identifiant académique
 * unique, qui reste interne et chiffré.
 */
export type ModelVisibleMessagerieAcademiqueFact = {
  emailVerifiable: boolean;
  emailVerified: boolean;
  status: "confirmed" | "form_fallback" | "pending";
};

export function buildModelVisibleMessagerieAcademiqueFact(input: {
  emailVerifiable: boolean;
  emailVerified: boolean;
  status: "confirmed" | "form_fallback" | "pending";
}): ModelVisibleMessagerieAcademiqueFact {
  return {
    emailVerifiable: input.emailVerifiable,
    emailVerified: input.emailVerified,
    status: input.status,
  };
}
