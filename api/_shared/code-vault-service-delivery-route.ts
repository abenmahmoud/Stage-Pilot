// Assemblage des parcours « cantine » et « koxo » du coffre de codes —
// LOT 4 du plan du 6 septembre 2026
// (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`). Même montage que
// `api/_shared/code-vault-ent-inactif-route.ts` (LOT 3) — `decideVaultAccess`
// puis `getOrCreateVaultAssignment` puis `recordVaultCodeDisplay`, journal à
// chaque décision — factorisé ici parce que « cantine » et « koxo » partagent
// exactement la même forme de parcours (`ProofBackedJourneyPhase`,
// `shared/code-vault-journeys.ts`) : seules les fonctions de décision
// (`decideCantineJourneyStep` / `decideKoxoJourneyStep`) et le service cible
// diffèrent. Dupliquer le fichier LOT 3 tel quel aurait recopié la même
// assemblage deux fois pour une seule différence réelle.
//
// Différence avec le LOT 3, propre à ces deux parcours : `lookup_failed`
// (badge cantine introuvable, code Koxo introuvable) ne renvoie plus
// seulement une action pure — ce module l'enchaîne sur
// `createVaultEscalationTicket` (`api/_shared/code-vault-support-escalation.ts`)
// pour ouvrir un vrai ticket dans la file support existante, jamais une
// décision qui reste sans suite (plan §LOT 4 : « doit créer un vrai ticket »).
//
// `code_vault_access_events` reste le journal des décisions d'accès et des
// remises (refus, consultation) — pas de l'escalade support elle-même : une
// escalade n'est pas un refus (`decideVaultAccess` a autorisé l'accès, c'est
// la recherche de la ressource qui a échoué), et aucun des quatre types
// d'événement du LOT 3 (`consult`, `activation_confirmed`,
// `authorized_validation`, `access_denied`) ne décrit correctement une
// ouverture de ticket. La preuve d'une escalade reste dans
// `support_requests`/`support_events`, la table faite pour ça.
//
// Toujours un self-service dans ce lot (élève, ou professeur sur son propre
// compte Koxo) : la remise déléguée (professeur principal → élève, service →
// tiers) reste hors périmètre — `decideVaultAccess` l'autorise déjà en pur
// (§7), mais aucune donnée réelle du dépôt ne permet de vérifier
// `cantineAvailabilityValidated` ou l'absence de code actif déjà détenu par
// un professeur principal (aucune table ne porte cette information
// aujourd'hui) : construire ces routes reviendrait à promettre une
// vérification qui n'existe pas. Documenté ici plutôt qu'inventé.

import {
  decideVaultAccess,
  isVaultDisplayStillVisible,
  type VaultAccessRefusalReason,
  type VaultAccessTarget,
  type VaultActor,
} from "../../shared/code-vault-policy.js";
import {
  VAULT_PROOF_CHANNELS,
  decideCantineJourneyStep,
  decideKoxoJourneyStep,
  type CodeVaultJourneyAction,
  type ProofBackedJourneyPhase,
  type VaultProofChannel,
} from "../../shared/code-vault-journeys.js";
import { getOrCreateVaultAssignment, recordVaultCodeDisplay, type VaultTx } from "./code-vault-assignment.js";
import { recordVaultAccessEvent } from "./code-vault-access-events.js";
import { CURRENT_VAULT_ASSIGNMENT_VERSION } from "./code-vault-ent-inactif-route.js";
import { createVaultEscalationTicket } from "./code-vault-support-escalation.js";

export { CURRENT_VAULT_ASSIGNMENT_VERSION };

export const SERVICE_DELIVERY_JOURNEY_TYPES = ["cantine", "koxo"] as const;
export type ServiceDeliveryJourneyType = (typeof SERVICE_DELIVERY_JOURNEY_TYPES)[number];

const SERVICE_DELIVERY_PHASES = [
  "before_proof",
  "awaiting_verification",
  "verified",
  "lookup_failed",
] as const satisfies readonly ProofBackedJourneyPhase[];

export type ServiceDeliveryRequestInput = {
  phase: ProofBackedJourneyPhase;
  proofChannel: VaultProofChannel;
  schoolYear: string;
};

function plainObject(value: unknown, errorCode: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(errorCode);
  }
  return value as Record<string, unknown>;
}

