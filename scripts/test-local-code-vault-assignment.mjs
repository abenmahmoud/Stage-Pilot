// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
// Recette du LOT 3 (attribution et remise du coffre de codes) sur PostgreSQL
// réel jetable. Personnes et établissement entièrement fictifs. Jamais
// `--linked`, jamais `db push`, jamais d'URL distante.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import {
  getOrCreateVaultAssignment,
  recordVaultCodeDisplay,
  flagVaultCodeDefective,
  traceManualVaultCodeReplacement,
} from "../api/_shared/code-vault-assignment.ts";
import { isVaultDisplayStillVisible } from "../shared/code-vault-policy.ts";

if (process.argv.length !== 3 || process.argv[2] !== "--local-stack-only") {
  throw new Error("local_stack_confirmation_required");
}

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

// Drizzle enveloppe l'erreur Postgres dans une `DrizzleQueryError` dont le
// message ne porte que la requête fautive ; le message Postgres attendu
// (nom du déclencheur qui a levé l'exception) vit dans `error.cause.message`.
async function rejectsWithPostgresError(run, expectedMessage, label) {
  await assert.rejects(
    run,
    (error) => (error?.cause?.message ?? error?.message ?? String(error)).includes(expectedMessage),
    label
  );
  assertions++;
}

async function insertFictitiousInstitution(tx, institutionId) {
  await tx.execute(sql`
    insert into public.institutions (id, slug, name, status)
    values (${institutionId}, ${`coffre-fictif-${institutionId}`}, 'Coffre fictif LOT 3', 'draft')
  `);
}

// ---------------------------------------------------------------------------
// Scénario 1 (§LOT 3) : deux demandes concurrentes retournent la même
// attribution, jamais deux. Nécessite deux VRAIES connexions Postgres
// distinctes (deux processus enfants), pas deux transactions sur la même
// connexion — ça se sérialiserait sans rien prouver.
// ---------------------------------------------------------------------------

const concurrencyInstitutionId = randomUUID();
await insertFictitiousInstitution(database, concurrencyInstitutionId);
const concurrentIdentity = {
  institutionId: concurrencyInstitutionId,
  personRef: "eleve-concurrence-01",
  service: "koxo",
  schoolYear: "2026-2027",
  version: 1,
};

