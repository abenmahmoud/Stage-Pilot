// Assemblage de la première route réelle du coffre — LOT 3 du plan du
// 6 septembre 2026 (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`).
// Enchaîne, sans en réécrire aucune, trois fonctions déjà recettées :
// `decideVaultAccess` (§7, `shared/code-vault-policy.ts`),
// `getOrCreateVaultAssignment` puis `recordVaultCodeDisplay`
// (`api/_shared/code-vault-assignment.ts`) — et journalise chaque décision,
// refus compris, dans `code_vault_access_events`
// (`api/_shared/code-vault-access-events.ts`).
//
// Deux garanties posées ici, et nulle part ailleurs (ni dans le contrat pur,
// ni dans le module d'attribution) :
//
// - une remise déjà expirée (`isVaultDisplayStillVisible` redevenu faux)
//   n'est jamais re-remise sur la seule foi d'une phase `verified` déclarée
//   par l'appelant : la route renvoie alors la personne à `before_proof`,
//   quelle que soit la phase reçue en entrée. Sans ce garde-fou, une
//   attribution remise il y a longtemps ressortirait sans aucun signal dès
//   que le quota du jour redevient disponible (cf. plan §LOT 3) ;
// - le quatrième affichage refusé le même jour (`quota_exceeded`) bascule
//   sur le formulaire enrichi (`form_fallback`, déjà défini dans
//   `shared/code-vault-journeys.ts` mais jusqu'ici jamais invoqué), il ne
//   remonte jamais comme une erreur brute.
//
// Ce module ne déchiffre et ne renvoie jamais la valeur du code : il
// s'arrête à la décision d'autorisation, à l'attribution et à la
// comptabilité d'affichage. La lecture de `code_vault_private_rows` reste
// hors périmètre de ce lot (aucune fonction de ce module n'importe
// `shared/code-vault-crypto.ts`).

import {
  decideVaultAccess,
  isVaultDisplayStillVisible,
  type VaultAccessRefusalReason,
  type VaultAccessTarget,
  type VaultActor,
} from "../../shared/code-vault-policy.js";
import {
  VAULT_PROOF_CHANNELS,
  decideEntInactifJourneyStep,
  type CodeVaultJourneyAction,
  type EntInactifPhase,
  type VaultProofChannel,
} from "../../shared/code-vault-journeys.js";
import { getOrCreateVaultAssignment, recordVaultCodeDisplay, type VaultTx } from "./code-vault-assignment.js";
import { recordVaultAccessEvent } from "./code-vault-access-events.js";

/** Aucun remplacement pour ce lot (`traceManualVaultCodeReplacement` reste hors périmètre) : toujours la première version. */
export const CURRENT_VAULT_ASSIGNMENT_VERSION = 1;

const ENT_INACTIF_PHASES = [
  "before_proof",
  "awaiting_verification",
  "verified",
  "revealed",
] as const satisfies readonly EntInactifPhase[];

export type EntInactifRequestInput = {
  phase: EntInactifPhase;
  proofChannel: VaultProofChannel;
  schoolYear: string;
};

function plainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("ent_inactif_input_invalid");
  }
  return value as Record<string, unknown>;
}

/** Validation stricte à la frontière : champs exacts, aucun champ inconnu toléré. */
export function parseEntInactifRequestInput(value: unknown): EntInactifRequestInput {
  const input = plainObject(value);
  const expectedKeys = ["phase", "proofChannel", "schoolYear"];
  const keys = Object.keys(input);
  if (keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key))) {
    throw new Error("ent_inactif_input_invalid");
  }
  if (typeof input.phase !== "string" || !ENT_INACTIF_PHASES.includes(input.phase as EntInactifPhase)) {
    throw new Error("ent_inactif_phase_invalid");
  }
  if (
    typeof input.proofChannel !== "string" ||
    !VAULT_PROOF_CHANNELS.includes(input.proofChannel as VaultProofChannel)
  ) {
    throw new Error("ent_inactif_proof_channel_invalid");
  }
  if (typeof input.schoolYear !== "string" || !/^[0-9]{4}-[0-9]{4}$/.test(input.schoolYear)) {
    throw new Error("ent_inactif_school_year_invalid");
  }
  return {
    phase: input.phase as EntInactifPhase,
    proofChannel: input.proofChannel as VaultProofChannel,
    schoolYear: input.schoolYear,
  };
}

