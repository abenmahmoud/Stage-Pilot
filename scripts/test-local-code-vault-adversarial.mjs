// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
// Recette ADVERSE du LOT 6 (docs/operations/PLAN_COFFRE_CODES_2026-09-05.md)
// sur PostgreSQL réel jetable. Personnes et établissements entièrement
// fictifs. Jamais `--linked`, jamais `db push`, jamais d'URL distante.
//
// Ce script ASSEMBLE les briques déjà recettées isolément (LOT 1 :
// `decideVaultAccess`, LOT 3 : `api/_shared/code-vault-assignment.ts`) pour
// vérifier les huit garanties adverses du plan, plus le balayage anti-fuite
// de valeur. Il ne réimplémente aucune règle : chaque décision passe par le
// module réel du lot correspondant.
import assert from "node:assert/strict";
import { randomUUID, createCipheriv, randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import {
  getOrCreateVaultAssignment,
  recordVaultCodeDisplay,
  flagVaultCodeDefective,
  traceManualVaultCodeReplacement,
} from "../api/_shared/code-vault-assignment.ts";
import {
  decideVaultAccess,
  buildModelVisibleVaultFact,
  canAutoReplaceDefectiveVaultCode,
  isVaultDisplayStillVisible,
} from "../shared/code-vault-policy.ts";

if (process.argv.length !== 3 || process.argv[2] !== "--local-stack-only") {
  throw new Error("local_stack_confirmation_required");
}

// ---------------------------------------------------------------------------
// Balayage anti-fuite : capture tout ce que ce script écrit sur la sortie
// standard/erreur pendant toute son exécution, pour prouver par lecture (pas
// par confiance) qu'un marqueur fictif de valeur n'y apparaît jamais.
// ---------------------------------------------------------------------------
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

// Contient volontairement des tirets : ni un chiffré ni un identifiant
// base64 valides ne peuvent en contenir (regex de forme, LOT 2), pour que la
// tentative de contournement du chiffrement (scénario 8) soit réellement
// rejetée par la contrainte de forme, pas par accident un format qui
// ressemblerait déjà à du base64.
const FICTITIOUS_VALUE = `LOT6-VALEUR-FICTIVE-${randomUUID()}`;

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

async function rejectsWithPostgresError(run, expectedMessage, label) {
  let capturedErrorText = "";
  let capturedErrorDetail = "";
  await assert.rejects(run, (error) => {
    capturedErrorText = String(error?.cause?.message ?? error?.message ?? error);
    capturedErrorDetail = String(error?.cause?.detail ?? error?.detail ?? "");
    return capturedErrorText.includes(expectedMessage);
  }, label);
  assertions++;
  return { message: capturedErrorText, detail: capturedErrorDetail };
}

async function insertFictitiousInstitution(tx, institutionId, name) {
  await tx.execute(sql`
    insert into public.institutions (id, slug, name, status)
    values (${institutionId}, ${`coffre-lot6-${institutionId}`}, ${name}, 'draft')
  `);
}

async function insertAccessDeniedEvent(tx, event) {
  await tx.execute(sql`
    insert into public.code_vault_access_events
      (institution_id, assignment_id, actor_person_ref, actor_profile, event_type, refusal_reason)
    values (
      ${event.institutionId}, ${event.assignmentId ?? null}, ${event.actorPersonRef ?? null},
      ${event.actorProfile}, 'access_denied', ${event.refusalReason}
    )
  `);
}

// ---------------------------------------------------------------------------
// Scénario 1 (§LOT 6, adverse) : deux demandes concurrentes, PORTE
// D'AUTORISATION comprise, retournent la même attribution. Deux VRAIES
// connexions Postgres distinctes (deux processus enfants), comme le LOT 3,
// mais précédées ici d'une vérification explicite de `decideVaultAccess`
// (LOT 1) pour prouver que l'assemblage autorisation → attribution tient,
// pas seulement l'attribution isolée.
// ---------------------------------------------------------------------------

const institutionA = randomUUID();
await insertFictitiousInstitution(database, institutionA, "Lycée fictif A — LOT 6");

const concurrentActor = { profile: "eleve", personRef: "eleve-lot6-conc", institutionId: institutionA };
const concurrentTarget = {
  service: "ent",
  institutionId: institutionA,
  subjectKind: "self",
  subjectPersonRef: "eleve-lot6-conc",
  subjectClassRef: null,
};
const concurrentDecision = decideVaultAccess({ actor: concurrentActor, target: concurrentTarget });
check(concurrentDecision, { allowed: true }, "eleve_self_ent_authorized_before_concurrent_assignment");

const concurrentIdentity = {
  institutionId: institutionA,
  personRef: "eleve-lot6-conc",
  service: "ent",
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
    const worker = spawn(
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
    worker.stdout.on("data", (chunk) => (stdout += chunk));
    worker.stderr.on("data", (chunk) => (stderr += chunk));
    worker.on("close", (code) => {
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
  check(resultA.id, resultB.id, "concurrent_authorized_requests_return_same_assignment");
  const [{ count: concurrentCount }] = await database.execute(sql`
    select count(*)::integer as count from public.code_vault_assignments
    where institution_id = ${institutionA}
  `);
  check(concurrentCount, 1, "exactly_one_row_created_after_authorization_gate");
} finally {
  await database.execute(
    sql`delete from public.code_vault_assignments where institution_id = ${institutionA}`
  );
  await database.execute(sql`delete from public.institutions where id = ${institutionA}`);
}

// ---------------------------------------------------------------------------
// Scénarios 2 à 7 (§LOT 6) : dans une seule transaction annulée en fin de
// script (savepoints pour les rejets volontaires, comme LOT 2/LOT 3), la
// base locale n'est pas polluée.
// ---------------------------------------------------------------------------

const rollback = new Error("intentional_fixture_rollback");
const institutionC = randomUUID();
const institutionB = randomUUID(); // « un autre établissement »
let checkConstraintErrorDetail = "";

try {
  await database.transaction(async (tx) => {
    await insertFictitiousInstitution(tx, institutionC, "Lycée fictif C — LOT 6");
    await insertFictitiousInstitution(tx, institutionB, "Lycée fictif B — LOT 6 (autre établissement)");

    // --- Scénario 2 : quatrième affichage refusé, formulaire proposé. ---
    const quotaActor = { profile: "eleve", personRef: "eleve-lot6-quota", institutionId: institutionC };
    const quotaTarget = {
      service: "cantine",
      institutionId: institutionC,
      subjectKind: "self",
      subjectPersonRef: "eleve-lot6-quota",
      subjectClassRef: null,
    };
    check(decideVaultAccess({ actor: quotaActor, target: quotaTarget }), { allowed: true }, "quota_actor_authorized");
    const quotaIdentity = {
      institutionId: institutionC,
      personRef: "eleve-lot6-quota",
      service: "cantine",
      schoolYear: "2026-2027",
      version: 1,
    };
    const quotaAssignment = await getOrCreateVaultAssignment(tx, quotaIdentity);
    const day = new Date("2026-09-05T09:00:00.000Z");
    for (let i = 0; i < 3; i++) {
      const result = await recordVaultCodeDisplay(tx, {
        assignmentId: quotaAssignment.id,
        institutionId: institutionC,
        now: new Date(day.getTime() + i * 60_000),
      });
      check(result.outcome, "displayed", `display_${i + 1}_of_3_accepted`);
    }
    const fourthDisplay = await recordVaultCodeDisplay(tx, {
      assignmentId: quotaAssignment.id,
      institutionId: institutionC,
      now: new Date(day.getTime() + 3 * 60_000),
    });
    check(fourthDisplay, { outcome: "quota_exceeded" }, "fourth_display_refused_same_day");
    const [afterQuota] = await tx.execute(sql`
      select display_count from public.code_vault_assignments where id = ${quotaAssignment.id}
    `);
    check(afterQuota.display_count, 3, "refused_fourth_display_does_not_increment_counter");

    // --- Scénario 3 : code expiré à 30 minutes, invisible. ---
    const [afterThird] = await tx.execute(sql`
      select revealed_at from public.code_vault_assignments where id = ${quotaAssignment.id}
    `);
    const revealedAt = new Date(afterThird.revealed_at);
    check(isVaultDisplayStillVisible(revealedAt, new Date(revealedAt.getTime() + 60_000)), true, "still_visible_at_plus_1_minute");
    check(isVaultDisplayStillVisible(revealedAt, new Date(revealedAt.getTime() + 31 * 60_000)), false, "invisible_at_plus_31_minutes");

    // ÉCART TROUVÉ (à consigner, pas à corriger dans ce lot — voir compte
    // rendu) : `recordVaultCodeDisplay` ne connaît que le quota (par date) et
    // le statut défectueux, jamais l'expiration de la dernière remise. Un
    // jour calendaire plus tard (quota reparti à zéro), l'attribution
    // ci-dessus est expirée depuis longtemps (`isVaultDisplayStillVisible`
    // confirmé `false` juste au-dessus) : rien n'exige pourtant de nouvelle
    // preuve d'identité avant de la remettre à nouveau. Ce n'est pas un bug
    // de ce module (LOT 3 ne prétend pas porter cette règle) : c'est
    // l'absence de la route qui devrait la porter (LOT 5/6+).
    const nextDayAfterExpiry = await recordVaultCodeDisplay(tx, {
      assignmentId: quotaAssignment.id,
      institutionId: institutionC,
      now: new Date("2026-09-06T09:00:00.000Z"),
    });
    check(
      nextDayAfterExpiry.outcome,
      "displayed",
      "GAP_CONFIRME_aucune_reverification_identite_apres_expiration_nest_appliquee"
    );

    // --- Scénario 4 : code défectueux, aucune réattribution automatique. ---
    const defectiveIdentity = {
      institutionId: institutionC,
      personRef: "eleve-lot6-defectueux",
      service: "koxo",
      schoolYear: "2026-2027",
      version: 1,
    };
    const defectiveAssignment = await getOrCreateVaultAssignment(tx, defectiveIdentity);
    await flagVaultCodeDefective(tx, {
      assignmentId: defectiveAssignment.id,
      institutionId: institutionC,
      reason: "Code Koxo illisible, signalé par l'élève (motif fictif LOT 6).",
      flaggedByPersonRef: "referent-numerique-lot6",
      now: day,
    });
    const defectiveAttempt = await recordVaultCodeDisplay(tx, {
      assignmentId: defectiveAssignment.id,
      institutionId: institutionC,
      now: new Date(day.getTime() + 60_000),
    });
    check(defectiveAttempt, { outcome: "defective" }, "defective_code_blocks_display");
    check(canAutoReplaceDefectiveVaultCode(), false, "no_automatic_replacement_by_construction");
    // Vérification structurelle, pas seulement de confiance : aucun appelant
    // applicatif de `traceManualVaultCodeReplacement` en dehors de sa propre
    // définition (LOT 3, `api/_shared/code-vault-assignment.ts`) n'existe
    // dans `api/` ou `workers/` — donc aucune route ne peut aujourd'hui
    // déclencher un remplacement, encore moins automatiquement.
    //
    // LOT 2 (`docs/operations/PLAN_ENT_ACTIF_ET_DETTE_2026-09-06.md`) :
    // un simple `content.includes(nom)` confondait un commentaire humain qui
    // *mentionne* la fonction (par ex. `api/_shared/code-vault-ent-inactif-
    // route.ts`, « aucun remplacement pour ce lot (`traceManualVaultCode
    // Replacement` reste hors périmètre) ») avec un appel réel. La forme
    // d'un appel ou d'une déclaration est toujours l'identifiant suivi d'une
    // parenthèse ouvrante ; une mention en prose entre guillemets inverses
    // ne l'est jamais. D'où l'exigence de cette forme précise, pas d'une
    // simple sous-chaîne.
    const definitionFile = path.join(repoRoot, "api", "_shared", "code-vault-assignment.ts");
    const realCallPattern = /traceManualVaultCodeReplacement\s*\(/;
    const applicationCallers = [];
    for (const dir of ["api", "workers"]) {
      const dirPath = path.join(repoRoot, dir);
      const walk = (p) => {
        for (const entry of readdirSync(p)) {
          const full = path.join(p, entry);
          const stat = statSync(full);
          if (stat.isDirectory()) {
            walk(full);
          } else if (/\.(ts|tsx|mjs|js)$/.test(entry) && full !== definitionFile) {
            const content = readFileSync(full, "utf8");
            if (realCallPattern.test(content)) applicationCallers.push(full);
          }
        }
      };
      walk(dirPath);
    }
    check(applicationCallers, [], "no_application_route_calls_manual_replacement_automatically");

    // --- Scénario 5 : parent demandant le code de son enfant, refusé. ---
    const parentActor = { profile: "parent", personRef: "parent-lot6-01", institutionId: institutionC };
    const parentTarget = {
      service: "cantine",
      institutionId: institutionC,
      subjectKind: "student",
      subjectPersonRef: "eleve-lot6-enfant-01",
      subjectClassRef: null,
    };
    const parentDecision = decideVaultAccess({ actor: parentActor, target: parentTarget });
    check(parentDecision, { allowed: false, reason: "parent_to_child_forbidden" }, "parent_to_child_refused_with_reason");
    await insertAccessDeniedEvent(tx, {
      institutionId: institutionC,
      actorPersonRef: "parent-lot6-01",
      actorProfile: "parent",
      refusalReason: "parent_to_child_forbidden",
    });
    const [{ count: parentGrantedAssignments }] = await tx.execute(sql`
      select count(*)::integer as count from public.code_vault_assignments
      where institution_id = ${institutionC} and person_ref = 'eleve-lot6-enfant-01'
    `);
    check(parentGrantedAssignments, 0, "no_assignment_created_for_refused_parent_attempt");
    const modelFactForParent = buildModelVisibleVaultFact({
      service: "cantine",
      status: null,
      validationRequired: true,
      deliveryAuthorized: false,
      refusalReason: "parent_to_child_forbidden",
      receipt: null,
    });
    check(Object.keys(modelFactForParent).includes("value"), false, "model_visible_fact_has_no_value_field");

    // --- Scénario 6 : professeur principal hors de ses classes validées. ---
    const ppActor = {
      profile: "professeur_principal",
      personRef: "pp-lot6-01",
      institutionId: institutionC,
      validatedClassRefs: ["1G1"],
    };
    const ppTargetOutOfScope = {
      service: "koxo",
      institutionId: institutionC,
      subjectKind: "student",
      subjectPersonRef: "eleve-lot6-hors-classe",
      subjectClassRef: "1G2",
    };
    const ppDecisionRefused = decideVaultAccess({ actor: ppActor, target: ppTargetOutOfScope });
    check(
      ppDecisionRefused,
      { allowed: false, reason: "professeur_principal_class_not_validated" },
      "pp_outside_validated_class_refused"
    );
    await insertAccessDeniedEvent(tx, {
      institutionId: institutionC,
      actorPersonRef: "pp-lot6-01",
      actorProfile: "professeur_principal",
      refusalReason: "professeur_principal_class_not_validated",
    });
    const [{ count: ppOutOfScopeAssignments }] = await tx.execute(sql`
      select count(*)::integer as count from public.code_vault_assignments
      where institution_id = ${institutionC} and person_ref = 'eleve-lot6-hors-classe'
    `);
    check(ppOutOfScopeAssignments, 0, "no_assignment_created_for_refused_pp_attempt");

    // Contrôle positif dans la même classe : la frontière est exacte, pas
    // trop large (l'accès n'est pas refusé « par principe » au professeur
    // principal, seulement hors de ses classes validées).
    const ppTargetInScope = {
      service: "koxo",
      institutionId: institutionC,
      subjectKind: "student",
      subjectPersonRef: "eleve-lot6-dans-classe",
      subjectClassRef: "1G1",
    };
    const ppDecisionAllowed = decideVaultAccess({
      actor: ppActor,
      target: ppTargetInScope,
      professeurPrincipalAlreadyHoldingAnotherActiveCode: false,
    });
    check(ppDecisionAllowed, { allowed: true }, "pp_inside_validated_class_allowed");
    const ppIdentity = {
      institutionId: institutionC,
      personRef: "eleve-lot6-dans-classe",
      service: "koxo",
      schoolYear: "2026-2027",
      version: 1,
    };
    const ppAssignment = await getOrCreateVaultAssignment(tx, ppIdentity);
    const ppDisplay = await recordVaultCodeDisplay(tx, {
      assignmentId: ppAssignment.id,
      institutionId: institutionC,
      now: day,
    });
    check(ppDisplay.outcome, "displayed", "pp_inside_scope_full_path_succeeds");

    // --- Scénario 7 : membre d'un autre établissement, ne voit rien. ---
    const otherInstitutionActor = {
      profile: "service",
      institutionId: institutionB,
      grantedServices: ["administration"],
    };
    const otherInstitutionTarget = {
      service: "cantine",
      institutionId: institutionC,
      subjectKind: "institution_wide",
      subjectPersonRef: null,
      subjectClassRef: null,
    };
    const otherInstitutionDecision = decideVaultAccess({
      actor: otherInstitutionActor,
      target: otherInstitutionTarget,
    });
    check(
      otherInstitutionDecision,
      { allowed: false, reason: "institution_mismatch" },
      "other_institution_member_sees_nothing"
    );
    await insertAccessDeniedEvent(tx, {
      institutionId: institutionC,
      actorProfile: "service",
      refusalReason: "institution_mismatch",
    });

    // --- Scénario 8 (adverse) : tentative de contournement du chiffrement —
    // insérer directement une chaîne en clair dans `ciphertext`. Doit être
    // rejetée par la contrainte de forme. FINDING adverse confirmé par ce
    // lot (voir compte rendu) : le message court de l'erreur ne porte jamais
    // le marqueur, mais le champ `detail` renvoyé par Postgres pour une
    // violation de contrainte CHECK inclut la ligne complète refusée
    // (« Failing row contains (...) »), donc le marqueur en clair. Ce n'est
    // pas un défaut du schéma (la contrainte fait exactement son travail :
    // rejeter l'insertion) : c'est un risque pour tout futur code qui
    // journaliserait cette erreur verbatim (`console.error(error)`,
    // `JSON.stringify(error)`) au lieu de son seul message court.
    await tx.execute(sql`savepoint before_plaintext_bypass_attempt`);
    const bypassError = await rejectsWithPostgresError(
      () =>
        tx.execute(sql`
          insert into public.code_vault_private_rows
            (institution_id, assignment_id, key_version, iv, auth_tag, ciphertext)
          values (
            ${institutionC}, ${ppAssignment.id}, 'v1',
            'AAAAAAAAAAAAAAAA', 'BBBBBBBBBBBBBBBBBBBBBBBB',
            ${FICTITIOUS_VALUE}
          )
        `),
      "violates check constraint",
      "plaintext_bypass_rejected_by_ciphertext_shape_constraint"
    );
    check(bypassError.message.includes(FICTITIOUS_VALUE), false, "short_error_message_never_echoes_plaintext_marker");
    check(
      bypassError.detail.includes(FICTITIOUS_VALUE),
      true,
      "GAP_CONFIRME_postgres_check_violation_detail_echoes_the_full_rejected_row"
    );
    checkConstraintErrorDetail = bypassError.detail;
    await tx.execute(sql`rollback to savepoint before_plaintext_bypass_attempt`);

    // --- Scénario 9 (balayage) : valeur réellement chiffrée, jamais en
    // clair nulle part — round-trip complet sur un jeu de clé LOCAL et
    // ÉPHÉMÈRE, jamais une clé de production. ---
    const cipherKey = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", cipherKey, iv);
    const ciphertextBuffer = Buffer.concat([cipher.update(FICTITIOUS_VALUE, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const envelope = {
      keyVersion: "v1",
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      ciphertext: ciphertextBuffer.toString("base64"),
    };
    check(envelope.ciphertext.includes(FICTITIOUS_VALUE), false, "ciphertext_never_contains_plaintext_marker");
    await tx.execute(sql`
      insert into public.code_vault_private_rows
        (institution_id, assignment_id, key_version, iv, auth_tag, ciphertext)
      values (
        ${institutionC}, ${ppAssignment.id}, ${envelope.keyVersion},
        ${envelope.iv}, ${envelope.authTag}, ${envelope.ciphertext}
      )
    `);
    const [storedRow] = await tx.execute(sql`
      select ciphertext from public.code_vault_private_rows where assignment_id = ${ppAssignment.id}
    `);
    check(storedRow.ciphertext, envelope.ciphertext, "stored_ciphertext_matches_encrypted_envelope");
    check(storedRow.ciphertext.includes(FICTITIOUS_VALUE), false, "stored_row_never_contains_plaintext_marker");

    // Confirmation du round-trip (preuve que le chiffré est bien utilisable,
    // pas juste opaque) sur la même clé locale.
    const decipher = (await import("node:crypto")).createDecipheriv(
      "aes-256-gcm",
      cipherKey,
      Buffer.from(envelope.iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
    check(decrypted, FICTITIOUS_VALUE, "round_trip_decryption_recovers_original_fictitious_value");

    // Balayage anti-fuite sur le CONTENU des lignes (pas seulement les noms
    // de colonnes déjà vérifiés après coup) : aucun champ texte libre
    // (motif de signalement défectueux, motif de refus, personne) ne doit
    // jamais porter le marqueur fictif, y compris par accident d'un futur
    // appelant qui copierait une valeur dans un commentaire humain.
    const likePattern = `%${FICTITIOUS_VALUE}%`;
    const rowContentLeakScan = await tx.execute(sql`
      select 'code_vault_assignments' as tbl from public.code_vault_assignments
      where institution_id = ${institutionC}
        and (person_ref ilike ${likePattern} or coalesce(defective_reason, '') ilike ${likePattern})
      union all
      select 'code_vault_access_events' from public.code_vault_access_events
      where institution_id = ${institutionC}
        and (coalesce(actor_person_ref, '') ilike ${likePattern} or coalesce(refusal_reason, '') ilike ${likePattern})
    `);
    check(rowContentLeakScan.length, 0, "fictitious_value_marker_never_stored_in_any_free_text_column");

    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await client.end();
}

// Le finding est déjà vérifié dans la transaction ci-dessus (message court
// propre, `detail` qui fuit) ; `checkConstraintErrorDetail` reste disponible
// pour le compte rendu, volontairement non ré-affirmé ici en double.
void checkConstraintErrorDetail;

// ---------------------------------------------------------------------------
// Vérifications post-transaction (RLS bout en bout + balayage de schéma) sur
// une connexion neuve, après annulation complète du scénario 2 à 9.
// ---------------------------------------------------------------------------
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
  const [{ count: institutionCTraceCount }] = await verifier`
    select count(*)::integer as count from public.institutions where id = ${institutionC}
  `;
  check(institutionCTraceCount, 0, "rollback_scenario_2_to_9_left_no_trace");

  // « Ne voit rien » vérifié au niveau du privilège de base, pas seulement de
  // la décision applicative : aucun rôle client n'a de privilège du tout,
  // quelle que soit l'institution visée.
  const grantsRows = await verifier`
    select table_name, grantee from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('code_vault_assignments', 'code_vault_private_rows', 'code_vault_access_events')
      and grantee in ('anon', 'authenticated', 'public')
  `;
  check(grantsRows.length, 0, "no_client_role_has_any_privilege_on_vault_tables");

  const rlsRows = await verifier`
    select relname, relrowsecurity, relforcerowsecurity from pg_class
    where relname in ('code_vault_assignments', 'code_vault_private_rows', 'code_vault_access_events')
  `;
  check(rlsRows.length, 3, "all_three_vault_tables_present");
  for (const row of rlsRows) {
    check(row.relrowsecurity, true, `rls_enabled_${row.relname}`);
    check(row.relforcerowsecurity, true, `rls_forced_${row.relname}`);
  }

  const leakyColumns = await verifier`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public'
      and table_name in ('code_vault_assignments', 'code_vault_private_rows', 'code_vault_access_events')
      and column_name ~* '(value|plain|clair|code_value|secret)'
  `;
  check(leakyColumns.length, 0, "no_column_named_after_a_plaintext_pattern");
} finally {
  await verifier.end();
}

// ---------------------------------------------------------------------------
// Balayage anti-fuite final : le marqueur fictif ne doit apparaître dans
// AUCUNE ligne de sortie capturée pendant toute l'exécution de ce script.
// ---------------------------------------------------------------------------
console.log = originalConsoleLog;
console.error = originalConsoleError;
const leakedInOutput = capturedOutput.filter((line) => line.includes(FICTITIOUS_VALUE));
check(leakedInOutput, [], "fictitious_value_marker_never_appears_in_any_captured_output_line");

console.log(
  JSON.stringify(
    {
      target: "127.0.0.1:54322",
      assertions,
      rollbackVerified: true,
      realData: false,
      knownGaps: [
        "no_route_requires_new_identity_proof_after_30min_expiry_before_redisplay",
        "quota_exceeded_outcome_not_wired_to_form_fallback_journey_step",
        "postgres_check_violation_detail_would_leak_plaintext_if_logged_verbatim_by_a_future_caller",
      ],
    },
    null,
    2
  )
);
