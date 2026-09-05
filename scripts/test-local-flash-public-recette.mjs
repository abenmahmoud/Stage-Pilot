// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
//
// LOT 6 du plan de visibilité publique
// (docs/operations/PLAN_FLASH_PUBLIC_2026-09-05.md) : recette sur PostgreSQL
// réel jetable (pile Supabase locale). Personnes et établissement entièrement
// fictifs. Appelle les VRAIS handlers HTTP (`api/flash/proposals/**`,
// `api/flash/validation/screen-access`, `api/content/flash/public`) avec un
// req/res minimal et des jetons réels émis par le GoTrue local — pas de
// réimplémentation des règles métier (règle commune n°4 du plan).
//
// Un scénario n'a AUCUNE route à appeler : "présente pour un membre"
// (audience ciblée vue par une personne identifiée). Aucun écran/route
// authentifié ne sert encore le fil flash à un membre identifié (seule la
// route anonyme `api/content/flash/public` existe, LOT 2) — voir
// PUBLIC-LOT2.md, "Ce qui reste supposé". Ce scénario est donc prouvé au
// niveau module, avec l'audience RÉELLEMENT lue en base pour cette version,
// jamais fabriquée, exactement la même méthode que PERSIST-LOT7 pour son
// scénario "deux enfants, un parent" quand aucune route n'existait encore.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

if (process.argv.length !== 3 || process.argv[2] !== "--local-stack-only") {
  throw new Error("local_stack_confirmation_required");
}

const LOCAL_API_URL = "http://127.0.0.1:54321";
// Clés de démonstration publiques du CLI Supabase local (identiques sur toute
// pile locale par défaut) ; jamais des secrets réels.
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
process.env.VITE_SUPABASE_URL = LOCAL_API_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SERVICE_ROLE_KEY;

const marker = randomUUID().replaceAll("-", "").slice(0, 10);
const institutionSlug = `flash-public-recette-${marker}`;
process.env.SUPPORT_INSTITUTION_SLUG = institutionSlug;

