// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
//
// LOT 4 du plan de publication flash
// (docs/operations/PLAN_FLASH_PUBLICATION_2026-09-05.md) : recette sur
// PostgreSQL réel jetable (pile Supabase locale). Personnes et établissements
// entièrement fictifs. Appelle les VRAIS handlers HTTP
// (`api/flash/proposals/**`, `api/flash/validation/**`, `api/cron/flash-expiry`)
// avec un req/res minimal et des jetons réels émis par le GoTrue local — pas
// de réimplémentation des règles métier (règle commune n°4 du plan).
//
// Contrairement à `test-local-flash-persistence.mjs` (LOT 7 du plan de
// persistance, où la transition `validee -> publiee` n'existait par aucune
// route et était forcée par SQL direct), ce script appelle la VRAIE route
// `POST /api/flash/proposals/[id]/publication` écrite au LOT 1 de CE plan.
// Seules les manipulations de `expiresAt` vers le passé restent du SQL direct
// (mise en place d'un état de test, jamais une transition de statut).

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
process.env.CRON_SECRET = `flash-recette-cron-secret-${randomUUID()}`;

const marker = randomUUID().replaceAll("-", "").slice(0, 10);
const institutionSlug = `flash-pub-recette-${marker}`;
process.env.SUPPORT_INSTITUTION_SLUG = institutionSlug;

const [{ sql }, { db }, { createClient }] = await Promise.all([
  import("drizzle-orm"),
  import("../db/index.js"),
  import("@supabase/supabase-js"),
]);
const proposalsHandler = (await import("../api/flash/proposals/index.js")).default;
const decisionHandler = (await import("../api/flash/proposals/[id]/decision.js")).default;
const publicationHandler = (await import("../api/flash/proposals/[id]/publication.js")).default;
const publishableHandler = (await import("../api/flash/validation/publishable.js")).default;
const publishedHandler = (await import("../api/flash/validation/published.js")).default;
const expiredHandler = (await import("../api/flash/validation/expired.js")).default;
const expiredAfterValidationHandler = (await import("../api/flash/validation/expired-after-validation.js")).default;
const cronHandler = (await import("../api/cron/flash-expiry.js")).default;

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
  const email = `flash-pub-recette-${marker}-${label}@example.test`;
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
const institutionId = randomUUID();

