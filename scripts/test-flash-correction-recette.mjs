// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
//
// LOT 4 du plan de correction visible
// (docs/operations/PLAN_FLASH_CORRECTION_VISIBLE_2026-09-05.md) : recette sur
// PostgreSQL réel jetable (pile Supabase locale). Personnes et établissement
// entièrement fictifs. Appelle les VRAIS handlers HTTP (`api/flash/proposals/**`,
// `api/flash/validation/**`, `api/content/flash/public`) avec un req/res
// minimal et des jetons réels émis par le GoTrue local — pas de
// réimplémentation des règles métier (règle commune n°4 du plan), même
// convention que scripts/test-local-flash-publication-recette.mjs (LOT 4 du
// plan de publication).
//
// Scénarios du LOT 4 :
//  1. publier, corriger, constater ce que sert réellement la route publique
//     pendant que la correction n'est pas encore republiée ;
//  2. tenter de republier la correction par la VRAIE route de publication ;
//  3. vérifier à chaque étape si la page publique reste non vide ;
//  4. proposer une flash "visible par tous" (public:site), la valider, la
//     publier, la voir sur la route publique.
//
// Ce script ne corrige aucun bug : il exécute la recette telle que le plan la
// décrit et rapporte fidèlement ce qui se passe réellement en base, y compris
// un échec, conformément à CLAUDE.md ("une preuve locale n'est pas une
// recette distante" / "ne pas fermer une tâche sans preuve réellement
// exécutée").

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
const institutionSlug = `flash-corr-recette-${marker}`;
process.env.SUPPORT_INSTITUTION_SLUG = institutionSlug;

const [{ sql }, { db }, { createClient }] = await Promise.all([
  import("drizzle-orm"),
  import("../db/index.js"),
  import("@supabase/supabase-js"),
]);
const proposalsHandler = (await import("../api/flash/proposals/index.js")).default;
const decisionHandler = (await import("../api/flash/proposals/[id]/decision.js")).default;
const publicationHandler = (await import("../api/flash/proposals/[id]/publication.js")).default;
const correctionHandler = (await import("../api/flash/proposals/[id]/correction.js")).default;
const publishableHandler = (await import("../api/flash/validation/publishable.js")).default;
const publicFeedHandler = (await import("../api/content/flash/public.js")).default;

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
  const email = `flash-corr-recette-${marker}-${label}@example.test`;
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
const findings = {};
const institutionId = randomUUID();

const futureIso = (hours) => new Date(Date.now() + hours * 3_600_000).toISOString();

