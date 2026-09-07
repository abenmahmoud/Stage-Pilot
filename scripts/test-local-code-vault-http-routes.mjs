// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
//
// LOT 3 (docs/operations/PLAN_ENT_ACTIF_ET_DETTE_2026-09-06.md) : jusqu'ici,
// toutes les preuves du coffre de codes passaient soit par un appel direct
// aux fonctions assemblées (`handleEntInactifVaultRequest`,
// `handleServiceDeliveryVaultRequest`, ...), soit par un `req`/`res` minimal
// fabriqué à la main (voir `scripts/test-local-flash-persistence.mjs`).
// Personne n'avait donc vérifié la couche `api/vault/*.ts` elle-même :
// dispatch de méthode, lecture de l'en-tête `Authorization`, forme réelle
// d'une réponse HTTP (statuts, en-têtes, JSON).
//
// Ce script démarre un VRAI serveur HTTP Node (`node:http`), monte les cinq
// fonctions `export default` de `api/vault/{ent-actif,ent-inactif,cantine,
// koxo,messagerie-academique}.ts` derrière un adaptateur minimal — juste ce
// que ces handlers utilisent réellement de la forme Vercel
// (`req.method`, `req.headers`, `req.body`, `res.status().json()`,
// `res.setHeader`, `res.headersSent`, déjà natif sur `http.ServerResponse`)
// — puis leur envoie de vraies requêtes `fetch()` en boucle locale.
//
// Volontairement PAS `vercel dev` : cette commande exige `vercel link`, donc
// un rattachement à un projet Vercel, ce que CLAUDE.md interdit ("Aucune
// mutation Vercel") et que `docs/operations/night-logs/PERSIST-LOT8.md`
// écarte déjà pour la même raison. L'adaptateur ci-dessous ne réimplémente
// aucune règle métier : il ne fait que transporter la requête/réponse, tout
// le reste (authentification, autorisation, décision, écriture) reste dans
// le code réel déjà écrit et déjà recetté isolément.
//
// Personnes et établissement entièrement fictifs, jamais `--linked`, jamais
// `db push`, jamais d'URL distante, pile Supabase locale jetable uniquement.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

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
const institutionSlug = `coffre-lot3-http-${marker}`;
process.env.SUPPORT_INSTITUTION_SLUG = institutionSlug;

// Imports dynamiques, après avoir posé les variables d'environnement dont
// `db/index.ts` et `api/_shared/auth.ts` ont besoin dès leur chargement
// (même contrainte que `scripts/test-local-flash-persistence.mjs`).
const [{ sql }, { db }, { createClient }] = await Promise.all([
  import("drizzle-orm"),
  import("../db/index.js"),
  import("@supabase/supabase-js"),
]);
const entActifHandler = (await import("../api/vault/ent-actif.js")).default;
const entInactifHandler = (await import("../api/vault/ent-inactif.js")).default;
const cantineHandler = (await import("../api/vault/cantine.js")).default;
const koxoHandler = (await import("../api/vault/koxo.js")).default;
const messagerieHandler = (await import("../api/vault/messagerie-academique.js")).default;

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

// ---------------------------------------------------------------------------
// Adaptateur HTTP minimal : juste ce que les cinq routes utilisent réellement
// de la forme `@vercel/node` (`req.method`, `req.headers`, `req.body`,
// `res.status().json()`). `res.headersSent` et `res.setHeader` sont déjà
// natifs sur `http.ServerResponse`, jamais réimplémentés ici.
// ---------------------------------------------------------------------------
function withVercelResponseShim(res) {
  res.status = function status(code) {
    res.statusCode = code;
    return res;
  };
  res.json = function json(data) {
    if (!res.hasHeader("Content-Type")) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify(data));
    return res;
  };
  return res;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function createVaultHttpServer(routes) {
  return createServer(async (req, res) => {
    withVercelResponseShim(res);
    const url = new URL(req.url, "http://127.0.0.1");
    const handler = routes[url.pathname];
    if (!handler) {
      res.status(404).json({ error: "not_found_in_recipe_harness" });
      return;
    }
    try {
      req.body = await readJsonBody(req);
    } catch {
      res.status(400).json({ error: "invalid_json_body_in_recipe_harness" });
      return;
    }
    req.query = Object.fromEntries(url.searchParams);
    await handler(req, res);
  });
}