const workerPath = fileURLToPath(
  new URL("./code-vault-assignment-concurrency-worker.mjs", import.meta.url)
);
const resolverPath = fileURLToPath(new URL("./ts-test-resolver.mjs", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const targetTimeMs = Date.now() + 500;

function runConcurrencyWorker() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--import",
        pathToFileURL(resolverPath).href,
        "--experimental-strip-types",
        workerPath,
        JSON.stringify(concurrentIdentity),
        String(targetTimeMs),
      ],
      { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => {
      if (code !== 0 && !stdout) {
        reject(new Error(`worker_failed:${code}:${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`worker_bad_output:${stdout}:${stderr}`));
      }
    });
  });
}

try {
  const [resultA, resultB] = await Promise.all([runConcurrencyWorker(), runConcurrencyWorker()]);
  check(resultA.ok, true, "worker_a_ok");
  check(resultB.ok, true, "worker_b_ok");
  check(resultA.id, resultB.id, "concurrent_requests_return_same_assignment");
  const [{ count: assignmentCount }] = await database.execute(sql`
    select count(*)::integer as count from public.code_vault_assignments
    where institution_id = ${concurrencyInstitutionId}
  `);
  check(assignmentCount, 1, "exactly_one_row_created");
} finally {
  await database.execute(
    sql`delete from public.code_vault_assignments where institution_id = ${concurrencyInstitutionId}`
  );
  await database.execute(
    sql`delete from public.institutions where id = ${concurrencyInstitutionId}`
  );
}

// ---------------------------------------------------------------------------
// Scénarios 2 à 5 (§LOT 3) : quota d'affichage quotidien, défectueux, trace
// de remplacement, contraintes. Tout dans une seule transaction annulée en
// fin de script (savepoint intentionnel), la base locale n'est pas polluée.
// ---------------------------------------------------------------------------

const rollback = new Error("intentional_fixture_rollback");
const institutionId = randomUUID();

try {
  await database.transaction(async (tx) => {
    await insertFictitiousInstitution(tx, institutionId);

    // Scénario 2 : trois affichages maximum par jour, le quatrième bascule
    // vers le formulaire.
    const identity = {
      institutionId,
      personRef: "eleve-quota-01",
      service: "ent",
      schoolYear: "2026-2027",
      version: 1,
    };
    const assignment = await getOrCreateVaultAssignment(tx, identity);
    const sameAssignment = await getOrCreateVaultAssignment(tx, identity);
    check(sameAssignment.id, assignment.id, "get_or_create_is_idempotent_within_one_connection");

    const day = new Date("2026-09-05T09:00:00.000Z");
    const first = await recordVaultCodeDisplay(tx, {
      assignmentId: assignment.id,
      institutionId,
      now: day,
    });
    check(first, { outcome: "displayed", revealedAt: day, remainingDisplaysToday: 2 });
    const second = await recordVaultCodeDisplay(tx, {
      assignmentId: assignment.id,
      institutionId,
      now: new Date(day.getTime() + 60_000),
    });
    check(second.outcome, "displayed");
    check(second.remainingDisplaysToday, 1);
    const third = await recordVaultCodeDisplay(tx, {
      assignmentId: assignment.id,
      institutionId,
      now: new Date(day.getTime() + 120_000),
    });
    check(third.outcome, "displayed");
    check(third.remainingDisplaysToday, 0);
    const fourth = await recordVaultCodeDisplay(tx, {
      assignmentId: assignment.id,
      institutionId,
      now: new Date(day.getTime() + 180_000),
    });
    check(fourth, { outcome: "quota_exceeded" }, "fourth_display_same_day_refused");

    const [afterQuota] = await tx.execute(sql`
      select display_count, display_count_date, revealed_at from public.code_vault_assignments
      where id = ${assignment.id}
    `);
    check(afterQuota.display_count, 3, "quota_refusal_does_not_increment_counter");

    // Fenêtre de visibilité de 30 minutes, vérifiée sur l'horodatage réel
    // stocké par la troisième remise.
    const revealedAt = new Date(afterQuota.revealed_at);
    check(isVaultDisplayStillVisible(revealedAt, new Date(revealedAt.getTime() + 60_000)), true);
    check(isVaultDisplayStillVisible(revealedAt, new Date(revealedAt.getTime() + 31 * 60_000)), false);

    // Un nouveau jour : le compteur repart de zéro.
    const nextDay = await recordVaultCodeDisplay(tx, {
      assignmentId: assignment.id,
      institutionId,
      now: new Date("2026-09-06T09:00:00.000Z"),
    });
    check(nextDay, {
      outcome: "displayed",
      revealedAt: new Date("2026-09-06T09:00:00.000Z"),
      remainingDisplaysToday: 2,
    });

    // Scénario 3 : un code défectueux attend une intervention humaine, aucun
    // affichage supplémentaire, aucune réactivation automatique.
    const defectiveIdentity = {
      institutionId,
      personRef: "eleve-defectueux-01",
      service: "cantine",
      schoolYear: "2026-2027",
      version: 1,
    };
    const defectiveAssignment = await getOrCreateVaultAssignment(tx, defectiveIdentity);
    await flagVaultCodeDefective(tx, {
      assignmentId: defectiveAssignment.id,
      institutionId,
      reason: "Badge cantine physiquement endommagé, code illisible.",
      flaggedByPersonRef: "intendance-01",
      now: day,
    });
    const displayAttempt = await recordVaultCodeDisplay(tx, {
      assignmentId: defectiveAssignment.id,
      institutionId,
      now: new Date(day.getTime() + 60_000),
    });
    check(displayAttempt, { outcome: "defective" }, "defective_code_blocks_display");
    const [afterDefectiveAttempt] = await tx.execute(sql`
      select display_count from public.code_vault_assignments where id = ${defectiveAssignment.id}
    `);
    check(afterDefectiveAttempt.display_count, 0, "defective_attempt_does_not_count_as_display");

    // Un rejet lève une exception Postgres qui invalide le reste de la
    // transaction en cours : chaque vérification volontairement invalide est
    // donc encadrée par son propre savepoint (même technique que le LOT 2),
    // pour poursuivre les scénarios suivants dans la même transaction,
    // annulée dans son ensemble en fin de script.
    await tx.execute(sql`savepoint before_defect_immutability_check`);
    await rejectsWithPostgresError(
      () =>
        tx.execute(sql`
          update public.code_vault_assignments
          set defective_reason = 'tentative de contournement'
          where id = ${defectiveAssignment.id}
        `),
      "code_vault_assignment_defect_flag_is_immutable",
      "defect_flag_cannot_be_altered_once_set"
    );
    await tx.execute(sql`rollback to savepoint before_defect_immutability_check`);

    // Scénario 4 : remplacement humain tracé (code cantine fixe remplacé) —
    // nouvelle version de l'attribution, lien immuable vers l'ancienne.
    const cantineIdentityV1 = {
      institutionId,
      personRef: "eleve-remplacement-01",
      service: "cantine",
      schoolYear: "2026-2027",
      version: 1,
    };
    const cantineV1 = await getOrCreateVaultAssignment(tx, cantineIdentityV1);
    const cantineV2 = await traceManualVaultCodeReplacement(tx, {
      previousAssignmentId: cantineV1.id,
      nextIdentity: { ...cantineIdentityV1, version: 2 },
    });
    check(cantineV2.version, 2, "replacement_creates_new_version");
    const [tracedV1] = await tx.execute(sql`
      select replaced_by_assignment_id from public.code_vault_assignments where id = ${cantineV1.id}
    `);
    check(tracedV1.replaced_by_assignment_id, cantineV2.id, "replacement_trace_points_to_new_version");

    await tx.execute(sql`savepoint before_replacement_immutability_check`);
    const cantineV3Identity = { ...cantineIdentityV1, version: 3 };
    const cantineV3 = await getOrCreateVaultAssignment(tx, cantineV3Identity);
    await rejectsWithPostgresError(
      () =>
        tx.execute(sql`
          update public.code_vault_assignments
          set replaced_by_assignment_id = ${cantineV3.id}
          where id = ${cantineV1.id}
        `),
      "code_vault_assignment_replacement_trace_is_immutable",
      "replacement_trace_cannot_be_altered_once_set"
    );
    await tx.execute(sql`rollback to savepoint before_replacement_immutability_check`);

    // Scénario 5 : cohérence du signalement défectueux — impossible d'avoir
    // un motif sans horodatage, ou l'inverse.
    await tx.execute(sql`savepoint before_defect_consistency_check`);
    await rejectsWithPostgresError(
      () =>
        tx.execute(sql`
          update public.code_vault_assignments
          set defective_reason = 'motif sans horodatage'
          where id = ${assignment.id}
        `),
      "code_vault_assignments_defect_report_consistency",
      "defect_reason_requires_flagged_at"
    );
    await tx.execute(sql`rollback to savepoint before_defect_consistency_check`);

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
  const [{ count }] = await verifier`
    select count(*)::integer as count from public.institutions where id = ${institutionId}
  `;
  check(count, 0, "rollback_scenario_left_no_trace");
} finally {
  await verifier.end();
}

console.log(
  JSON.stringify({ target: "127.0.0.1:54322", assertions, rollbackVerified: true, realData: false })
);
