// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
// Recette du LOT 1 (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`)
// sur PostgreSQL réel jetable. Établissement et attribution entièrement
// fictifs. Jamais `--linked`, jamais `db push`, jamais d'URL distante.
//
// Prouve que `writeVaultCodeValue` (le point d'écriture unique) écrit
// réellement une valeur chiffrée exploitable dans `code_vault_private_rows`,
// que la valeur en clair n'apparaît jamais dans la ligne stockée ni dans la
// sortie du script, et qu'une deuxième tentative sur la même attribution est
// rejetée par la contrainte d'unicité réelle de la table — pas seulement par
// une hypothèse sur son comportement.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { writeVaultCodeValue } from "../api/_shared/code-vault-write.ts";
import { decryptVaultCodeValue } from "../shared/code-vault-crypto.ts";

if (process.argv.length !== 3 || process.argv[2] !== "--local-stack-only") {
  throw new Error("local_stack_confirmation_required");
}

const capturedOutput = [];
const originalConsoleLog = console.log.bind(console);
const originalConsoleError = console.error.bind(console);
console.log = (...args) => {
  capturedOutput.push(args.map(String).join(" "));
  originalConsoleLog(...args);
};
console.error = (...args) => {
  capturedOutput.push(args.map(String).join(" "));
  originalConsoleError(...args);
};

const CODE_VALUE = `LOT1-FICTIF-${randomUUID()}`;
const testEnv = {
  CODE_VAULT_ENCRYPTION_KEY_VERSION: "v1",
  CODE_VAULT_ENCRYPTION_KEY_V1: randomBytes(32).toString("base64"),
};

const client = postgres({
  host: "127.0.0.1",
  port: 54322,
  database: "postgres",
  user: "postgres",
  password: "postgres",
  max: 1,
  prepare: false,
  connect_timeout: 5,
});
const database = drizzle(client);
let assertions = 0;
const check = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  assertions++;
};

const rollback = new Error("intentional_fixture_rollback");
const institutionId = randomUUID();

try {
  await database.transaction(async (tx) => {
    await tx.execute(sql`
      insert into public.institutions (id, slug, name, status)
      values (${institutionId}, ${`coffre-lot1-${institutionId}`}, 'Lycée fictif LOT 1', 'draft')
    `);
    const [assignment] = await tx.execute(sql`
      insert into public.code_vault_assignments
        (institution_id, person_ref, service, school_year, version)
      values (${institutionId}, 'eleve-lot1-ecriture', 'koxo', '2026-2027', 1)
      returning id
    `);

    await writeVaultCodeValue(tx, {
      assignmentId: assignment.id,
      institutionId,
      value: CODE_VALUE,
      env: testEnv,
    });

    const [storedRow] = await tx.execute(sql`
      select key_version, payload_schema, iv, auth_tag, ciphertext
      from public.code_vault_private_rows
      where assignment_id = ${assignment.id} and institution_id = ${institutionId}
    `);
    check(Boolean(storedRow), true, "une_ligne_chiffree_a_ete_ecrite");
    check(storedRow.ciphertext.includes(CODE_VALUE), false, "le_chiffre_ne_contient_jamais_la_valeur_en_clair");

    const decrypted = decryptVaultCodeValue({
      envelope: {
        keyVersion: storedRow.key_version,
        payloadSchema: storedRow.payload_schema,
        iv: storedRow.iv,
        authTag: storedRow.auth_tag,
        ciphertext: storedRow.ciphertext,
      },
      institutionId,
      assignmentId: assignment.id,
      key: Buffer.from(testEnv.CODE_VAULT_ENCRYPTION_KEY_V1, "base64"),
    });
    check(decrypted, CODE_VALUE, "le_dechiffrement_retrouve_exactement_la_valeur_ecrite");

    // Deuxième écriture sur la même attribution : rejetée par la contrainte
    // d'unicité réelle de la table (`unique (assignment_id, institution_id)`),
    // pas par une hypothèse sur le comportement de `writeVaultCodeValue`. Un
    // point de sauvegarde est nécessaire : Postgres abandonne le reste de la
    // transaction après une erreur tant qu'on n'y revient pas explicitement.
    await tx.execute(sql`savepoint before_duplicate_write_attempt`);
    await assert.rejects(
      () =>
        writeVaultCodeValue(tx, {
          assignmentId: assignment.id,
          institutionId,
          value: `${CODE_VALUE}-second`,
          env: testEnv,
        }),
      (error) =>
        (error?.cause?.message ?? error?.message ?? String(error)).includes(
          "duplicate key value violates unique constraint"
        ),
      "deuxieme_ecriture_sur_la_meme_attribution_rejetee_par_la_contrainte_unique"
    );
    assertions++;
    await tx.execute(sql`rollback to savepoint before_duplicate_write_attempt`);

    const [{ count: rowCount }] = await tx.execute(sql`
      select count(*)::integer as count from public.code_vault_private_rows
      where assignment_id = ${assignment.id} and institution_id = ${institutionId}
    `);
    check(rowCount, 1, "toujours_une_seule_ligne_chiffree_apres_le_rejet");

    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await client.end();
}

const verifier = postgres({
  host: "127.0.0.1",
  port: 54322,
  database: "postgres",
  user: "postgres",
  password: "postgres",
  max: 1,
  connect_timeout: 5,
});
try {
  const [{ count: traceCount }] = await verifier`
    select count(*)::integer as count from public.institutions where id = ${institutionId}
  `;
  check(traceCount, 0, "rollback_laisse_aucune_trace");
} finally {
  await verifier.end();
}

console.log = originalConsoleLog;
console.error = originalConsoleError;
const leaked = capturedOutput.filter((line) => line.includes(CODE_VALUE));
check(leaked, [], "la_valeur_en_clair_napparait_dans_aucune_ligne_de_sortie_capturee");

console.log(
  JSON.stringify(
    { target: "127.0.0.1:54322", assertions, rollbackVerified: true, realData: false },
    null,
    2
  )
);
