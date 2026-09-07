// Assemblage du parcours « ENT actif » du coffre de codes — LOT 1 du plan du
// 6 septembre 2026 (`docs/operations/PLAN_ENT_ACTIF_ET_DETTE_2026-09-06.md`).
// T069 nomme cinq parcours ; les quatre autres sont branchés depuis le plan
// du 6 septembre 2026 (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`,
// LOT 3/4). Celui-ci manquait entièrement.
//
// Différence structurelle avec les quatre autres : ce parcours ne remet
// jamais de code (l'ENT est déjà actif, la personne a juste oublié son mot
// de passe), donc aucune notion d'attribution (`code_vault_assignments`), de
// quota d'affichage, ni de lecture chiffrée (`resolveVaultCodeReveal`)
// n'entre en jeu — comme `code-vault-messagerie-academique-route.ts` (LOT 4),
// pas comme `code-vault-ent-inactif-route.ts` (LOT 3). C'est précisément ce
// que documente l'en-tête de `decideEntActifJourneyStep`
// (`shared/code-vault-journeys.ts`) : la décision pure guide la
// réinitialisation du mot de passe et, en cas d'échec ou de coordonnée
// incorrecte, ouvre une demande au référent numérique — l'agent ne modifie
// jamais une coordonnée lui-même.
//
// `decideVaultAccess` (`shared/code-vault-policy.ts`) s'applique malgré
// l'absence d'attribution : la cible porte `service: "ent"`, la même matrice
// d'autorisation §7 (self-service élève/professeur) protège donc ce parcours
// que le parcours « ENT inactif ». Un refus est journalisé dans
// `code_vault_access_events`, comme les quatre autres parcours.
//
// Une réussite (`outcome: "succeeded"`) est le premier appelant réel de
// l'événement `activation_confirmed` (`code-vault-access-events.ts`) : les
// quatre parcours précédents ne remettent jamais que des codes (`consult`),
// jamais une confirmation d'activation.
//
// Un échec ou une coordonnée incorrecte ouvre un vrai ticket support via
// `createVaultEscalationTicket` (`api/_shared/code-vault-support-escalation.ts`,
// LOT 4), avec les deux `reasonCode` distincts du contrat pur
// (`ent_reset_failed`, `ent_coordinate_incorrect`) préservés tels quels.
// Comme pour `code-vault-service-delivery-route.ts` (LOT 4), l'escalade
// n'est pas journalisée dans `code_vault_access_events` : sa preuve vit dans
// `support_requests`/`support_events`, la table faite pour ça.

import {
  decideVaultAccess,
  type VaultAccessRefusalReason,
  type VaultAccessTarget,
  type VaultActor,
} from "../../shared/code-vault-policy.js";
import {
  decideEntActifJourneyStep,
  type CodeVaultJourneyAction,
  type EntActifOutcome,
} from "../../shared/code-vault-journeys.js";
import { recordVaultAccessEvent } from "./code-vault-access-events.js";
import type { VaultTx } from "./code-vault-assignment.js";
import { createVaultEscalationTicket } from "./code-vault-support-escalation.js";

const ENT_ACTIF_OUTCOMES = [
  "start",
  "succeeded",
  "failed",
  "coordinate_incorrect",
] as const satisfies readonly EntActifOutcome[];

export type EntActifRequestInput = {
  outcome: EntActifOutcome;
};

function plainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("ent_actif_input_invalid");
  }
  return value as Record<string, unknown>;
}

/** Validation stricte à la frontière, même forme que `parseEntInactifRequestInput` (LOT 3). */
export function parseEntActifRequestInput(value: unknown): EntActifRequestInput {
  const input = plainObject(value);
  const expectedKeys = ["outcome"];
  const keys = Object.keys(input);
  if (keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key))) {
    throw new Error("ent_actif_input_invalid");
  }
  if (typeof input.outcome !== "string" || !ENT_ACTIF_OUTCOMES.includes(input.outcome as EntActifOutcome)) {
    throw new Error("ent_actif_outcome_invalid");
  }
  return { outcome: input.outcome as EntActifOutcome };
}

export type EntActifRouteInput = {
  actor: VaultActor;
  target: VaultAccessTarget;
  outcome: EntActifOutcome;
};

export type EntActifRouteResult =
  | { outcome: "denied"; reason: VaultAccessRefusalReason }
  | { outcome: "step"; action: CodeVaultJourneyAction }
  | { outcome: "confirmed" }
  | { outcome: "escalated"; publicCode: string };

export async function handleEntActifVaultRequest(
  tx: VaultTx,
  input: EntActifRouteInput
): Promise<EntActifRouteResult> {
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

  const action = decideEntActifJourneyStep({ outcome: input.outcome });

  if (action.kind === "open_referral") {
    const ticket = await createVaultEscalationTicket(tx, {
      institutionId: input.target.institutionId,
      actor: input.actor,
      service: action.service,
      journeyType: "ent_actif",
      reasonCode: action.reasonCode,
      subjectPersonRef: input.target.subjectPersonRef,
    });
    return { outcome: "escalated", publicCode: ticket.publicCode };
  }

  if (action.kind === "done") {
    await recordVaultAccessEvent(tx, {
      institutionId: input.target.institutionId,
      assignmentId: null,
      actor: input.actor,
      eventType: "activation_confirmed",
    });
    return { outcome: "confirmed" };
  }

  // action.kind === "guide_password_reset" (outcome "start") : une étape pure,
  // jamais journalisée — même choix que les phases avant remise des quatre
  // autres parcours (`before_proof`, `awaiting_verification`), qui ne
  // touchent pas non plus la base.
  return { outcome: "step", action };
}