async function proposeAndValidate(label, proposerToken, validatorToken, groupRefs) {
  const idemKey = `flash-corr-recette-${marker}-${label}`;
  const proposeBody = {
    title: `Information flash fictive ${label} — avant correction`,
    bodyMarkdown: `Contenu fictif AVANT correction (${label}).`,
    importance: "importante",
    channels: ["push"],
    groupRefs,
    expiresAt: futureIso(48),
  };
  const created = await call(proposalsHandler, {
    headers: authHeaders(proposerToken, idemKey),
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

try {
  // --- Fixtures : un établissement fictif, deux comptes fictifs (un
  // proposant, un référent numérique). ---
  await db.execute(sql`insert into public.institutions (id, slug, name, status)
    values (${institutionId}::uuid, ${institutionSlug}, 'Lycée fictif recette correction visible', 'pilot')`);

  const proposer = await createFictionalActor("proposer", "professeur", "recette-corr-pw-01!");
  const validator = await createFictionalActor("validator", "administration", "recette-corr-pw-02!");
  createdUserIds.push(proposer.id, validator.id);

  const membership = (userId, serviceCodes) =>
    db.execute(sql`insert into public.institution_memberships
      (institution_id, user_id, role, service_codes, status)
      values (${institutionId}::uuid, ${userId}::uuid, 'admin', ${sql.raw(
        `array[${serviceCodes.map((code) => `'${code}'`).join(",")}]::text[]`
      )}, 'active')`);

  await membership(proposer.id, []);
  await membership(validator.id, ["referent_numerique"]);

  // === Scénario A : publier, puis corriger — que sert la route publique
  // pendant la fenêtre "corrigée mais pas republiée" ? ===
  const a = await proposeAndValidate("a", proposer.token, validator.token, ["public:site"]);
  const publishA = await call(publicationHandler, {
    headers: authHeaders(validator.token),
    query: { id: a.flashInfoId },
  });
  check(publishA.status, 200, "a_publish_status");
  check(publishA.body.version.status, "publiee", "a_publish_status_field");

  const publicBeforeCorrection = await call(publicFeedHandler, { method: "GET" });
  check(publicBeforeCorrection.status, 200, "a_public_feed_status_before_correction");
  check(
    publicBeforeCorrection.body.items.some((item) => item.title.includes("avant correction")),
    true,
    "a_visible_on_public_route_before_correction"
  );
  results.scenario_a_publish = "prouvé : après publication réelle, l'information apparaît sur GET /api/content/flash/public.";

  const correctionA = await call(correctionHandler, {
    headers: authHeaders(validator.token),
    query: { id: a.flashInfoId },
    body: {
      title: `Information flash fictive a — APRÈS correction`,
      bodyMarkdown: `Contenu fictif APRÈS correction (a).`,
      importance: "importante",
      channels: ["push"],
      groupRefs: ["public:site"],
      expiresAt: futureIso(48),
    },
  });

  if (correctionA.status !== 200) {
    findings.correction_route_rejected = {
      status: correctionA.status,
      body: correctionA.body,
      note: "La VRAIE route POST .../correction a refusé la correction d'une version publiée. Voir shared/flash-transitions.ts et le trigger flash_guard_version.",
    };
    results.scenario_a_correction = `ÉCHEC — la route de correction a répondu ${correctionA.status}, voir findings.correction_route_rejected`;
  } else {
    check(correctionA.body.version.status, "modifiee", "a_correction_status_field");
    results.scenario_a_correction_route = "prouvé : POST .../correction accepte publiee -> modifiee et écrase le contenu de la même ligne (title/body).";

    // Ce que sert RÉELLEMENT la route publique juste après l'enregistrement
    // de la correction, avant toute republication — c'est exactement ce que
    // le plan (§ "La décision d'Adel") exige de garder visible.
    const publicAfterCorrectionBeforeRepublish = await call(publicFeedHandler, { method: "GET" });
    const stillServesOldVersion = publicAfterCorrectionBeforeRepublish.body.items.some((item) =>
      item.title.includes("avant correction")
    );
    const pageIsEmptyForThisInfo = !publicAfterCorrectionBeforeRepublish.body.items.some((item) =>
      item.title.includes("Information flash fictive a")
    );

    findings.public_route_after_correction_before_republish = {
      status: publicAfterCorrectionBeforeRepublish.status,
      itemsReturned: publicAfterCorrectionBeforeRepublish.body.items.length,
      stillServesOldVersion,
      pageIsEmptyForThisInfo,
    };

    if (pageIsEmptyForThisInfo) {
      results.scenario_a_visibility_during_correction =
        "ÉCHEC PROUVÉ EN BASE RÉELLE — dès l'enregistrement de la correction (avant toute republication), GET /api/content/flash/public ne sert plus RIEN pour cette information : la ligne unique de flash_info_versions passe à status='modifiee' (exclu du filtre status='publiee' de la route publique) et son contenu 'avant correction' a déjà été écrasé en place par la route correction.ts. C'est exactement la régression que ce plan devait réparer, et elle n'est pas réparée en persistance réelle : LOT 1/2/3 n'ont modifié que des modules purs et des écrans, jamais correction.ts/publication.ts/public.ts eux-mêmes (déjà signalé, sans preuve d'exécution réelle, par CORR-LOT1.md et CORR-LOT2.md).";
    } else if (stillServesOldVersion) {
      results.scenario_a_visibility_during_correction =
        "prouvé : l'ancienne version reste servie pendant la fenêtre non republiée.";
    }

    // === Scénario B : tenter de republier la correction par la VRAIE route
    // de publication. ===
    const republishA = await call(publicationHandler, {
      headers: authHeaders(validator.token),
      query: { id: a.flashInfoId },
    });
    findings.republish_attempt = { status: republishA.status, body: republishA.body };
    if (republishA.status === 200 && republishA.body.version.status === "publiee") {
      results.scenario_b_republish = "prouvé : la route de publication republie réellement une correction (modifiee -> publiee).";
    } else {
      results.scenario_b_republish = `ÉCHEC PROUVÉ EN BASE RÉELLE — POST .../publication sur une version 'modifiee' a répondu ${republishA.status} (${JSON.stringify(
        republishA.body
      )}) au lieu de republier. Cause déjà lue dans le code (CORR-LOT2.md) : la clause WHERE de publication.ts est câblée en dur sur status='validee', qui ne correspond jamais à 'modifiee' ; et le trigger SQL flash_guard_version (supabase/migrations/20260905013000_create_flash_info_foundation.sql) n'autorise que 'publiee'->'modifiee', jamais l'inverse. Confirmé ici par un appel réel contre PostgreSQL, pas seulement par lecture de code.`;
    }

    // La correction est-elle même visible dans la file "à publier" ?
    const publishableList = await call(publishableHandler, {
      method: "GET",
      headers: authHeaders(validator.token),
    });
    const correctionListedAsPublishable = publishableList.body.items?.some((item) => item.version.id === a.versionId);
    findings.publishable_queue_after_correction = {
      status: publishableList.status,
      correctionListedAsPublishable: Boolean(correctionListedAsPublishable),
    };
    results.scenario_b_publishable_queue = correctionListedAsPublishable
      ? "la correction apparaît dans GET .../publishable."
      : "ÉCHEC PROUVÉ — la correction (status='modifiee') n'apparaît PAS dans GET .../publishable (filtré en dur sur status='validee'). Le bouton de rappel construit au LOT 2 (FlashValidationPage.tsx) appelle la bonne route mais aucune file d'écran ne peut la lister aujourd'hui, cohérent avec CORR-LOT2.md.";
  }

  // === Scénario C : "aucune étape ne laisse la page publique vide" — vérifié
  // sur un flux qui NE PASSE PAS par une correction, pour isoler la
  // régression ci-dessus du reste du parcours. ===
  const c = await proposeAndValidate("c", proposer.token, validator.token, ["public:site"]);
  const publicBeforeC = await call(publicFeedHandler, { method: "GET" });
  const cAbsentBeforePublish = !publicBeforeC.body.items.some((item) => item.title.includes("fictive c"));
  const publishC = await call(publicationHandler, {
    headers: authHeaders(validator.token),
    query: { id: c.flashInfoId },
  });
  check(publishC.status, 200, "c_publish_status");
  const publicAfterC = await call(publicFeedHandler, { method: "GET" });
  const cPresentAfterPublish = publicAfterC.body.items.some((item) => item.title.includes("fictive c"));
  check(cAbsentBeforePublish, true, "c_absent_before_publish_expected");
  check(cPresentAfterPublish, true, "c_present_after_publish");
  results.scenario_c_no_regression_on_simple_publish =
    "prouvé : un flux proposer -> valider -> publier -> visible, SANS correction, ne laisse jamais la page publique vide de cette information ; la régression du scénario A est bien localisée à la correction d'une version déjà publiée, pas au parcours de publication initiale.";

  // === Scénario D : proposer une flash "visible par tous" depuis l'écran
  // (audience public:site), la valider, la publier, la voir. ===
  const d = await proposeAndValidate("d-audience-publique", proposer.token, validator.token, ["public:site"]);
  const publishD = await call(publicationHandler, {
    headers: authHeaders(validator.token),
    query: { id: d.flashInfoId },
  });
  check(publishD.status, 200, "d_publish_status");
  const publicAfterD = await call(publicFeedHandler, { method: "GET" });
  const dVisible = publicAfterD.body.items.some((item) => item.title.includes("d-audience-publique"));
  check(dVisible, true, "d_visible_after_public_audience_publish");
  results.scenario_d_public_audience =
    "prouvé de bout en bout contre PostgreSQL réel et les VRAIES routes : une flash proposée avec l'audience 'public:site' (le même groupRef que la case ajoutée à l'écran au LOT 3), une fois validée puis publiée, apparaît sur GET /api/content/flash/public. Ceci exerce le CHEMIN SERVEUR de la case écran du LOT 3 (parseFlashGroupRef -> flash_info_audiences -> filtre de la route publique) ; le clic réel dans le navigateur n'a pas été rejoué par ce script Node, voir le compte rendu pour la recette navigateur séparée.";
} finally {
  for (const userId of createdUserIds) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
  results.cleanup =
    "partiel et volontaire : comptes auth.users fictifs supprimés quand possible ; établissement et informations flash fictifs laissés en place (append-only + FK RESTRICT), purgés seulement par un futur supabase db reset/stop de cette pile locale jetable";
}

console.log(JSON.stringify({ target: "127.0.0.1:54322", assertions, results, findings }, null, 2));