try {
  // --- Fixtures : un établissement fictif, quatre comptes fictifs ---
  await db.execute(sql`insert into public.institutions (id, slug, name, status)
    values (${institutionId}::uuid, ${institutionSlug}, 'Lycée fictif recette publication flash', 'pilot')`);

  const proposer1 = await createFictionalActor("proposer1", "professeur", "recette-pub-pw-01!");
  const validator1 = await createFictionalActor("validator1", "administration", "recette-pub-pw-02!");
  const validator2 = await createFictionalActor("validator2", "administration", "recette-pub-pw-03!");
  const noService = await createFictionalActor("noservice", "administration", "recette-pub-pw-04!");
  createdUserIds.push(proposer1.id, validator1.id, validator2.id, noService.id);

  const membership = (userId, serviceCodes) =>
    db.execute(sql`insert into public.institution_memberships
      (institution_id, user_id, role, service_codes, status)
      values (${institutionId}::uuid, ${userId}::uuid, 'admin', ${sql.raw(
        `array[${serviceCodes.map((code) => `'${code}'`).join(",")}]::text[]`
      )}, 'active')`);

  await membership(proposer1.id, []);
  await membership(validator1.id, ["referent_numerique"]);
  await membership(validator2.id, ["referent_numerique"]);
  await membership(noService.id, []);

  const futureIso = (hours) => new Date(Date.now() + hours * 3_600_000).toISOString();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function proposeAndValidate(label, validatorToken, hoursUntilExpiry = 48) {
    const idemKey = `flash-pub-recette-${marker}-${label}`;
    const proposeBody = {
      title: `Information flash fictive ${label}`,
      bodyMarkdown: `Contenu fictif de recette publication (${label}).`,
      importance: "importante",
      channels: ["push", "email"],
      groupRefs: ["classe:6a-fictif"],
      expiresAt:
        typeof hoursUntilExpiry === "number"
          ? futureIso(hoursUntilExpiry)
          : new Date(Date.now() + hoursUntilExpiry.ms).toISOString(),
    };
    const created = await call(proposalsHandler, {
      headers: authHeaders(proposer1.token, idemKey),
      body: proposeBody,
    });
    if (created.status !== 201) {
      throw new Error(`propose_failed:${label}:${created.status}:${JSON.stringify(created.body)}`);
    }
    const flashInfoId = created.body.version.flashInfoId;
    const decision = await call(decisionHandler, {
      headers: authHeaders(validatorToken),
      query: { id: flashInfoId },
      body: { decision: "validee", content: null },
    });
    if (decision.status !== 200) {
      throw new Error(`decision_failed:${label}:${decision.status}:${JSON.stringify(decision.body)}`);
    }
    return { flashInfoId, versionId: decision.body.version.id };
  }

  // --- Scénario 1 : valider puis publier via la VRAIE route -> visible,
  // rien n'est envoyé. ---
  const s1 = await proposeAndValidate("s1", validator1.token);
  const publish1 = await call(publicationHandler, {
    headers: authHeaders(validator1.token),
    query: { id: s1.flashInfoId },
  });
  check(publish1.status, 200, "s1_publish_status");
  check(publish1.body.version.status, "publiee", "s1_publish_status_field");
  check(publish1.body.alreadyPublished, false, "s1_publish_not_already");

  const [{ count: dispatchCountAfterPublish1 }] = await db.execute(
    sql`select count(*)::integer as count from public.flash_notification_dispatches where version_id = ${s1.versionId}::uuid`
  );
  check(dispatchCountAfterPublish1, 0, "s1_no_dispatch_written");

  const publishedList1 = await call(publishedHandler, {
    method: "GET",
    headers: authHeaders(validator1.token),
  });
  check(publishedList1.status, 200, "s1_published_list_status");
  check(
    publishedList1.body.items.some((item) => item.version.id === s1.versionId),
    true,
    "s1_visible_in_published_list"
  );
  const publishableListAfter1 = await call(publishableHandler, {
    method: "GET",
    headers: authHeaders(validator1.token),
  });
  check(
    publishableListAfter1.body.items.some((item) => item.version.id === s1.versionId),
    false,
    "s1_no_longer_in_publishable_list"
  );
  results.scenario1_validate_then_publish =
    "prouvé par la vraie route POST .../publication : statut 'publiee', visible dans GET .../published, absent de GET .../publishable, aucune ligne flash_notification_dispatches écrite";

  // --- Scénario 2 : publier deux fois -> une seule publication, réponse
  // idempotente. ---
  const publish1Again = await call(publicationHandler, {
    headers: authHeaders(validator1.token),
    query: { id: s1.flashInfoId },
  });
  check(publish1Again.status, 200, "s2_replay_status");
  check(publish1Again.body.alreadyPublished, true, "s2_replay_already_published");
  check(publish1Again.body.version.publishedAt, publish1.body.version.publishedAt, "s2_replay_same_published_at");
  const [{ count: publishEventCountAfterReplay }] = await db.execute(
    sql`select count(*)::integer as count from public.flash_info_events
      where resource_id = ${s1.versionId}::uuid and event_type = 'flash_info.published'`
  );
  check(publishEventCountAfterReplay, 1, "s2_single_publish_event_row");
  results.scenario2_publish_twice =
    "prouvé : la seconde publication répond 200 avec alreadyPublished=true, même horodatage de publication, une seule ligne flash_info_events de type flash_info.published";

  // --- Scénario 3 : publier une information expirée -> refusé. ---
  // `flash_info_versions_check1` exige `expires_at > created_at` en
  // permanence (le trigger `flash_guard_version` interdit par ailleurs toute
  // mutation de `created_at`) : impossible de reculer l'échéance par SQL une
  // fois la ligne créée. On propose donc avec une échéance réellement proche
  // (3 s) puis on attend le temps réel qu'elle passe, sans jamais muter
  // `expires_at`/`created_at` nous-mêmes.
  const s3 = await proposeAndValidate("s3", validator1.token, { ms: 3000 });
  await sleep(3500);
  const publish3 = await call(publicationHandler, {
    headers: authHeaders(validator1.token),
    query: { id: s3.flashInfoId },
  });
  check(publish3.status, 409, "s3_expired_refused_status");
  check(typeof publish3.body.error === "string" && publish3.body.error.includes("expiré"), true, "s3_expired_refused_message");
  const [{ status: s3StatusAfterRefusal }] = await db.execute(
    sql`select status from public.flash_info_versions where id = ${s3.versionId}::uuid`
  );
  check(s3StatusAfterRefusal, "validee", "s3_status_unchanged_after_refusal");
  results.scenario3_publish_expired =
    "prouvé : une information validée dont l'échéance est déjà dépassée est refusée par la vraie route (409, message explicite), son statut reste 'validee'";

  // --- Scénario 4 : publier sans le service -> refusé. ---
  const s4 = await proposeAndValidate("s4", validator1.token);
  const publish4 = await call(publicationHandler, {
    headers: authHeaders(noService.token),
    query: { id: s4.flashInfoId },
  });
  check(publish4.status, 403, "s4_no_service_refused_status");
  check(
    publish4.body.error === "Cette validation n'est pas ouverte à ce compte.",
    true,
    "s4_no_service_refused_message"
  );
  const [{ status: s4StatusAfterRefusal }] = await db.execute(
    sql`select status from public.flash_info_versions where id = ${s4.versionId}::uuid`
  );
  check(s4StatusAfterRefusal, "validee", "s4_status_unchanged_after_refusal");
  results.scenario4_publish_without_service =
    "prouvé : un compte administration sans le service referent_numerique/ddfpt (et non superadmin) reçoit 403 en tentant de publier, exactement le même refus que pour valider (§13), le statut reste 'validee'";

  // --- Scénario 6 : une information validée jamais publiée qui expire ->
  // auteur prévenu, échec compté dans sa propre catégorie (T071F), distincte
  // des propositions jamais validées (T071D). ---
  const s6 = await proposeAndValidate("s6", validator1.token, { ms: 3000 });
  await sleep(3500);

  const cronRun = await call(cronHandler, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  check(cronRun.status, 200, "s6_cron_status");
  check(cronRun.body.expiredAfterValidationCount >= 1, true, "s6_cron_counted_at_least_one");

  const [s6Row] = await db.execute(
    sql`select status from public.flash_info_versions where id = ${s6.versionId}::uuid`
  );
  check(s6Row.status, "expiree_sans_publication", "s6_status_expired_after_validation");

  const [s6Event] = await db.execute(
    sql`select event_type, summary from public.flash_info_events
      where resource_id = ${s6.versionId}::uuid and event_type = 'version.expired_after_validation_without_publication'`
  );
  check(typeof s6Event, "object", "s6_event_row_exists");
  check(s6Event.summary.authorId, proposer1.id, "s6_event_author_is_proposer");
  check(s6Event.summary.authorNotice.status, "a_emettre", "s6_event_author_notice_not_emitted");
  check(
    typeof s6Event.summary.authorNotice.message === "string" &&
      s6Event.summary.authorNotice.message.includes("sans avoir été publiée"),
    true,
    "s6_event_has_author_notice_message"
  );

  const expiredAfterValidationList = await call(expiredAfterValidationHandler, {
    method: "GET",
    headers: authHeaders(validator1.token),
  });
  check(expiredAfterValidationList.status, 200, "s6_expired_after_validation_list_status");
  check(
    expiredAfterValidationList.body.items.some((item) => item.id === s6.versionId),
    true,
    "s6_listed_in_its_own_category"
  );

  const neverValidatedExpiredList = await call(expiredHandler, {
    method: "GET",
    headers: authHeaders(validator1.token),
  });
  check(
    neverValidatedExpiredList.body.items.some((item) => item.id === s6.versionId),
    false,
    "s6_not_counted_in_never_validated_category"
  );
  results.scenario6_validated_never_published_expires =
    "prouvé par le vrai cron (api/cron/flash-expiry) : transition validee -> expiree_sans_publication, avis factuel à l'auteur enregistré (flash_info_events, jamais émis), compté par GET .../expired-after-validation et absent de GET .../expired (T071D), catégories jamais fusionnées";

  // --- Scénario 7 : deux publications simultanées -> une seule gagne
  // (deux processus Node séparés, deux connexions Postgres distinctes). ---
  const s7 = await proposeAndValidate("s7", validator1.token);

  const workerPath = fileURLToPath(new URL("./flash-recette-publication-worker.mjs", import.meta.url));
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
          s7.flashInfoId,
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

  const [outcomeA, outcomeB] = await Promise.all([runWorker(validator1.token), runWorker(validator2.token)]);
  check([outcomeA.status, outcomeB.status], [200, 200], "s7_both_calls_succeed");
  const alreadyPublishedFlags = [outcomeA.body.alreadyPublished, outcomeB.body.alreadyPublished].sort();
  check(alreadyPublishedFlags, [false, true], "s7_exactly_one_real_winner");

  const [{ status: s7FinalStatus, published_by: s7PublishedBy }] = await db.execute(
    sql`select status, published_by from public.flash_info_versions where id = ${s7.versionId}::uuid`
  );
  check(s7FinalStatus, "publiee", "s7_final_status_publiee");
  check([validator1.id, validator2.id].includes(s7PublishedBy), true, "s7_winner_is_one_of_the_two_validators");

  const [{ count: s7PublishEventCount }] = await db.execute(
    sql`select count(*)::integer as count from public.flash_info_events
      where resource_id = ${s7.versionId}::uuid and event_type = 'flash_info.published'`
  );
  check(s7PublishEventCount, 1, "s7_single_publish_event_row");
  results.scenario7_concurrent_publication =
    "prouvé avec deux processus Node séparés (deux connexions Postgres distinctes) appelant la vraie route de publication au même instant : les deux réponses sont 200, une seule dit alreadyPublished=false, une seule ligne flash_info_events de type flash_info.published, statut final 'publiee'";
} finally {
  // --- Nettoyage best-effort. Même limite déjà documentée au LOT 7 :
  // `flash_info_events` est append-only par trigger et les FK RESTRICT sur
  // `flash_correction_decisions`/`flash_info_versions` interdisent la
  // suppression des comptes une fois qu'une décision existe. Sur cette pile
  // locale jetable ce n'est pas grave (elle disparaît au prochain
  // `supabase db reset`/`stop`).
  for (const userId of createdUserIds) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
  results.cleanup =
    "partiel et volontaire : comptes auth.users fictifs supprimés quand possible ; établissement et informations flash fictifs laissés en place (append-only + FK RESTRICT), purgés seulement par un futur supabase db reset/stop de cette pile locale jetable";
}

console.log(JSON.stringify({ target: "127.0.0.1:54322", assertions, results }, null, 2));