export type EntInactifRouteInput = {
  actor: VaultActor;
  target: VaultAccessTarget;
  phase: EntInactifPhase;
  proofChannel: VaultProofChannel;
  schoolYear: string;
  now: Date;
};

export type EntInactifRouteResult =
  | { outcome: "denied"; reason: VaultAccessRefusalReason }
  | { outcome: "step"; action: CodeVaultJourneyAction }
  | { outcome: "displayed"; remainingDisplaysToday: number; revealedAt: string };

export async function handleEntInactifVaultRequest(
  tx: VaultTx,
  input: EntInactifRouteInput
): Promise<EntInactifRouteResult> {
  const decision = decideVaultAccess({ actor: input.actor, target: input.target });
  if (!decision.allowed) {
    await recordVaultAccessEvent(tx, {
      institutionId: input.target.institutionId,
      assignmentId: null,
      actor: input.actor,
      eventType: "access_denied",
      refusalReason: decision.reason,
    });
    return { outcome: "denied", reason: decision.reason };
  }

  const action = decideEntInactifJourneyStep({
    phase: input.phase,
    proofChannel: input.proofChannel,
  });
  if (action.kind !== "reveal_in_secure_display") {
    return { outcome: "step", action };
  }

  // `subjectPersonRef` est structurellement nul pour une cible
  // `institution_wide` : la remise « ENT inactif » est toujours un
  // self-service (`subjectKind: "self"`), jamais ce cas-là. Garde
  // défensive pour ce module réutilisable, pas un cas atteignable par la
  // route du LOT 3 telle qu'elle construit sa cible.
  if (input.target.subjectPersonRef === null) {
    throw new Error("ent_inactif_subject_person_ref_required");
  }

  const assignment = await getOrCreateVaultAssignment(tx, {
    institutionId: input.target.institutionId,
    personRef: input.target.subjectPersonRef,
    service: "ent",
    schoolYear: input.schoolYear,
    version: CURRENT_VAULT_ASSIGNMENT_VERSION,
  });

  // Journalisé avant même de savoir si l'affichage aboutit : une tentative
  // de consultation est un fait à journaliser en soi (T064, « journal sans
  // valeur secrète »), pas seulement son succès.
  await recordVaultAccessEvent(tx, {
    institutionId: input.target.institutionId,
    assignmentId: assignment.id,
    actor: input.actor,
    eventType: "consult",
  });

  // `tx.execute` renvoie les lignes brutes du pilote `postgres` : une colonne
  // `timestamptz` en ressort en chaîne, jamais en `Date` (même motif que
  // `scripts/test-local-code-vault-assignment.mjs`, qui doit lui aussi
  // repasser par `new Date(...)` avant toute comparaison). `revealed_at` doit
  // donc être reconverti ici avant d'être comparé.
  const previousRevealedAt = assignment.revealed_at === null ? null : new Date(assignment.revealed_at);
  const previousRevealExpired =
    previousRevealedAt !== null && !isVaultDisplayStillVisible(previousRevealedAt, input.now);
  if (previousRevealExpired) {
    return {
      outcome: "step",
      action: { kind: "send_proof", channel: input.proofChannel },
    };
  }

  const displayOutcome = await recordVaultCodeDisplay(tx, {
    assignmentId: assignment.id,
    institutionId: input.target.institutionId,
    now: input.now,
  });

  if (displayOutcome.outcome === "displayed") {
    return {
      outcome: "displayed",
      remainingDisplaysToday: displayOutcome.remainingDisplaysToday,
      revealedAt: displayOutcome.revealedAt.toISOString(),
    };
  }
  if (displayOutcome.outcome === "quota_exceeded") {
    return {
      outcome: "step",
      action: { kind: "form_fallback", reasonCode: "ent_inactif_daily_quota_exceeded" },
    };
  }
  // outcome === "defective" : structurellement inatteignable dans ce lot
  // (aucune route n'appelle encore `flagVaultCodeDefective`), gardé pour
  // l'exhaustivité du type et pour ne pas laisser un cas non couvert quand
  // une route de signalement existera.
  return {
    outcome: "step",
    action: { kind: "form_fallback", reasonCode: "ent_inactif_code_defective" },
  };
}
