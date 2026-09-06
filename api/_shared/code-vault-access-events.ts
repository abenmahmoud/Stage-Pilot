// Journal d'accès du coffre de codes — LOT 3 du plan du 6 septembre 2026
// (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`). Écrit dans
// `code_vault_access_events`, jamais de valeur ni de fragment de valeur : la
// forme de la table ne porte structurellement aucune colonne capable d'en
// recevoir une (voir `supabase/migrations/20260905170000_create_code_vault.sql`).
// Ce module se contente de traduire un `VaultActor` (`shared/code-vault-policy.ts`)
// et une décision en une ligne du journal ; il n'invente aucune règle.

import { sql } from "drizzle-orm";
import type {
  VaultAccessRefusalReason,
  VaultActor,
} from "../../shared/code-vault-policy.js";
import type { VaultTx } from "./code-vault-assignment.js";

export const VAULT_ACCESS_EVENT_TYPES = [
  "consult",
  "activation_confirmed",
  "authorized_validation",
  "access_denied",
] as const;
export type VaultAccessEventType = (typeof VAULT_ACCESS_EVENT_TYPES)[number];

function actorPersonRefOf(actor: VaultActor): string | null {
  return "personRef" in actor ? actor.personRef : null;
}

/**
 * Insère une ligne d'événement, jamais une mise à jour ni une suppression —
 * la table est en lecture seule après écriture côté base
 * (`code_vault_access_events_append_only_trigger`). `refusalReason` doit être
 * fourni si et seulement si `eventType` vaut `access_denied` : c'est la même
 * règle que la contrainte SQL, vérifiée ici aussi pour échouer tôt côté
 * application plutôt que de compter sur le rejet en base.
 */
export async function recordVaultAccessEvent(
  tx: VaultTx,
  params: {
    institutionId: string;
    assignmentId: string | null;
    actor: VaultActor;
    eventType: VaultAccessEventType;
    refusalReason?: VaultAccessRefusalReason | null;
  }
): Promise<void> {
  const refusalReason = params.refusalReason ?? null;
  if ((params.eventType === "access_denied") !== (refusalReason !== null)) {
    throw new Error("code_vault_access_event_refusal_reason_inconsistent");
  }
  await tx.execute(sql`
    insert into public.code_vault_access_events
      (institution_id, assignment_id, actor_person_ref, actor_profile, event_type, refusal_reason)
    values (
      ${params.institutionId}, ${params.assignmentId}, ${actorPersonRefOf(params.actor)},
      ${params.actor.profile}, ${params.eventType}, ${refusalReason}
    )
  `);
}
