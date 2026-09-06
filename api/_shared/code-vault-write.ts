// Point d'écriture unique du chiffré du coffre de codes — LOT 1 du plan du
// 6 septembre 2026 (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`).
//
// C'EST ICI, ET NULLE PART AILLEURS DANS `api/`, `shared/` OU `workers/`, QUE
// `insert into public.code_vault_private_rows` DOIT APPARAÎTRE.
//
// Aucune contrainte SQL ne peut distinguer un chiffré d'un mot qui ressemble
// à du base64 : `code_vault_private_rows_ciphertext_check` ne vérifie que la
// forme (16 à 512 caractères base64), pas le contenu. Un code en clair de
// seize caractères alphanumériques la franchirait donc sans être chiffré.
// C'est le seul endroit du coffre où le principe « la contrainte, pas la
// discipline » ne tient pas : la garantie vient ici de ce point de passage
// unique, pas de la base. `scripts/test-code-vault-write-point.mjs` échoue
// si une seconde écriture apparaît ailleurs dans le dépôt applicatif.
//
// Tant qu'aucune route n'appelle `writeVaultCodeValue`, aucune route n'écrit
// dans `code_vault_private_rows` — c'est la garantie que ce lot pose avant
// que la première route réelle (LOT 3) n'existe.

import { sql } from "drizzle-orm";
import {
  codeVaultCryptoConfig,
  encryptVaultCodeValue,
} from "../../shared/code-vault-crypto.js";
import { sanitizePgError, SanitizedPgWriteError } from "../../shared/code-vault-pg-error.js";
import type { VaultTx } from "./code-vault-assignment.js";

/**
 * Chiffre `value` et l'écrit dans `code_vault_private_rows`, dans la même
 * transaction que l'appelant (`tx`). Ne renvoie et ne journalise jamais la
 * valeur reçue. Un deuxième appel sur la même attribution est rejeté par la
 * contrainte d'unicité réelle de la table (`unique (assignment_id,
 * institution_id)`) : ce module ne tente aucun `on conflict`, un remplacement
 * de valeur passe par une nouvelle version d'attribution
 * (`traceManualVaultCodeReplacement`), jamais par une réécriture silencieuse
 * de cette ligne.
 */
export async function writeVaultCodeValue(
  tx: VaultTx,
  params: {
    assignmentId: string;
    institutionId: string;
    value: string;
    env?: NodeJS.ProcessEnv;
  }
): Promise<void> {
  const config = codeVaultCryptoConfig(params.env ?? process.env);
  const envelope = encryptVaultCodeValue({
    value: params.value,
    institutionId: params.institutionId,
    assignmentId: params.assignmentId,
    config,
  });
  try {
    await tx.execute(sql`
      insert into public.code_vault_private_rows
        (institution_id, assignment_id, key_version, payload_schema, iv, auth_tag, ciphertext)
      values (
        ${params.institutionId}, ${params.assignmentId}, ${envelope.keyVersion},
        ${envelope.payloadSchema}, ${envelope.iv}, ${envelope.authTag}, ${envelope.ciphertext}
      )
    `);
  } catch (error: unknown) {
    // LOT 2 : ne jamais laisser remonter l'erreur Postgres entière — son
    // `detail` répéterait la ligne refusée en clair. Voir
    // `shared/code-vault-pg-error.ts`.
    throw new SanitizedPgWriteError(sanitizePgError(error));
  }
}
