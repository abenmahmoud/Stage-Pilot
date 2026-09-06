// Attribution et remise du coffre de codes — LOT 3 du plan du 5 septembre
// 2026. Ce module ne reçoit et ne produit jamais la valeur d'un code : il
// orchestre l'identité de l'attribution, le compteur d'affichage quotidien et
// le signalement défectueux sur le schéma chiffré du LOT 2. Le contrat pur
// (transitions, autorisation) reste dans `shared/code-vault-policy.ts`
// (LOT 1/3) ; ce module l'applique contre une vraie transaction Postgres.
//
// Volontairement agnostique de la connexion : chaque fonction reçoit un `tx`
// (transaction Drizzle en cours) plutôt que d'importer `db/index.ts`. Les
// routes API (hors périmètre du LOT 3) appelleront `db.transaction(tx => ...)`
// ; les scripts de recette locale construisent leur propre connexion, jamais
// distante (voir `scripts/test-local-code-vault-assignment.mjs`).

import { sql, type SQL } from "drizzle-orm";
import {
  decideVaultDisplayQuota,
  type VaultAssignmentIdentity,
  type VaultCodeStatus,
  type VaultService,
} from "../../shared/code-vault-policy.js";
import { parisDateStringOf } from "../../shared/paris-time.js";

export type VaultTx = {
  execute: (query: SQL) => Promise<unknown>;
};

function rowsOf<T>(result: unknown): T[] {
  return Array.from(result as unknown as T[]);
}

export type VaultAssignmentRow = {
  id: string;
  institution_id: string;
  person_ref: string;
  service: VaultService;
  school_year: string;
  version: number;
  status: VaultCodeStatus;
  revealed_at: Date | null;
  display_count: number;
  display_count_date: string | null;
  defective_flagged_at: Date | null;
  defective_reason: string | null;
  defective_flagged_by: string | null;
  replaced_by_assignment_id: string | null;
};

/**
 * Récupère l'attribution du quadruplet, ou la crée si elle n'existe pas
 * encore. `on conflict ... do update` pose un verrou de ligne même quand la
 * ligne existe déjà : deux appels concurrents sur le même quadruplet se
 * sérialisent dessus et retournent tous les deux le même identifiant, jamais
 * deux lignes distinctes (plan §LOT 3, « deux demandes concurrentes
 * retournent la même attribution »).
 */
export async function getOrCreateVaultAssignment(
  tx: VaultTx,
  identity: VaultAssignmentIdentity
): Promise<VaultAssignmentRow> {
  const result = await tx.execute(sql`
    insert into public.code_vault_assignments
      (institution_id, person_ref, service, school_year, version)
    values (
      ${identity.institutionId}, ${identity.personRef}, ${identity.service},
      ${identity.schoolYear}, ${identity.version}
    )
    on conflict (institution_id, person_ref, service, school_year, version)
    do update set person_ref = excluded.person_ref
    returning id, institution_id, person_ref, service, school_year, version,
              status, revealed_at, display_count, display_count_date,
              defective_flagged_at, defective_reason, defective_flagged_by,
              replaced_by_assignment_id
  `);
  const [row] = rowsOf<VaultAssignmentRow>(result);
  if (!row) throw new Error("code_vault_assignment_upsert_returned_no_row");
  return row;
}

export type VaultDisplayOutcome =
  | { outcome: "displayed"; revealedAt: Date; remainingDisplaysToday: number }
  | { outcome: "quota_exceeded" }
  | { outcome: "defective" };

/**
 * Enregistre une remise visible du code : verrouille la ligne, refuse si le
 * code est signalé défectueux (aucun affichage, même le premier, ne doit
 * jamais réactiver un code défectueux), applique le quota quotidien
 * (`decideVaultDisplayQuota`), sinon incrémente le compteur du jour et pose
 * `revealed_at` pour la fenêtre de visibilité de 30 minutes.
 */
export async function recordVaultCodeDisplay(
  tx: VaultTx,
  params: { assignmentId: string; institutionId: string; now: Date }
): Promise<VaultDisplayOutcome> {
  const locked = await tx.execute(sql`
    select display_count, display_count_date, defective_flagged_at
    from public.code_vault_assignments
    where id = ${params.assignmentId} and institution_id = ${params.institutionId}
    for update
  `);
  const [row] = rowsOf<{
    display_count: number;
    display_count_date: string | null;
    defective_flagged_at: Date | null;
  }>(locked);
  if (!row) throw new Error("code_vault_assignment_not_found");
  if (row.defective_flagged_at) return { outcome: "defective" };

  // LOT 6 : la journée du quota est celle de Paris, pas celle d'UTC — sinon
  // le compteur repart à 1 h ou 2 h du matin selon l'heure d'été/d'hiver au
  // lieu de minuit heure de Paris (défaut relevé par la cartographie OB1).
  const today = parisDateStringOf(params.now);
  const displayCountToday = row.display_count_date === today ? row.display_count : 0;
  const decision = decideVaultDisplayQuota({ displayCountToday });
  if (!decision.allowed) return { outcome: "quota_exceeded" };

  await tx.execute(sql`
    update public.code_vault_assignments
    set display_count = ${displayCountToday + 1},
        display_count_date = ${today},
        revealed_at = ${params.now.toISOString()}
    where id = ${params.assignmentId} and institution_id = ${params.institutionId}
  `);
  return {
    outcome: "displayed",
    revealedAt: params.now,
    remainingDisplaysToday: decision.remainingDisplaysToday,
  };
}

/**
 * Signale un code défectueux : attend une intervention humaine. Le
 * déclencheur `code_vault_assignment_defect_flag_is_immutable` (LOT 3, SQL)
 * empêche ensuite toute modification du signalement — il n'existe
 * structurellement aucune fonction de remplacement ou de réactivation
 * automatique dans ce module (voir `canAutoReplaceDefectiveVaultCode`).
 */
export async function flagVaultCodeDefective(
  tx: VaultTx,
  params: {
    assignmentId: string;
    institutionId: string;
    reason: string;
    flaggedByPersonRef: string;
    now: Date;
  }
): Promise<void> {
  await tx.execute(sql`
    update public.code_vault_assignments
    set defective_flagged_at = ${params.now.toISOString()},
        defective_reason = ${params.reason},
        defective_flagged_by = ${params.flaggedByPersonRef}
    where id = ${params.assignmentId} and institution_id = ${params.institutionId}
  `);
}

/**
 * Trace un remplacement humain (ex. code cantine fixe remplacé après
 * intervention) : crée la nouvelle version de l'attribution et pose le lien
 * `replaced_by_assignment_id` sur l'ancienne, dans la même transaction.
 * N'est jamais appelé automatiquement — réservé à une action administrative
 * explicite (hors périmètre du LOT 3, cf. clôture du plan).
 */
export async function traceManualVaultCodeReplacement(
  tx: VaultTx,
  params: {
    previousAssignmentId: string;
    nextIdentity: VaultAssignmentIdentity;
  }
): Promise<VaultAssignmentRow> {
  const next = await getOrCreateVaultAssignment(tx, params.nextIdentity);
  await tx.execute(sql`
    update public.code_vault_assignments
    set replaced_by_assignment_id = ${next.id}
    where id = ${params.previousAssignmentId}
      and institution_id = ${params.nextIdentity.institutionId}
  `);
  return next;
}