/** Validation stricte à la frontière, identique dans sa forme à `parseEntInactifRequestInput` (LOT 3). */
export function parseServiceDeliveryRequestInput(
  journeyType: ServiceDeliveryJourneyType,
  value: unknown
): ServiceDeliveryRequestInput {
  const prefix = journeyType;
  const input = plainObject(value, `${prefix}_input_invalid`);
  const expectedKeys = ["phase", "proofChannel", "schoolYear"];
  const keys = Object.keys(input);
  if (keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key))) {
    throw new Error(`${prefix}_input_invalid`);
  }
  if (typeof input.phase !== "string" || !SERVICE_DELIVERY_PHASES.includes(input.phase as ProofBackedJourneyPhase)) {
    throw new Error(`${prefix}_phase_invalid`);
  }
  if (
    typeof input.proofChannel !== "string" ||
    !VAULT_PROOF_CHANNELS.includes(input.proofChannel as VaultProofChannel)
  ) {
    throw new Error(`${prefix}_proof_channel_invalid`);
  }
  if (typeof input.schoolYear !== "string" || !/^[0-9]{4}-[0-9]{4}$/.test(input.schoolYear)) {
    throw new Error(`${prefix}_school_year_invalid`);
  }
  return {
    phase: input.phase as ProofBackedJourneyPhase,
    proofChannel: input.proofChannel as VaultProofChannel,
    schoolYear: input.schoolYear,
  };
}

export type ServiceDeliveryRouteInput = {
  journeyType: ServiceDeliveryJourneyType;
  actor: VaultActor;
  target: VaultAccessTarget;
  phase: ProofBackedJourneyPhase;
  proofChannel: VaultProofChannel;
  schoolYear: string;
  now: Date;
  /** Cantine du professeur pour lui-même : « selon disponibilité validée » (§7). Non branché dans ce lot, voir en-tête. */
  cantineAvailabilityValidated?: boolean;
};

export type ServiceDeliveryRouteResult =
  | { outcome: "denied"; reason: VaultAccessRefusalReason }
  | { outcome: "step"; action: CodeVaultJourneyAction }
  | { outcome: "displayed"; remainingDisplaysToday: number; revealedAt: string }
  | { outcome: "escalated"; publicCode: string };

function decideJourneyStep(
  journeyType: ServiceDeliveryJourneyType,
  input: { phase: ProofBackedJourneyPhase; proofChannel: VaultProofChannel }
): CodeVaultJourneyAction {
  return journeyType === "cantine" ? decideCantineJourneyStep(input) : decideKoxoJourneyStep(input);
}

export async function handleServiceDeliveryVaultRequest(
  tx: VaultTx,
  input: ServiceDeliveryRouteInput
): Promise<ServiceDeliveryRouteResult> {
  const decision = decideVaultAccess({
    actor: input.actor,
    target: input.target,
    cantineAvailabilityValidated: input.cantineAvailabilityValidated,
  });
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

  const action = decideJourneyStep(input.journeyType, {
    phase: input.phase,
    proofChannel: input.proofChannel,
  });

  if (action.kind === "open_referral") {
    const ticket = await createVaultEscalationTicket(tx, {
      institutionId: input.target.institutionId,
      actor: input.actor,
      service: action.service,
      journeyType: input.journeyType,
      reasonCode: action.reasonCode,
      subjectPersonRef: input.target.subjectPersonRef,
    });
    return { outcome: "escalated", publicCode: ticket.publicCode };
  }

  if (action.kind !== "reveal_in_secure_display") {
    return { outcome: "step", action };
  }

  // Même garde défensive qu'`api/_shared/code-vault-ent-inactif-route.ts`
  // (LOT 3) : structurellement inatteignable par les routes construites par
  // ce lot (toujours `subjectKind: "self"`), gardée pour la réutilisabilité
  // du module.
  if (input.target.subjectPersonRef === null) {
    throw new Error(`${input.journeyType}_subject_person_ref_required`);
  }

  const assignment = await getOrCreateVaultAssignment(tx, {
    institutionId: input.target.institutionId,
    personRef: input.target.subjectPersonRef,
    service: input.journeyType,
    schoolYear: input.schoolYear,
    version: CURRENT_VAULT_ASSIGNMENT_VERSION,
  });

  await recordVaultAccessEvent(tx, {
    institutionId: input.target.institutionId,
    assignmentId: assignment.id,
    actor: input.actor,
    eventType: "consult",
  });

  // `tx.execute` renvoie une colonne `timestamptz` en chaîne, jamais en
  // `Date` — même piège documenté par le LOT 3
  // (`api/_shared/code-vault-ent-inactif-route.ts`) : reconversion explicite
  // avant toute comparaison.
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
      action: { kind: "form_fallback", reasonCode: `${input.journeyType}_daily_quota_exceeded` },
    };
  }
  // outcome === "defective" : comme le LOT 3, structurellement inatteignable
  // dans ce lot (aucune route n'appelle `flagVaultCodeDefective`).
  return {
    outcome: "step",
    action: { kind: "form_fallback", reasonCode: `${input.journeyType}_code_defective` },
  };
}
