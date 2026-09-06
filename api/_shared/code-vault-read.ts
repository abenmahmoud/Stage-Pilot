// Point de lecture unique du coffre de codes — LOT 1 du plan du 6 septembre
// 2026 (`docs/operations/PLAN_LECTURE_COFFRE_2026-09-06.md`). Symétrique de
// `api/_shared/code-vault-write.ts`.
//
// C'EST ICI, ET NULLE PART AILLEURS DANS `api/`, `shared/` OU `workers/`, QUE
// `from public.code_vault_private_rows` DOIT APPARAÎTRE DANS UN `select`.
// `scripts/test-code-vault-read-point.mjs` échoue si un second lecteur
// apparaît ailleurs dans le dépôt applicatif, exactement comme
// `scripts/test-code-vault-write-point.mjs` pour l'écriture.
//
// N'accepte pas un booléen fourni par l'appelant : exige le résultat déjà
// rendu par `recordVaultCodeDisplay` (`VaultDisplayOutcome`). Si la remise
// n'a pas été accordée — quota dépassé, code défectueux, ou tout autre motif
// futur — cette fonction renvoie `null` sans même interroger la table :
// aucun appelant ne peut donc obtenir de valeur sans être passé par la
// remise.
//
// Ne journalise jamais, ne construit aucun message contenant la valeur
// déchiffrée. Les erreurs Postgres sont sanitisées par
// `shared/code-vault-pg-error.ts` avant de remonter à l'appelant, sur le même
// principe que le point d'écriture : `detail` n'est jamais lu.

import { sql } from "drizzle-orm";
import {
  codeVaultCryptoConfig,
  decryptVaultCodeValue,
} from "../../shared/code-vault-crypto.js";
import { sanitizePgError, SanitizedPgReadError } from "../../shared/code-vault-pg-error.js";
import type { VaultDisplayOutcome, VaultTx } from "./code-vault-assignment.js";

function rowsOf<T>(result: unknown): T[] {
  return Array.from(result as unknown as T[]);
}

type VaultPrivateRow = {
  key_version: string;
  payload_schema: number;
  iv: string;
  auth_tag: string;
  ciphertext: string;
};

/**
 * Déchiffre la valeur d'un code, dans la même transaction (`tx`) que
 * l'appelant, uniquement si `displayOutcome` est le résultat réel d'un
 * `recordVaultCodeDisplay` accordé (`outcome: "displayed"`) sur la même
 * attribution. Tout autre `outcome` — `quota_exceeded`, `defective`, ou une
 * valeur future — renvoie `null` avant toute lecture de
 * `code_vault_private_rows`.
 */
export async function readVaultCodeValue(
  tx: VaultTx,
  params: {
    assignmentId: string;
    institutionId: string;
    displayOutcome: VaultDisplayOutcome;
    env?: NodeJS.ProcessEnv;
  }
): Promise<string | null> {
  if (params.displayOutcome.outcome !== "displayed") return null;

  const config = codeVaultCryptoConfig(params.env ?? process.env);

  let rows: VaultPrivateRow[];
  try {
    const result = await tx.execute(sql`
      select key_version, payload_schema, iv, auth_tag, ciphertext
      from public.code_vault_private_rows
      where assignment_id = ${params.assignmentId} and institution_id = ${params.institutionId}
    `);
    rows = rowsOf<VaultPrivateRow>(result);
  } catch (error: unknown) {
    // LOT 1 (lecture) : même garantie que LOT 2 (écriture) — jamais le
    // `detail` Postgres brut, qui répéterait la ligne en clair.
    throw new SanitizedPgReadError(sanitizePgError(error));
  }

  const [row] = rows;
  if (!row) return null;

  return decryptVaultCodeValue({
    envelope: {
      keyVersion: row.key_version,
      payloadSchema: row.payload_schema,
      iv: row.iv,
      authTag: row.auth_tag,
      ciphertext: row.ciphertext,
    },
    institutionId: params.institutionId,
    assignmentId: params.assignmentId,
    key: config.key,
  });
}

// LOT 2 du plan du 6 septembre 2026 (« Le drapeau, fermé ») : tant que
// `CODE_VAULT_REVEAL_ENABLED` n'est pas exactement `"true"`, aucune route ne
// doit pouvoir obtenir de valeur déchiffrée, même après une remise accordée.
// La comparaison stricte suit `readCommunicationFeatureFlags`
// (`api/_shared/communication-flags.ts`) : toute valeur autre que `"true"`
// ferme le drapeau, une configuration incomplète ou mal écrite ne l'ouvre
// jamais par accident.
export type VaultCodeRevealResult =
  | { value: string; reason: null }
  | { value: null; reason: "reveal_disabled" | "not_displayed" };

/**
 * Point d'entrée que les routes (LOT 3) devront appeler à la place de
 * `readVaultCodeValue` directement. Quand le drapeau est fermé, le parcours
 * reste complet mais `value` est toujours `null`, avec un motif explicite —
 * exactement le comportement d'aujourd'hui, sans lecture de
 * `code_vault_private_rows` ni tentative de déchiffrement.
 */
export async function resolveVaultCodeReveal(
  tx: VaultTx,
  params: {
    assignmentId: string;
    institutionId: string;
    displayOutcome: VaultDisplayOutcome;
    env?: NodeJS.ProcessEnv;
  }
): Promise<VaultCodeRevealResult> {
  const env = params.env ?? process.env;
  if (env.CODE_VAULT_REVEAL_ENABLED !== "true") {
    return { value: null, reason: "reveal_disabled" };
  }

  const value = await readVaultCodeValue(tx, params);
  if (value === null) return { value: null, reason: "not_displayed" };
  return { value, reason: null };
}