const routes = {
  "/api/vault/ent-actif": entActifHandler,
  "/api/vault/ent-inactif": entInactifHandler,
  "/api/vault/cantine": cantineHandler,
  "/api/vault/koxo": koxoHandler,
  "/api/vault/messagerie-academique": messagerieHandler,
};
const server = createVaultHttpServer(routes);
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;

// Balayage anti-fuite : tout ce qu'un client a reçu, sur toute l'exécution.
const capturedResponses = [];

async function call(pathName, { method = "POST", token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers["authorization"] = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${pathName}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  capturedResponses.push({ pathName, method, status: response.status, text });
  return { status: response.status, headers: response.headers, json };
}

// ---------------------------------------------------------------------------
// Fixtures : un établissement fictif, trois comptes fictifs (un élève réel
// pour les cinq parcours self-service, un professeur réel pour la vérif
// structurelle « cantine refuse le professeur », un rôle absent des cinq
// routes pour la vérif générique de refus de rôle).
// ---------------------------------------------------------------------------
const admin = createClient(LOCAL_API_URL, LOCAL_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createFictionalActor(label, role, password) {
  const email = `coffre-lot3-http-${marker}-${label}@example.test`;
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
  await db.execute(sql`
    insert into public.institutions (id, slug, name, status)
    values (${institutionId}, ${institutionSlug}, 'Lycée fictif — LOT 3 HTTP réel', 'pilot')
  `);

  const eleve = await createFictionalActor("eleve", "eleve", "recette-lot3-http-pw-01!");
  const professeur = await createFictionalActor("professeur", "professeur", "recette-lot3-http-pw-02!");
  const outsiderRole = await createFictionalActor("outsider", "administration", "recette-lot3-http-pw-03!");
  createdUserIds.push(eleve.id, professeur.id, outsiderRole.id);

  async function accessEventsFor(actorPersonRef) {
    const rows = await db.execute(sql`
      select event_type from public.code_vault_access_events
      where institution_id = ${institutionId} and actor_person_ref = ${actorPersonRef}
      order by id asc
    `);
    return Array.from(rows);
  }

  async function supportTicketsFor(subcategory) {
    const rows = await db.execute(sql`
      select public_code, assigned_team, category, subcategory
      from public.support_requests
      where institution_id = ${institutionId} and subcategory = ${subcategory}
      order by created_at asc
    `);
    return Array.from(rows);
  }

  async function assignmentFor(service, personRef) {
    const rows = await db.execute(sql`
      select id, display_count from public.code_vault_assignments
      where institution_id = ${institutionId} and person_ref = ${personRef} and service = ${service}
    `);
    return Array.from(rows);
  }

  // -------------------------------------------------------------------
  // Scénarios communs aux cinq routes : méthode, en-tête, forme d'erreur.
  // -------------------------------------------------------------------
  const commonRouteCases = [
    { name: "ent-actif", path: "/api/vault/ent-actif", allowedRoles: ["eleve", "professeur"], invalidBody: { outcome: "pas_un_vrai_outcome" } },
    {
      name: "ent-inactif",
      path: "/api/vault/ent-inactif",
      allowedRoles: ["eleve", "professeur"],
      invalidBody: { phase: "pas_une_vraie_phase", proofChannel: "email", schoolYear: "2026-2027" },
    },
    {
      name: "cantine",
      path: "/api/vault/cantine",
      allowedRoles: ["eleve"],
      invalidBody: { phase: "pas_une_vraie_phase", proofChannel: "email", schoolYear: "2026-2027" },
    },
    {
      name: "koxo",
      path: "/api/vault/koxo",
      allowedRoles: ["eleve", "professeur"],
      invalidBody: { phase: "pas_une_vraie_phase", proofChannel: "phone", schoolYear: "2026-2027" },
    },
    {
      name: "messagerie-academique",
      path: "/api/vault/messagerie-academique",
      allowedRoles: ["eleve", "professeur"],
      invalidBody: { phase: "verified", emailVerifiable: "oui" },
    },
  ];

  for (const routeCase of commonRouteCases) {
    // Méthode : GET refusé, `Allow: POST`, aucun `Cache-Control` (ce
    // chemin renvoie avant `handleApi`, qui est le seul à le poser).
    const getResponse = await call(routeCase.path, { method: "GET" });
    check(getResponse.status, 405, `${routeCase.name}_get_method_not_allowed`);
    check(getResponse.headers.get("allow"), "POST", `${routeCase.name}_get_allow_header_names_post`);
    check(getResponse.json, { error: "Method not allowed" }, `${routeCase.name}_get_error_shape`);
    check(getResponse.headers.get("cache-control"), null, `${routeCase.name}_method_rejection_sets_no_cache_control`);

    // Authentification : aucun jeton, 401, aucune fuite au-delà du message.
    const noAuthResponse = await call(routeCase.path, { method: "POST", body: {} });
    check(noAuthResponse.status, 401, `${routeCase.name}_no_token_unauthenticated`);
    check(noAuthResponse.json, { error: "Non authentifié" }, `${routeCase.name}_no_token_error_shape`);
    check(noAuthResponse.headers.get("cache-control"), "no-store, max-age=0", `${routeCase.name}_handleApi_path_sets_cache_control`);

    // Rôle absent des cinq routes : 403, message précis, forme stricte.
    const wrongRoleResponse = await call(routeCase.path, { method: "POST", token: outsiderRole.token, body: {} });
    check(wrongRoleResponse.status, 403, `${routeCase.name}_wrong_role_forbidden`);
    check(Object.keys(wrongRoleResponse.json ?? {}), ["error"], `${routeCase.name}_wrong_role_error_has_only_error_key`);
    check(
      typeof wrongRoleResponse.json?.error === "string" && wrongRoleResponse.json.error.includes("Rôle insuffisant"),
      true,
      `${routeCase.name}_wrong_role_error_message`
    );
    const eventsAfterWrongRole = await accessEventsFor(outsiderRole.id);
    check(eventsAfterWrongRole.length, 0, `${routeCase.name}_wrong_role_refusal_writes_nothing_to_the_vault_journal`);

    // Corps invalide, mais rôle et jeton valides : exception applicative
    // réelle (`Error` levée par `parseXRequestInput`, jamais une `HttpError`)
    // qui doit ressortir strictement sanitisée : exactement
    // `{ error: "Erreur serveur" }`, jamais `detail`, `cause`, `stack`, ni le
    // message technique de validation.
    const validToken = routeCase.allowedRoles.includes("eleve") ? eleve.token : professeur.token;
    const invalidBodyResponse = await call(routeCase.path, { method: "POST", token: validToken, body: routeCase.invalidBody });
    check(invalidBodyResponse.status, 500, `${routeCase.name}_invalid_body_is_a_server_error`);
    check(invalidBodyResponse.json, { error: "Erreur serveur" }, `${routeCase.name}_invalid_body_error_is_fully_sanitized`);
  }

  // -------------------------------------------------------------------
  // Restriction structurelle propre à la cantine : le professeur est
  // exclu du rôle même, pas seulement de la décision d'autorisation (voir
  // l'en-tête de `api/vault/cantine.ts`) — vérifié ici par une vraie
  // requête, pas seulement par lecture du code.
  // -------------------------------------------------------------------
  const professeurOnCantine = await call("/api/vault/cantine", {
    method: "POST",
    token: professeur.token,
    body: { phase: "before_proof", proofChannel: "email", schoolYear: "2026-2027" },
  });
  check(professeurOnCantine.status, 403, "cantine_structurally_excludes_professeur_role");
  results.cantine_excludes_professeur_at_the_role_layer =
    "prouvé par une vraie requête HTTP : le professeur reçoit 403 avant même `decideVaultAccess`, exactement comme documenté dans l'en-tête de la route";

  // -------------------------------------------------------------------
  // Succès réels, un par route, avec vérification de l'écriture réelle en
  // base déclenchée PAR LA REQUÊTE HTTP elle-même (pas par un appel direct
  // à la fonction assemblée).
  // -------------------------------------------------------------------

  // ent-actif : "succeeded" journalise `activation_confirmed`, puis
  // "failed" (même acteur, même route) ouvre un vrai ticket support.
  const entActifSucceeded = await call("/api/vault/ent-actif", {
    method: "POST",
    token: eleve.token,
    body: { outcome: "succeeded" },
  });
  check(entActifSucceeded.status, 200, "ent_actif_succeeded_returns_200");
  check(entActifSucceeded.json, { outcome: "confirmed" }, "ent_actif_succeeded_body");
  const entActifEvents = await accessEventsFor(eleve.id);
  check(
    entActifEvents.some((row) => row.event_type === "activation_confirmed"),
    true,
    "ent_actif_succeeded_wrote_activation_confirmed_via_real_http_call"
  );

  const entActifFailed = await call("/api/vault/ent-actif", {
    method: "POST",
    token: eleve.token,
    body: { outcome: "failed" },
  });
  check(entActifFailed.status, 200, "ent_actif_failed_returns_200");
  check(entActifFailed.json?.outcome, "escalated", "ent_actif_failed_escalates");
  const entActifTickets = await supportTicketsFor("ent_reset_failed");
  check(entActifTickets.length, 1, "ent_actif_failed_opened_exactly_one_real_ticket_via_http");
  check(entActifTickets[0].assigned_team, "referent_numerique", "ent_actif_failed_ticket_routes_to_referent_numerique");
  results.ent_actif_real_writes_via_http =
    "prouvé : `succeeded` journalise `activation_confirmed`, `failed` ouvre un vrai ticket support — les deux déclenchés par une vraie requête HTTP, pas par un appel direct";

  // ent-inactif : "verified" crée une attribution réelle et journalise
  // `consult` ; le drapeau de lecture restant fermé, `value` reste `null`.
  const entInactifVerified = await call("/api/vault/ent-inactif", {
    method: "POST",
    token: eleve.token,
    body: { phase: "verified", proofChannel: "email", schoolYear: "2026-2027" },
  });
  check(entInactifVerified.status, 200, "ent_inactif_verified_returns_200");
  check(entInactifVerified.json?.outcome, "displayed", "ent_inactif_verified_outcome");
  check(entInactifVerified.json?.value, null, "ent_inactif_reveal_flag_still_closed_value_null");
  check(entInactifVerified.json?.reason, "reveal_disabled", "ent_inactif_reveal_flag_still_closed_reason");
  const entAssignments = await assignmentFor("ent", eleve.id);
  check(entAssignments.length, 1, "ent_inactif_created_exactly_one_real_assignment_via_http");
  const entInactifEvents = await accessEventsFor(eleve.id);
  check(
    entInactifEvents.some((row) => row.event_type === "consult"),
    true,
    "ent_inactif_verified_wrote_a_consult_event_via_real_http_call"
  );
  results.ent_inactif_real_write_via_http =
    "prouvé : une vraie requête HTTP `phase: verified` crée une attribution réelle et journalise `consult` ; le drapeau `CODE_VAULT_REVEAL_ENABLED` restant fermé, `value` reste `null`";

  // cantine : "lookup_failed" ouvre un vrai ticket vers l'intendance.
  const cantineLookupFailed = await call("/api/vault/cantine", {
    method: "POST",
    token: eleve.token,
    body: { phase: "lookup_failed", proofChannel: "email", schoolYear: "2026-2027" },
  });
  check(cantineLookupFailed.status, 200, "cantine_lookup_failed_returns_200");
  check(cantineLookupFailed.json?.outcome, "escalated", "cantine_lookup_failed_escalates");
  const cantineTickets = await supportTicketsFor("cantine_badge_not_found");
  check(cantineTickets.length, 1, "cantine_lookup_failed_opened_exactly_one_real_ticket_via_http");
  check(cantineTickets[0].assigned_team, "intendance", "cantine_ticket_routes_to_intendance");
  results.cantine_real_write_via_http =
    "prouvé : une vraie requête HTTP `phase: lookup_failed` ouvre un vrai ticket vers l'intendance";

  // koxo : "lookup_failed" ouvre un vrai ticket vers le référent numérique.
  const koxoLookupFailed = await call("/api/vault/koxo", {
    method: "POST",
    token: eleve.token,
    body: { phase: "lookup_failed", proofChannel: "phone", schoolYear: "2026-2027" },
  });
  check(koxoLookupFailed.status, 200, "koxo_lookup_failed_returns_200");
  check(koxoLookupFailed.json?.outcome, "escalated", "koxo_lookup_failed_escalates");
  const koxoTickets = await supportTicketsFor("koxo_code_not_found");
  check(koxoTickets.length, 1, "koxo_lookup_failed_opened_exactly_one_real_ticket_via_http");
  check(koxoTickets[0].assigned_team, "referent_numerique", "koxo_ticket_routes_to_referent_numerique");
  results.koxo_real_write_via_http =
    "prouvé : une vraie requête HTTP `phase: lookup_failed` ouvre un vrai ticket vers le référent numérique";

  // messagerie académique : "verified" + email vérifiable confirme et
  // journalise `consult`, sans jamais créer d'attribution (pas de code ici).
  const messagerieVerified = await call("/api/vault/messagerie-academique", {
    method: "POST",
    token: eleve.token,
    body: { phase: "verified", emailVerifiable: true },
  });
  check(messagerieVerified.status, 200, "messagerie_verified_returns_200");
  check(messagerieVerified.json, { outcome: "confirmed" }, "messagerie_verified_body");
  const messagerieEvents = await accessEventsFor(eleve.id);
  check(
    messagerieEvents.some((row) => row.event_type === "consult"),
    true,
    "messagerie_verified_wrote_a_consult_event_via_real_http_call"
  );
  results.messagerie_academique_real_write_via_http =
    "prouvé : une vraie requête HTTP `phase: verified, emailVerifiable: true` journalise `consult`, sans jamais créer d'attribution";

  // -------------------------------------------------------------------
  // GAP CONFIRMÉ (déjà documenté dans le commentaire de
  // `scripts/test-local-code-vault-ent-inactif-route.mjs`, revérifié ici
  // pour les cinq routes) : les cinq routes construisent toujours
  // `actor.institutionId === target.institutionId` (le même établissement
  // configuré) et `target.subjectPersonRef === user.id` (toujours
  // l'appelant lui-même). Aucun champ du corps de requête ne permet de
  // désigner une autre institution ou un autre sujet. La branche `denied`
  // de `decideVaultAccess` — donc l'écriture `access_denied` au journal —
  // reste par construction inatteignable par une vraie requête HTTP
  // légitime sur ces cinq routes : seul un appel direct à la fonction
  // assemblée (déjà fait par les recettes du LOT 1/3/4 du plan de
  // branchement) peut l'exercer aujourd'hui. Ce n'est pas un défaut trouvé
  // par ce lot, c'est la confirmation, au niveau HTTP, d'une limite déjà
  // connue.
  // -------------------------------------------------------------------
  results.denied_branch_unreachable_via_real_http =
    "CONFIRMÉ (pas nouveau) : sur les cinq routes, l'acteur et la cible portent toujours la même institution et le même identifiant (self-service serveur, jamais le corps de requête) — `decideVaultAccess` ne peut donc jamais refuser via une vraie requête HTTP légitime ; seul l'appel direct à la fonction assemblée l'exerce (déjà fait par les recettes existantes du plan de branchement)";

  // -------------------------------------------------------------------
  // Balayage anti-fuite final sur TOUT ce qu'un client a reçu pendant ce
  // script : jamais `detail`, `cause`, `stack`, ni la trace verbatim d'une
  // erreur Postgres, quel que soit le scénario.
  // -------------------------------------------------------------------
  const leakyPattern = /"detail"|"cause"|"stack"|Failing row|postgres|PG::|SanitizedPg/i;
  const leakedResponses = capturedResponses.filter((entry) => leakyPattern.test(entry.text));
  check(leakedResponses, [], "no_captured_http_response_ever_leaks_a_postgres_or_stack_detail");
} finally {
  for (const userId of createdUserIds) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
  await new Promise((resolve) => server.close(resolve));
  results.cleanup =
    "partiel et volontaire : comptes auth.users fictifs supprimés quand possible ; établissement, attributions, événements de journal et tickets support fictifs laissés en place sur cette pile locale jetable, purgés seulement par un futur `supabase db reset`/`stop` (même choix que scripts/test-local-flash-persistence.mjs)";
}

console.log(
  JSON.stringify(
    {
      target: "127.0.0.1:54322 (Postgres) + 127.0.0.1:54321 (GoTrue) via un vrai serveur HTTP local",
      assertions,
      results,
      realData: false,
    },
    null,
    2
  )
);