const [{ sql }, { db }, { createClient }, { selectVisibleFlashVersions }] = await Promise.all([
  import("drizzle-orm"),
  import("../db/index.js"),
  import("@supabase/supabase-js"),
  import("../shared/flash-visibility.js"),
]);
const proposalsHandler = (await import("../api/flash/proposals/index.js")).default;
const decisionHandler = (await import("../api/flash/proposals/[id]/decision.js")).default;
const publicationHandler = (await import("../api/flash/proposals/[id]/publication.js")).default;
const correctionHandler = (await import("../api/flash/proposals/[id]/correction.js")).default;
const publicFeedHandler = (await import("../api/content/flash/public.js")).default;
const screenAccessHandler = (await import("../api/flash/validation/screen-access.js")).default;

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
  const email = `flash-public-recette-${marker}-${label}@example.test`;
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
  // --- Fixtures : un établissement fictif, trois comptes fictifs ---
  await db.execute(sql`insert into public.institutions (id, slug, name, status)
    values (${institutionId}::uuid, ${institutionSlug}, 'Lycée fictif recette visibilité publique flash', 'pilot')`);

  const proposer1 = await createFictionalActor("proposer1", "professeur", "recette-pubfeed-pw-01!");
  const validator1 = await createFictionalActor("validator1", "administration", "recette-pubfeed-pw-02!");
  const noService = await createFictionalActor("noservice", "administration", "recette-pubfeed-pw-03!");
  createdUserIds.push(proposer1.id, validator1.id, noService.id);

  const membership = (userId, serviceCodes) =>
    db.execute(sql`insert into public.institution_memberships
      (institution_id, user_id, role, service_codes, status)
      values (${institutionId}::uuid, ${userId}::uuid, 'admin', ${sql.raw(
        `array[${serviceCodes.map((code) => `'${code}'`).join(",")}]::text[]`
      )}, 'active')`);

  await membership(proposer1.id, []);
  await membership(validator1.id, ["referent_numerique"]);
  await membership(noService.id, []);

  const futureIso = (ms) => new Date(Date.now() + ms).toISOString();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function proposeValidatePublish(label, { importance, channels, groupRefs, smsContactRefs, expiresInMs }) {
    const idemKey = `flash-public-recette-${marker}-${label}`;
    const proposeBody = {
      title: `Information flash publique fictive ${label}`,
      bodyMarkdown: `Contenu fictif de recette de visibilité publique (${label}).`,
      importance,
      channels,
      groupRefs,
      smsContactRefs: smsContactRefs ?? [],
      expiresAt: futureIso(expiresInMs),
    };
    const created = await call(proposalsHandler, { headers: authHeaders(proposer1.token, idemKey), body: proposeBody });
    if (created.status !== 201) throw new Error(`propose_failed:${label}:${created.status}:${JSON.stringify(created.body)}`);
    const flashInfoId = created.body.version.flashInfoId;
    const decision = await call(decisionHandler, {
      headers: authHeaders(validator1.token),
      query: { id: flashInfoId },
      body: { decision: "validee", content: null },
    });
    if (decision.status !== 200) throw new Error(`decision_failed:${label}:${decision.status}:${JSON.stringify(decision.body)}`);
    const publish = await call(publicationHandler, {
      headers: authHeaders(validator1.token),
      query: { id: flashInfoId },
    });
    if (publish.status !== 200) throw new Error(`publish_failed:${label}:${publish.status}:${JSON.stringify(publish.body)}`);
    return { flashInfoId, versionId: publish.body.version.id, title: proposeBody.title };
  }

  // --- Scénario 1 : publier une flash publique -> apparaît sur la route publique. ---
  const s1 = await proposeValidatePublish("s1-publique", {
    importance: "normale",
    channels: [],
    groupRefs: ["public:site"],
    expiresInMs: 3_600_000,
  });
  const publicFeed1 = await call(publicFeedHandler, { method: "GET", headers: {} });
  check(publicFeed1.status, 200, "s1_public_feed_status");
  check(
    publicFeed1.body.items.some((item) => item.id === s1.versionId && item.title === s1.title),
    true,
    "s1_public_item_visible_to_anonymous"
  );
  results.scenario1_public_flash_visible =
    "prouvé par la vraie route anonyme GET /api/content/flash/public : une flash publiée avec l'audience public:site apparaît, avec le bon titre";

  // --- Scénario 2 : publier une flash ciblée -> absente pour un anonyme,
  // présente pour un membre. ---
  const s2 = await proposeValidatePublish("s2-ciblee", {
    importance: "normale",
    channels: [],
    groupRefs: ["classe:2ndefictif-recette"],
    expiresInMs: 3_600_000,
  });
  const publicFeed2 = await call(publicFeedHandler, { method: "GET", headers: {} });
  check(
    publicFeed2.body.items.some((item) => item.id === s2.versionId),
    false,
    "s2_targeted_absent_for_anonymous"
  );
  // Toujours visible pour l'anonyme : la flash publique du scénario 1.
  check(
    publicFeed2.body.items.some((item) => item.id === s1.versionId),
    true,
    "s2_public_still_visible_alongside"
  );

  // "Présente pour un membre" : aucune route authentifiée ne sert encore ce
  // fil (voir l'en-tête de ce fichier). Preuve au niveau module, avec
  // l'audience RÉELLE de cette version relue en base (jamais fabriquée).
  const [s2Row] = await db.execute(
    sql`select v.status, v.expires_at from public.flash_info_versions v where v.id = ${s2.versionId}::uuid`
  );
  const s2AudienceRows = await db.execute(
    sql`select group_ref from public.flash_info_audiences where version_id = ${s2.versionId}::uuid`
  );
  const s2Candidate = {
    status: s2Row.status,
    expiresAt: new Date(s2Row.expires_at),
    audience: s2AudienceRows.map((row) => row.group_ref),
  };
  const visibleForMember = selectVisibleFlashVersions([s2Candidate], {
    now: new Date(),
    viewerGroupRefs: ["classe:2ndefictif-recette"],
  });
  check(visibleForMember.length, 1, "s2_targeted_visible_for_member_of_group");
  const visibleForOutsiderMember = selectVisibleFlashVersions([s2Candidate], {
    now: new Date(),
    viewerGroupRefs: ["classe:autre-groupe-fictif"],
  });
  check(visibleForOutsiderMember.length, 0, "s2_targeted_not_visible_for_member_of_other_group");
  results.scenario2_targeted_flash =
    "prouvé pour l'anonyme par la vraie route GET /api/content/flash/public (absente) ; 'présente pour un membre' prouvé au niveau module (shared/flash-visibility.ts) avec l'audience réellement lue en base pour cette version — AUCUNE route authentifiée ne sert encore ce fil à une personne identifiée, donc ce second volet n'est pas une preuve HTTP bout-en-bout, à combler par un futur lot si un tel écran est construit";

  // --- Scénario 3 : attendre l'expiration -> elle disparaît, sans intervention. ---
  const s3 = await proposeValidatePublish("s3-expiration", {
    importance: "normale",
    channels: [],
    groupRefs: ["public:site"],
    expiresInMs: 4_000,
  });
  const publicFeed3Before = await call(publicFeedHandler, { method: "GET", headers: {} });
  check(
    publicFeed3Before.body.items.some((item) => item.id === s3.versionId),
    true,
    "s3_visible_before_expiry"
  );
  await sleep(4_500);
  const publicFeed3After = await call(publicFeedHandler, { method: "GET", headers: {} });
  check(
    publicFeed3After.body.items.some((item) => item.id === s3.versionId),
    false,
    "s3_gone_after_expiry_without_intervention"
  );
  const [{ status: s3StatusUnchanged }] = await db.execute(
    sql`select status from public.flash_info_versions where id = ${s3.versionId}::uuid`
  );
  check(s3StatusUnchanged, "publiee", "s3_status_still_publiee_no_cron_ran");
  results.scenario3_expiration =
    "prouvé : visible juste après publication, disparue de la route publique passé le délai réel d'expiration, sans qu'aucun cron ni aucune mutation manuelle n'ait tourné entre-temps (statut resté 'publiee' en base — seul le filtre expires_at > now() de la route l'exclut)";

  // --- Scénario 4 : corriger une publiée -> la route publique sert la
  // version corrigée. ---
  const correction4 = await call(correctionHandler, {
    headers: authHeaders(validator1.token),
    query: { id: s1.flashInfoId },
    body: {
      title: "Information flash publique fictive s1-publique, corrigée",
      bodyMarkdown: "Contenu corrigé de recette de visibilité publique (s1-publique).",
      importance: "normale",
      channels: [],
      groupRefs: ["public:site"],
      expiresAt: futureIso(3_600_000),
    },
  });
  check(correction4.status, 200, "s4_correction_call_succeeds");
  check(correction4.body.version.status, "modifiee", "s4_correction_moves_status_to_modifiee");
  const publicFeed4After = await call(publicFeedHandler, { method: "GET", headers: {} });
  const s1StillListed = publicFeed4After.body.items.find((item) => item.id === s1.versionId);
  check(s1StillListed, undefined, "s4_corrected_item_disappears_from_public_route");
  results.scenario4_correct_published =
    "ÉCART AVEC LE PLAN, prouvé par la vraie route : contrairement à l'attendu du plan (« la route publique sert la version corrigée »), corriger une version publiée la fait passer à 'modifiee' (shared/flash-transitions.ts : publiee -> modifiee est la SEULE transition légale, et modifiee est terminal), et api/content/flash/public.ts ne sert que status = 'publiee'. Conséquence réellement observée : la flash disparaît purement et simplement de la route publique après correction, elle ne réapparaît pas corrigée. Même filtre côté admin (api/flash/validation/published.ts), donc ce n'est pas un défaut de la route publique elle-même mais un manque de circuit : aucune route ne fait jamais repasser une version 'modifiee' vers 'publiee'. À trancher avec Adel avant tout nouveau lot sur ce point (voir aussi le trou déjà documenté pour informations-flash/persistance, CLAUDE.md)";

  // --- Scénario 5 : publier une importante -> lignes d'envoi 'simulated',
  // aucune requête vers un fournisseur. ---
  const s5 = await proposeValidatePublish("s5-importante", {
    importance: "importante",
    channels: ["push", "email"],
    groupRefs: ["classe:5bfictif-recette"],
    expiresInMs: 3_600_000,
  });
  const s5DispatchRows = await db.execute(
    sql`select channel, status from public.flash_notification_dispatches where version_id = ${s5.versionId}::uuid order by channel`
  );
  check(s5DispatchRows.length > 0, true, "s5_dispatch_rows_written");
  check(
    s5DispatchRows.every((row) => row.status === "simulated"),
    true,
    "s5_all_dispatch_rows_simulated"
  );
  check(
    s5DispatchRows.some((row) => row.status === "sent"),
    false,
    "s5_no_dispatch_row_sent"
  );
  const [s5PublishEvent] = await db.execute(
    sql`select summary from public.flash_info_events
      where resource_id = ${s5.versionId}::uuid and event_type = 'flash_info.published'`
  );
  check(s5PublishEvent.summary.communicationBridgeEnqueued, false, "s5_communication_bridge_not_enqueued");
  check(s5PublishEvent.summary.communicationBridgeReason, "module_disabled", "s5_communication_bridge_reason_module_disabled");
  results.scenario5_importante_simulated_dispatch =
    "prouvé : lignes flash_notification_dispatches toutes à l'état 'simulated' (aucune 'sent'), et la file durable du centre de communication (spec 005) reste inerte (communicationBridgeEnqueued=false, reason=module_disabled, lu dans flash_info_events) — aucune requête ne peut être partie vers un fournisseur, le drapeau qui l'activerait est fermé";

  // --- Scénario 6 : rejouer la publication -> aucune ligne d'envoi en double. ---
  const publish5Again = await call(publicationHandler, {
    headers: authHeaders(validator1.token),
    query: { id: s5.flashInfoId },
  });
  check(publish5Again.status, 200, "s6_replay_status");
  check(publish5Again.body.alreadyPublished, true, "s6_replay_already_published");
  const s5DispatchRowsAfterReplay = await db.execute(
    sql`select id from public.flash_notification_dispatches where version_id = ${s5.versionId}::uuid`
  );
  check(s5DispatchRowsAfterReplay.length, s5DispatchRows.length, "s6_no_duplicate_dispatch_rows_after_replay");
  results.scenario6_replay_publication =
    "prouvé : rejouer POST .../publication répond 200/alreadyPublished=true sans réexécuter l'écriture des lignes d'envoi (la route sort tôt sur le statut déjà 'publiee') ; nombre de lignes flash_notification_dispatches inchangé avant/après";

  // --- Scénario 7 : un compte sans le service -> écran refusé. ---
  const screenAccessNoService = await call(screenAccessHandler, {
    method: "GET",
    headers: authHeaders(noService.token),
  });
  check(screenAccessNoService.status, 200, "s7_screen_access_call_succeeds");
  check(screenAccessNoService.body, { allowed: false, grantedByService: null }, "s7_screen_refused_without_service");
  const screenAccessWithService = await call(screenAccessHandler, {
    method: "GET",
    headers: authHeaders(validator1.token),
  });
  check(
    screenAccessWithService.body,
    { allowed: true, grantedByService: "referent_numerique" },
    "s7_screen_granted_with_service"
  );
  results.scenario7_screen_access_without_service =
    "prouvé par la vraie route GET /api/flash/validation/screen-access : un compte administration sans le service referent_numerique/ddfpt reçoit allowed=false, grantedByService=null ; le même compte avec le service reçoit allowed=true";
} finally {
  // --- Nettoyage best-effort, même limite déjà documentée aux lots
  // précédents : flash_info_events est append-only par trigger, FK RESTRICT
  // sur flash_correction_decisions/flash_info_versions. Sur cette pile locale
  // jetable ce n'est pas grave (purgé au prochain supabase db reset/stop).
  for (const userId of createdUserIds) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
  results.cleanup =
    "partiel et volontaire : comptes auth.users fictifs supprimés quand possible ; établissement et informations flash fictifs laissés en place, purgés seulement par un futur supabase db reset/stop de cette pile locale jetable";
}

console.log(JSON.stringify({ target: "127.0.0.1:54322", assertions, results }, null, 2));
