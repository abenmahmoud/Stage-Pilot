// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
//
// LOT 7 du plan de persistance flash : recette sur PostgreSQL réel jetable
// (pile Supabase locale). Personnes et établissements entièrement fictifs.
// Appelle les VRAIS handlers HTTP (`api/flash/proposals/**`) avec un
// req/res minimal et un jeton d'accès réel émis par le GoTrue local — pas de
// réimplémentation des règles métier, qui restent dans les modules déjà
// écrits et testés (règle commune n°5 du plan).

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

if (process.argv.length !== 3 || process.argv[2] !== "--local-stack-only") {
  throw new Error("local_stack_confirmation_required");
}

const LOCAL_API_URL = "http://127.0.0.1:54321";
// Clés de démonstration publiques du CLI Supabase local (identiques sur
// toute pile locale par défaut) ; jamais des secrets réels.
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
process.env.VITE_SUPABASE_URL = LOCAL_API_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SERVICE_ROLE_KEY;

const marker = randomUUID().replaceAll("-", "").slice(0, 10);
const institutionASlug = `flash-recette-a-${marker}`;
const institutionBSlug = `flash-recette-b-${marker}`;
process.env.SUPPORT_INSTITUTION_SLUG = institutionASlug;

const [{ sql }, { db }, schema, { createClient }] = await Promise.all([
  import("drizzle-orm"),
  import("../db/index.js"),
  import("../db/schema.js"),
  import("@supabase/supabase-js"),
]);
const proposalsHandler = (await import("../api/flash/proposals/index.js")).default;
const decisionHandler = (await import("../api/flash/proposals/[id]/decision.js")).default;
const correctionHandler = (await import("../api/flash/proposals/[id]/correction.js")).default;

let assertions = 0;
const check = (actual, expected, label) => {
  try {
    assert.deepEqual(actual, expected);
  } catch (error) {
    error.message = `${label ?? "check"}: ${error.message}`;
    throw error;
  }
  assertions++;
};

function createMockResponse() {
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader() {},
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res._body = data;
      return res;
    },
  };
  return res;
}

async function call(handler, { method = "POST", headers = {}, body = {}, query = {} }) {
  const res = createMockResponse();
  await handler({ method, headers, body, query }, res);
  return { status: res.statusCode, body: res._body };
}

function authHeaders(token, idempotencyKey) {
  const headers = { authorization: `Bearer ${token}` };
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
  return headers;
}

