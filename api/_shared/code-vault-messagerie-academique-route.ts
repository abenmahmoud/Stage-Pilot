// Assemblage du parcours « messagerie académique » du coffre — LOT 4 du plan
// du 6 septembre 2026 (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`).
//
// Différence structurelle avec `code-vault-ent-inactif-route.ts` (LOT 3) et
// `code-vault-service-delivery-route.ts` (LOT 4) : ce parcours ne remet
// jamais de code (rappel du plan : « ne lui invente pas une remise »), donc
// aucune notion de cible (`VaultAccessTarget`), d'attribution
// (`code_vault_assignments`) ni de quota d'affichage n'entre en jeu.
// `messagerie_academique` n'est d'ailleurs pas un `VaultService` (voir
// `shared/code-vault-policy.ts`, qui ne connaît que `ent`, `cantine`,
// `koxo`) : `decideVaultAccess` ne s'applique donc pas ici. Le parcours est
// par construction toujours un self-service — seul l'email déjà au dossier
// de l'appelant est en jeu, jamais celui d'un tiers — donc il n'existe
// aucune décision d'autorisation à journaliser en cas de refus : le seul
// événement versé au journal commun (`code_vault_access_events`) est la
// confirmation elle-même.
//
// `emailVerifiable` reste, comme `phase` dans le LOT 3, une déclaration de
// l'appelant plutôt qu'une vérification réelle : le mécanisme réel
// (`api/identity/device/{request,verify}.ts`) est désactivé par
// `IDENTITY_DEVICE_ACCESS_ENABLED` (`CLAUDE.md`), et
// `shared/identity-directory-lookup.ts` sert une recherche d'agent support
// sur un tiers, pas un contrôle de vérifiabilité de son propre email — même
// limite déjà posée par le LOT 3, pas une régression introduite ici.

import type { VaultActor } from "../../shared/code-vault-policy.js";
import {
  decideMessagerieAcademiqueJourneyStep,
  type CodeVaultJourneyAction,
  type MessagerieAcademiquePhase,
} from "../../shared/code-vault-journeys.js";
import { recordVaultAccessEvent } from "./code-vault-access-events.js";
import type { VaultTx } from "./code-vault-assignment.js";

const MESSAGERIE_ACADEMIQUE_PHASES = [
  "before_proof",
  "awaiting_verification",
  "verified",
] as const satisfies readonly MessagerieAcademiquePhase[];

export type MessagerieAcademiqueRequestInput = {
  phase: MessagerieAcademiquePhase;
  emailVerifiable: boolean;
};

function plainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("messagerie_academique_input_invalid");
  }
  return value as Record<string, unknown>;
}

/** Validation stricte à la frontière, même forme que `parseEntInactifRequestInput` (LOT 3). */
export function parseMessagerieAcademiqueRequestInput(value: unknown): MessagerieAcademiqueRequestInput {
  const input = plainObject(value);
  const expectedKeys = ["phase", "emailVerifiable"];
  const keys = Object.keys(input);
  if (keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key))) {
    throw new Error("messagerie_academique_input_invalid");
  }
  if (
    typeof input.phase !== "string" ||
    !MESSAGERIE_ACADEMIQUE_PHASES.includes(input.phase as MessagerieAcademiquePhase)
  ) {
    throw new Error("messagerie_academique_phase_invalid");
  }
  if (typeof input.emailVerifiable !== "boolean") {
    throw new Error("messagerie_academique_email_verifiable_invalid");
  }
  return {
    phase: input.phase as MessagerieAcademiquePhase,
    emailVerifiable: input.emailVerifiable,
  };
}

export type MessagerieAcademiqueRouteInput = {
  institutionId: string;
  actor: VaultActor;
  phase: MessagerieAcademiquePhase;
  emailVerifiable: boolean;
};

export type MessagerieAcademiqueRouteResult =
  | { outcome: "step"; action: CodeVaultJourneyAction }
  | { outcome: "confirmed" };

export async function handleMessagerieAcademiqueVaultRequest(
  tx: VaultTx,
  input: MessagerieAcademiqueRouteInput
): Promise<MessagerieAcademiqueRouteResult> {
  const action = decideMessagerieAcademiqueJourneyStep({
    emailVerifiable: input.emailVerifiable,
    phase: input.phase,
  });

  if (action.kind !== "confirm_academic_email_only") {
    return { outcome: "step", action };
  }

  // Journalisé dans le même journal que les LOT 3/4, comme le demande le
  // plan (« sur la même route et le même journal ») : aucune valeur (ni
  // l'email lui-même) n'est portée par cet événement.
  await recordVaultAccessEvent(tx, {
    institutionId: input.institutionId,
    assignmentId: null,
    actor: input.actor,
    eventType: "consult",
  });
  return { outcome: "confirmed" };
}