const admin = createClient(LOCAL_API_URL, LOCAL_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createFictionalActor(label, role, password) {
  const email = `flash-recette-${marker}-${label}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
  });
  if (error) throw new Error(`create_user_failed:${label}:${error.message}`);
  const anon = createClient(LOCAL_API_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await anon.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`sign_in_failed:${label}:${signIn.error.message}`);
  return { id: data.user.id, email, token: signIn.data.session.access_token };
}

const createdUserIds = [];
const results = {};

try {
  // --- Fixtures : deux établissements fictifs, quatre comptes fictifs ---
  const institutionAId = randomUUID();
  const institutionBId = randomUUID();
  await db.execute(sql`insert into public.institutions (id, slug, name, status)
    values (${institutionAId}::uuid, ${institutionASlug}, 'Lycée fictif recette flash A', 'pilot')`);
  await db.execute(sql`insert into public.institutions (id, slug, name, status)
    values (${institutionBId}::uuid, ${institutionBSlug}, 'Lycée fictif recette flash B', 'pilot')`);

  const proposer1 = await createFictionalActor("proposer1", "professeur", "recette-flash-pw-01!");
  const validator1 = await createFictionalActor("validator1", "administration", "recette-flash-pw-02!");
  const validator2 = await createFictionalActor("validator2", "administration", "recette-flash-pw-03!");
  const outsider = await createFictionalActor("outsider", "administration", "recette-flash-pw-04!");
  createdUserIds.push(proposer1.id, validator1.id, validator2.id, outsider.id);

  const membership = (userId, institutionId, serviceCodes) =>
    db.execute(sql`insert into public.institution_memberships
      (institution_id, user_id, role, service_codes, status)
      values (${institutionId}::uuid, ${userId}::uuid, 'admin', ${sql.raw(
        `array[${serviceCodes.map((code) => `'${code}'`).join(",")}]::text[]`
      )}, 'active')`);

  await membership(proposer1.id, institutionAId, []);
  await membership(validator1.id, institutionAId, ["referent_numerique"]);
  await membership(validator2.id, institutionAId, ["referent_numerique"]);
  await membership(outsider.id, institutionBId, ["referent_numerique"]);

  const futureIso = (hours) => new Date(Date.now() + hours * 3_600_000).toISOString();

  // --- Scénario 1 + 4 : proposer, rejouer, valider, publier (SQL direct,
  // aucune route ne le fait encore — voir compte rendu), corriger. ---
  const idemKey1 = `flash-recette-${marker}-1`;
  const proposeBody1 = {
    title: "Sortie pédagogique reportée",
    bodyMarkdown: "La sortie du groupe 6A fictif est reportée d'une semaine.",
    importance: "importante",
    channels: ["push", "email"],
    groupRefs: ["classe:6a-fictif"],
    expiresAt: futureIso(48),
  };
  const created1 = await call(proposalsHandler, {
    headers: authHeaders(proposer1.token, idemKey1),
    body: proposeBody1,
  });
  check(created1.status, 201, "scenario1_propose_created");
  check(created1.body.duplicate, false, "scenario1_propose_not_duplicate");
  check(created1.body.version.status, "proposee", "scenario1_propose_status");
  const flashInfoId1 = created1.body.version.flashInfoId;

  // Rejeu strict de la même requête (même clé, même auteur) : LOT 2/§8 —
  // aucun doublon.
  const replay1 = await call(proposalsHandler, {
    headers: authHeaders(proposer1.token, idemKey1),
    body: proposeBody1,
  });
  check(replay1.status, 200, "scenario4_replay_status");
  check(replay1.body.duplicate, true, "scenario4_replay_duplicate");
  check(replay1.body.version.id, created1.body.version.id, "scenario4_replay_same_version");
  const [{ count: infoCountAfterReplay }] = await db.execute(
    sql`select count(*)::integer as count from public.flash_infos where id = ${flashInfoId1}::uuid`
  );
  check(infoCountAfterReplay, 1, "scenario4_no_duplicate_row");

  const decision1 = await call(decisionHandler, {
    headers: authHeaders(validator1.token),
    query: { id: flashInfoId1 },
    body: { decision: "validee", content: null },
  });
  check(decision1.status, 200, "scenario1_decision_status");
  check(decision1.body.version.status, "validee", "scenario1_decision_validee");
  check(decision1.body.access.selfValidated, false, "scenario1_decision_not_self");
  check(decision1.body.access.grantedByService, "referent_numerique", "scenario1_decision_service");

  // Publication : aucune route ne fait encore `validee -> publiee` (LOT 3
  // s'arrête à `validee`, voir le commentaire de decision.ts). Transition
  // avancée ici par SQL direct pour pouvoir recetter LOT 4 ; elle est légale
  // au sens du même graphe que l'app utilise (shared/flash-transitions.ts et
  // le trigger `flash_guard_version`), donc le trigger l'accepte sans
  // contourner aucune règle.
  await db.execute(sql`update public.flash_info_versions
    set status = 'publiee', published_at = transaction_timestamp()
    where id = ${decision1.body.version.id}::uuid and status = 'validee'`);

  await db.execute(sql`insert into public.flash_notification_dispatches
      (institution_id, version_id, channel, group_ref, status)
    values
      (${institutionAId}::uuid, ${decision1.body.version.id}::uuid, 'push', 'classe:6a-fictif', 'sent'),
      (${institutionAId}::uuid, ${decision1.body.version.id}::uuid, 'email', 'classe:6a-fictif', 'sent')`);

  const correction1 = await call(correctionHandler, {
    headers: authHeaders(validator1.token),
    query: { id: flashInfoId1 },
    body: {
      title: "Sortie pédagogique reportée au 20",
      bodyMarkdown: "La sortie du groupe 6A fictif est reportée au 20, changement de date confirmé.",
      importance: "importante",
      channels: ["push", "email"],
      groupRefs: ["classe:6a-fictif"],
      expiresAt: futureIso(96),
    },
  });
  check(correction1.status, 200, "scenario1_correction_status");
  check(correction1.body.version.status, "modifiee", "scenario1_correction_modifiee");
  check(correction1.body.gapKind, "decisif", "scenario1_correction_gap_decisif");
  check(correction1.body.audienceTreatment.correctionPossible, true, "scenario1_correction_possible");
  check(
    [...correction1.body.audienceTreatment.eligibleChannels].sort(),
    ["email", "push"],
    "scenario1_correction_eligible_channels"
  );
  check(correction1.body.audienceTreatment.maintained, ["classe:6a-fictif"], "scenario1_correction_maintained");

  const [correctionRow1] = await db.execute(
    sql`select decision, decided_by from public.flash_correction_decisions where version_id = ${decision1.body.version.id}::uuid`
  );
  check(correctionRow1.decision, "confirmee", "scenario1_correction_row_confirmee");
  check(correctionRow1.decided_by, validator1.id, "scenario1_correction_row_decided_by");
  results.scenario1_propose_validate_correct = "prouvé (routes réelles pour proposer/valider/corriger ; publication avancée par SQL direct, aucune route ne la fait encore)";

  // --- Scénario 7 : flash urgente notifiée puis ramenée à "normale" : la
  // correction reste due (cas du 5 septembre 2026). ---
  const idemKey2 = `flash-recette-${marker}-2`;
  const proposeBody2 = {
    title: "Alerte transport fictive",
    bodyMarkdown: "Le bus fictif de la ligne 5 est annulé ce soir.",
    importance: "urgente",
    channels: ["push", "email", "sms"],
    groupRefs: ["classe:5b-fictif"],
    expiresAt: futureIso(12),
  };
  const created2 = await call(proposalsHandler, {
    headers: authHeaders(proposer1.token, idemKey2),
    body: proposeBody2,
  });
  check(created2.status, 201, "scenario7_propose_created");
  const flashInfoId2 = created2.body.version.flashInfoId;

  const decision2 = await call(decisionHandler, {
    headers: authHeaders(validator2.token),
    query: { id: flashInfoId2 },
    body: { decision: "validee", content: null },
  });
  check(decision2.status, 200, "scenario7_decision_status");

  await db.execute(sql`update public.flash_info_versions
    set status = 'publiee', published_at = transaction_timestamp()
    where id = ${decision2.body.version.id}::uuid and status = 'validee'`);

  const parentContactRef = `contact:parent-fictif-${marker}`;
  await db.execute(sql`insert into public.flash_notification_dispatches
      (institution_id, version_id, channel, group_ref, contact_ref, status)
    values
      (${institutionAId}::uuid, ${decision2.body.version.id}::uuid, 'push', 'classe:5b-fictif', null, 'sent'),
      (${institutionAId}::uuid, ${decision2.body.version.id}::uuid, 'email', 'classe:5b-fictif', null, 'sent'),
      (${institutionAId}::uuid, ${decision2.body.version.id}::uuid, 'sms', null, ${parentContactRef}, 'sent')`);

  const correction2 = await call(correctionHandler, {
    headers: authHeaders(validator2.token),
    query: { id: flashInfoId2 },
    body: {
      title: "Alerte transport fictive levée",
      bodyMarkdown: "Le bus fictif de la ligne 5 circule normalement, information annulée.",
      importance: "normale",
      channels: [],
      groupRefs: ["classe:5b-fictif"],
      expiresAt: futureIso(12),
    },
  });
  check(correction2.status, 200, "scenario7_correction_status");
  check(correction2.body.audienceTreatment.correctionPossible, true, "scenario7_correction_still_possible");
  check(
    [...correction2.body.audienceTreatment.eligibleChannels].sort(),
    ["email", "push", "sms"],
    "scenario7_correction_eligible_channels_survive_downgrade"
  );
  results.scenario7_urgent_then_normal =
    "prouvé : ramenée à 'normale', la correction reste due sur les 3 canaux réellement notifiés (trace flash_notification_dispatches), jamais recalculée depuis l'importance déclarée";

  // --- Scénario 2 : deux enfants d'un même parent dans deux groupes :
  // aucune livraison perdue. Aucune route n'écrit encore dans
  // flash_notification_dispatches pour un envoi réel (règle commune : aucun
  // envoi dans ce plan) ; preuve au niveau schéma que le contact partagé
  // d'un second enfant, dans un second groupe, sur une flash différente,
  // n'écrase ni ne fusionne la ligne du premier. ---
  const idemKey3 = `flash-recette-${marker}-3`;
  const proposeBody3 = {
    title: "Alerte transport fictive bis",
    bodyMarkdown: "Le bus fictif de la ligne 9 est retardé ce soir.",
    importance: "urgente",
    channels: ["push", "email", "sms"],
    groupRefs: ["classe:terminale-c-fictif"],
    expiresAt: futureIso(12),
  };
  const created3 = await call(proposalsHandler, {
    headers: authHeaders(proposer1.token, idemKey3),
    body: proposeBody3,
  });
  check(created3.status, 201, "scenario2_propose_created");
  const flashInfoId3 = created3.body.version.flashInfoId;
  const decision3 = await call(decisionHandler, {
    headers: authHeaders(validator1.token),
    query: { id: flashInfoId3 },
    body: { decision: "validee", content: null },
  });
  check(decision3.status, 200, "scenario2_decision_status");
  await db.execute(sql`update public.flash_info_versions
    set status = 'publiee', published_at = transaction_timestamp()
    where id = ${decision3.body.version.id}::uuid and status = 'validee'`);

  // Même contact (le même parent fictif) que le scénario 7, mais second
  // enfant, second groupe, seconde information flash : la ligne SMS doit
  // coexister avec celle du scénario 7, jamais la remplacer.
  await db.execute(sql`insert into public.flash_notification_dispatches
      (institution_id, version_id, channel, contact_ref, status)
    values (${institutionAId}::uuid, ${decision3.body.version.id}::uuid, 'sms', ${parentContactRef}, 'sent')`);

  const [{ count: sharedContactDispatchCount }] = await db.execute(
    sql`select count(*)::integer as count from public.flash_notification_dispatches
      where contact_ref = ${parentContactRef} and institution_id = ${institutionAId}::uuid`
  );
  check(sharedContactDispatchCount, 2, "scenario2_no_delivery_lost");
  const distinctVersionRows = await db.execute(
    sql`select distinct version_id from public.flash_notification_dispatches
      where contact_ref = ${parentContactRef} and institution_id = ${institutionAId}::uuid`
  );
  check(distinctVersionRows.length, 2, "scenario2_two_distinct_versions_kept");
  results.scenario2_shared_contact_two_groups =
    "prouvé au niveau schéma (aucune route n'envoie encore) : deux lignes flash_notification_dispatches pour le même contact_ref, deux versions différentes, aucune n'écrase l'autre — pas de contrainte d'unicité sur contact_ref seul";

  // --- Scénario 5 : un membre d'un autre établissement ne voit rien. ---
  const idemKeyOutsider = `flash-recette-${marker}-outsider`;
  let outsiderStatus = null;
  let outsiderMessage = null;
  try {
    const attempt = await call(proposalsHandler, {
      headers: authHeaders(outsider.token, idemKeyOutsider),
      body: proposeBody1,
    });
    outsiderStatus = attempt.status;
    outsiderMessage = attempt.body?.error ?? null;
  } catch (error) {
    outsiderStatus = "threw";
    outsiderMessage = error instanceof Error ? error.message : String(error);
  }
  check(outsiderStatus, 403, "scenario5_outsider_forbidden");
  check(
    typeof outsiderMessage === "string" && outsiderMessage.includes("Aucune appartenance active"),
    true,
    "scenario5_outsider_message"
  );
  const [{ count: outsiderFlashCount }] = await db.execute(
    sql`select count(*)::integer as count from public.flash_infos where institution_id = ${institutionAId}::uuid and created_by = ${outsider.id}::uuid`
  );
  check(outsiderFlashCount, 0, "scenario5_outsider_created_nothing");
  results.scenario5_cross_institution_isolation =
    "prouvé : un membre actif uniquement de l'établissement B, appelant la route configurée pour l'établissement A, reçoit 403 avant toute lecture/écriture d'information flash";

  // --- Scénario 6 : anon et authenticated n'ont aucun privilège direct sur
  // les 6 tables flash, et RLS est activée ET forcée dessus. ---
  const grantRows = await db.execute(
    sql`select table_name, grantee, privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and table_name like 'flash_%' and grantee in ('anon','authenticated')`
  );
  check(grantRows.length, 0, "scenario6_no_anon_authenticated_grants");
  const rlsRows = await db.execute(
    sql`select relname from pg_class
      where relnamespace = 'public'::regnamespace
        and relname in ('flash_infos','flash_info_versions','flash_info_audiences','flash_notification_dispatches','flash_correction_decisions','flash_info_events')
        and relrowsecurity and relforcerowsecurity`
  );
  check(rlsRows.length, 6, "scenario6_rls_enabled_and_forced_on_all_six_tables");
  results.scenario6_anon_authenticated_no_privilege =
    "prouvé par requête directe sur information_schema.role_table_grants et pg_class : 0 privilège anon/authenticated, RLS activée et forcée sur les 6 tables flash";

  // --- Scénario 3 : validation concurrente, une seule version gagne. Deux
  // processus Node séparés (deux connexions Postgres distinctes), synchronisés
  // sur un même instant, décident tous les deux la même proposition. ---
  const idemKey4 = `flash-recette-${marker}-4`;
  const proposeBody4 = {
    title: "Information flash de test de concurrence",
    bodyMarkdown: "Contenu fictif pour tester le verrou transactionnel de décision.",
    importance: "normale",
    channels: [],
    groupRefs: ["classe:1s-fictif"],
    expiresAt: futureIso(24),
  };
  const created4 = await call(proposalsHandler, {
    headers: authHeaders(proposer1.token, idemKey4),
    body: proposeBody4,
  });
  check(created4.status, 201, "scenario3_propose_created");
  const flashInfoId4 = created4.body.version.flashInfoId;

  const workerPath = fileURLToPath(new URL("./flash-recette-decision-worker.mjs", import.meta.url));
  const resolverPath = fileURLToPath(new URL("./ts-test-resolver.mjs", import.meta.url));
  const repoRoot = fileURLToPath(new URL("..", import.meta.url));
  const targetTimeMs = Date.now() + 800;
  const childEnv = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL,
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPPORT_INSTITUTION_SLUG: process.env.SUPPORT_INSTITUTION_SLUG,
  };

  function runWorker(token) {
    return new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          "--import",
          pathToFileURL(resolverPath).href,
          "--experimental-transform-types",
          workerPath,
          flashInfoId4,
          token,
          String(targetTimeMs),
        ],
        { cwd: repoRoot, env: childEnv, stdio: ["ignore", "pipe", "pipe"] }
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

  const [outcomeA, outcomeB] = await Promise.all([
    runWorker(validator1.token),
    runWorker(validator2.token),
  ]);
  const statuses = [outcomeA.status, outcomeB.status].sort();
  check(statuses, [200, 409], "scenario3_exactly_one_winner");
  const [finalVersion4] = await db.execute(
    sql`select status, validated_by from public.flash_info_versions where flash_info_id = ${flashInfoId4}::uuid and version = 1`
  );
  check(finalVersion4.status, "validee", "scenario3_final_status_validee");
  check(
    [validator1.id, validator2.id].includes(finalVersion4.validated_by),
    true,
    "scenario3_winner_is_one_of_the_two_validators"
  );
  const [{ count: version4Count }] = await db.execute(
    sql`select count(*)::integer as count from public.flash_info_versions where flash_info_id = ${flashInfoId4}::uuid`
  );
  check(version4Count, 1, "scenario3_no_second_version_created");
  results.scenario3_concurrent_decision =
    "prouvé avec deux processus Node séparés (deux connexions Postgres distinctes) : exactement une décision à 200, l'autre à 409, une seule ligne de version, jamais deux versions concurrentes";
} finally {
  // --- Nettoyage best-effort. Découverte faite en écrivant ce lot :
  // `flash_info_events` est append-only par trigger
  // (`flash_events_append_only`), et `flash_correction_decisions.decided_by`/
  // `requested_by` référencent `auth.users(id)` en `ON DELETE RESTRICT`. Une
  // fois une information flash proposée puis décidée, ni elle ni son
  // établissement ni les comptes qui l'ont décidée ne peuvent plus être
  // supprimés par ce script (ni par personne d'autre) : c'est voulu, c'est de
  // l'audit immuable. Sur cette pile locale jetable ce n'est pas grave (elle
  // disparaît au prochain `supabase db reset`/`stop`) ; ce ne serait pas vrai
  // sur un environnement partagé, d'où cette note plutôt qu'un contournement
  // (désactiver le trigger romprait la preuve même qu'on cherche à établir).
  for (const userId of createdUserIds) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
  results.cleanup =
    "partiel et volontaire : comptes auth.users fictifs supprimés quand possible ; établissements et informations flash fictifs laissés en place (append-only + FK RESTRICT), purgés seulement par un futur `supabase db reset`/`stop` de cette pile locale jetable";
}

console.log(JSON.stringify({ target: "127.0.0.1:54322", assertions, results }, null, 2));
