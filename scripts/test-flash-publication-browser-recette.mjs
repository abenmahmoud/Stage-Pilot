// Recette navigateur reelle (Chromium local) — LOT 4 du plan de publication
// flash (docs/operations/PLAN_FLASH_PUBLICATION_2026-09-05.md).
//
// Deux preuves distinctes dans un seul script, toutes deux par de VRAIS clics
// dans un navigateur reel, jamais par SQL force (contrairement au LOT 7 du
// plan de persistance qui avait force `validee -> publiee` par SQL faute de
// route) :
//   1. Publier depuis l'ecran (bouton "Publier" de la file "Validees, en
//      attente de publication"), en appelant la vraie route
//      POST /api/flash/proposals/[id]/publication (LOT 1 de ce plan).
//   2. Corriger APRES publication depuis l'ecran (formulaire de la carte
//      "Publiees", prerempli, puis "Confirmer la correction"), en appelant la
//      vraie route POST /api/flash/proposals/[id]/correction — jamais
//      appelee par aucun ecran avant le LOT 3 de ce plan.
// Puis recette responsive a 320/390/1440 px sur cet ecran de validation
// complete (LOT 3), sans re-naviguer entre les tailles pour ne pas perdre le
// panneau de resultat de correction (etat React local, pas persiste cote
// serveur au-dela de `flash_correction_decisions`).
//
// Authentification : connexion reelle (signInWithPassword) puis MFA TOTP
// reellement enrole et verifie pour atteindre aal2 (meme motif que
// `test-flash-browser-recette.mjs`, LOT 8 du plan de persistance) — jamais un
// JWT fabrique a la main.
//
// Les routes API reellement appelees par l'ecran de validation (au montage
// et lors des deux actions) sont servies par un petit serveur HTTP local qui
// invoque directement les vrais handlers (memes modules que l'application),
// jamais une reimplementation des regles metier.

import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

if (process.argv.length !== 3 || process.argv[2] !== "--local-stack-only") {
  throw new Error("local_stack_confirmation_required");
}

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT_DIR = path.join(ROOT, ".vercel", "flash-recette");
const BUILD_DIR = path.join(OUT_DIR, "dist");
mkdirSync(OUT_DIR, { recursive: true });

// Cles de demonstration publiques du CLI Supabase local (identiques sur toute
// pile locale par defaut) ; jamais des secrets reels.
const LOCAL_API_URL = "http://127.0.0.1:54321";
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
process.env.VITE_SUPABASE_URL = LOCAL_API_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SERVICE_ROLE_KEY;

const marker = randomUUID().replaceAll("-", "").slice(0, 10);
const institutionSlug = `flash-pub-browser-recette-${marker}`;
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
const queueHandler = (await import("../api/flash/validation/queue.js")).default;
const expiredHandler = (await import("../api/flash/validation/expired.js")).default;
const publishableHandler = (await import("../api/flash/validation/publishable.js")).default;
const publishedHandler = (await import("../api/flash/validation/published.js")).default;
const expiredAfterValidationHandler = (await import("../api/flash/validation/expired-after-validation.js")).default;

// --- TOTP : meme algorithme que scripts/test-preview-routing-review-client.mjs ---
function decodeBase32(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const character of clean) {
    const index = alphabet.indexOf(character);
    assert.notEqual(index, -1, "Invalid TOTP secret");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret) {
  const counter = BigInt(Math.floor(Date.now() / 30_000));
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    (((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)) >>>
    0;
  return String(binary % 1_000_000).padStart(6, "0");
}

async function waitForStableTotpWindow() {
  const remaining = 30 - Math.floor((Date.now() / 1000) % 30);
  if (remaining > 4) return;
  await new Promise((resolve) => setTimeout(resolve, (remaining + 1) * 1000));
}

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

async function callHandler(handler, req) {
  const res = createMockResponse();
  await handler(req, res);
  return { status: res.statusCode, body: res._body };
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

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

let browser;
let server;
const institutionId = randomUUID();
const createdUserIds = [];
const admin = createClient(LOCAL_API_URL, LOCAL_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

try {
  // --- Fixtures : un etablissement fictif, deux comptes fictifs (proposeur,
  // valideur/publieur/correcteur) ---
  await db.execute(sql`insert into public.institutions (id, slug, name, status)
    values (${institutionId}::uuid, ${institutionSlug}, 'Lycee fictif recette navigateur publication flash', 'pilot')`);

  const proposerEmail = `flash-pub-browser-recette-${marker}-proposer@example.test`;
  const proposerPassword = "recette-flash-pub-browser-pw-01!";
  const { data: proposerCreated, error: proposerErr } = await admin.auth.admin.createUser({
    email: proposerEmail,
    password: proposerPassword,
    email_confirm: true,
    app_metadata: { role: "professeur" },
  });
  if (proposerErr) throw new Error(`create_proposer_failed:${proposerErr.message}`);
  createdUserIds.push(proposerCreated.user.id);
  await db.execute(sql`insert into public.institution_memberships
      (institution_id, user_id, role, service_codes, status)
    values (${institutionId}::uuid, ${proposerCreated.user.id}::uuid, 'admin', array[]::text[], 'active')`);
  const proposerAnon = createClient(LOCAL_API_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const proposerSignIn = await proposerAnon.auth.signInWithPassword({
    email: proposerEmail,
    password: proposerPassword,
  });
  if (proposerSignIn.error) throw new Error(`proposer_sign_in_failed:${proposerSignIn.error.message}`);
  const proposerToken = proposerSignIn.data.session.access_token;

  const validatorEmail = `flash-pub-browser-recette-${marker}-validator@example.test`;
  const validatorPassword = "recette-flash-pub-browser-pw-02!";
  const { data: validatorCreated, error: validatorErr } = await admin.auth.admin.createUser({
    email: validatorEmail,
    password: validatorPassword,
    email_confirm: true,
    app_metadata: { role: "administration" },
  });
  if (validatorErr) throw new Error(`create_validator_failed:${validatorErr.message}`);
  createdUserIds.push(validatorCreated.user.id);
  await db.execute(sql`insert into public.institution_memberships
      (institution_id, user_id, role, service_codes, status)
    values (${institutionId}::uuid, ${validatorCreated.user.id}::uuid, 'admin', array['referent_numerique']::text[], 'active')`);

  // --- Une proposition validee (mais PAS encore publiee) : la publication
  // et la correction se font toutes deux depuis l'ecran, plus bas. Public
  // pris dans FICTITIOUS_FLASH_GROUPS (src/pages/admin/FlashProposalPage.tsx)
  // pour que la case a cocher correspondante existe reellement dans le
  // formulaire de correction. ---
  const originalTitle = "Information flash fictive recette navigateur LOT 4";
  const idemKey = `flash-pub-browser-recette-${marker}`;
  const proposeBody = {
    title: originalTitle,
    bodyMarkdown: "Contenu fictif de recette navigateur pour la publication et la correction.",
    importance: "importante",
    channels: ["push", "email"],
    groupRefs: ["classe:2ndea"],
    expiresAt: new Date(Date.now() + 48 * 3_600_000).toISOString(),
  };
  const created = await call(proposalsHandler, { headers: authHeaders(proposerToken, idemKey), body: proposeBody });
  if (created.status !== 201) throw new Error(`propose_failed:${created.status}:${JSON.stringify(created.body)}`);
  const flashInfoId = created.body.version.flashInfoId;

  const validatorTokenForSetup = (
    await (async () => {
      const anon = createClient(LOCAL_API_URL, LOCAL_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
      const signIn = await anon.auth.signInWithPassword({ email: validatorEmail, password: validatorPassword });
      if (signIn.error) throw new Error(`validator_setup_sign_in_failed:${signIn.error.message}`);
      return signIn.data.session.access_token;
    })()
  );
  const decision = await call(decisionHandler, {
    headers: authHeaders(validatorTokenForSetup),
    query: { id: flashInfoId },
    body: { decision: "validee", content: null },
  });
  if (decision.status !== 200) throw new Error(`decision_failed:${decision.status}:${JSON.stringify(decision.body)}`);
  const versionId = decision.body.version.id;

  // --- Session aal2 reelle pour le VALIDEUR : signIn, enrolement TOTP,
  // defi, verification ---
  const client = createClient(LOCAL_API_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await client.auth.signInWithPassword({ email: validatorEmail, password: validatorPassword });
  if (signIn.error) throw new Error(`sign_in_failed:${signIn.error.message}`);

  const enrollment = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Recette navigateur publication flash LOT 4",
  });
  if (enrollment.error || !enrollment.data?.totp?.secret) {
    throw new Error(`mfa_enrollment_failed:${enrollment.error?.message ?? "no_secret"}`);
  }
  await waitForStableTotpWindow();
  const challenge = await client.auth.mfa.challenge({ factorId: enrollment.data.id });
  if (challenge.error) throw challenge.error;
  const verify = await client.auth.mfa.verify({
    factorId: enrollment.data.id,
    challengeId: challenge.data.id,
    code: totp(enrollment.data.totp.secret),
  });
  if (verify.error) throw verify.error;
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) throw assurance.error;
  assert.equal(assurance.data.currentLevel, "aal2", "aal2_not_reached");
  const { data: sessionData } = await client.auth.getSession();
  const session = sessionData.session;
  if (!session) throw new Error("missing_session_after_aal2");

  // --- Build frontend contre la pile locale (repertoire de sortie isole) ---
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(ROOT, "node_modules", "vite", "bin", "vite.js"), "build", "--outDir", BUILD_DIR, "--emptyOutDir"],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          VITE_SUPABASE_URL: LOCAL_API_URL,
          VITE_SUPABASE_ANON_KEY: LOCAL_ANON_KEY,
        },
        stdio: "inherit",
      }
    );
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`vite_build_failed:${code}`))));
  });

  // --- Serveur HTTP local : fichiers statiques + les vraies routes API
  // appelees par l'ecran de validation (montage + publication + correction) ---
  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      const authorization = req.headers.authorization ?? "";

      const GET_ROUTES = {
        "/api/flash/validation/queue": queueHandler,
        "/api/flash/validation/expired": expiredHandler,
        "/api/flash/validation/publishable": publishableHandler,
        "/api/flash/validation/published": publishedHandler,
        "/api/flash/validation/expired-after-validation": expiredAfterValidationHandler,
      };
      if (req.method === "GET" && GET_ROUTES[url.pathname]) {
        const result = await callHandler(GET_ROUTES[url.pathname], {
          method: "GET",
          headers: { authorization },
          query: {},
          body: {},
        });
        res.writeHead(result.status, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(result.body));
        return;
      }

      const publicationMatch = url.pathname.match(/^\/api\/flash\/proposals\/([0-9a-f-]+)\/publication$/i);
      if (req.method === "POST" && publicationMatch) {
        const result = await callHandler(publicationHandler, {
          method: "POST",
          headers: { authorization },
          query: { id: publicationMatch[1] },
          body: {},
        });
        res.writeHead(result.status, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(result.body));
        return;
      }

      const correctionMatch = url.pathname.match(/^\/api\/flash\/proposals\/([0-9a-f-]+)\/correction$/i);
      if (req.method === "POST" && correctionMatch) {
        const body = await readJsonBody(req);
        const result = await callHandler(correctionHandler, {
          method: "POST",
          headers: { authorization },
          query: { id: correctionMatch[1] },
          body,
        });
        res.writeHead(result.status, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(result.body));
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "route_non_branchee_dans_cette_recette" }));
        return;
      }
      let filePath = path.join(BUILD_DIR, decodeURIComponent(url.pathname));
      if (url.pathname === "/" || !existsSync(filePath) || path.extname(filePath) === "") {
        filePath = path.join(BUILD_DIR, "index.html");
      }
      const content = await readFile(filePath);
      res.writeHead(200, { "content-type": MIME_TYPES[path.extname(filePath)] ?? "application/octet-stream" });
      res.end(content);
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: String(error) }));
    }
  });
  const port = await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
  const origin = `http://127.0.0.1:${port}`;

  // --- Chromium local ---
  browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  let consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto(`${origin}/`);
  const storageKey = `sb-${new URL(LOCAL_API_URL).hostname.split(".")[0]}-auth-token`;
  await page.evaluate(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: storageKey, value: JSON.stringify(session) }
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/admin/informations-flash/valider`, { waitUntil: "networkidle" });

  // --- 1. Publier depuis l'ecran (vrai clic, vraie route) ---
  const publishHeading = page.getByRole("heading", { name: originalTitle });
  await publishHeading.waitFor({ state: "visible", timeout: 10_000 });
  const publishButton = page.getByRole("button", { name: "Publier" });
  await publishButton.waitFor({ state: "visible", timeout: 10_000 });
  await publishButton.click();
  const publishNotice = page.getByRole("status");
  await publishNotice.waitFor({ state: "visible", timeout: 10_000 });
  const publishNoticeText = (await publishNotice.textContent()) ?? "";
  check(publishNoticeText.includes("Publication enregistrée"), true, "browser_publish_notice_shown");

  const [{ status: statusAfterBrowserPublish, published_by: publishedByAfterBrowser }] = await db.execute(
    sql`select status, published_by from public.flash_info_versions where id = ${versionId}::uuid`
  );
  check(statusAfterBrowserPublish, "publiee", "browser_publish_status_in_db");
  check(publishedByAfterBrowser, validatorCreated.user.id, "browser_publish_published_by_in_db");

  // --- 2. Corriger APRES publication depuis l'ecran (vrai clic, vraie
  // route, jamais de SQL force) ---
  const correctButton = page.getByRole("button", { name: "Corriger" });
  await correctButton.waitFor({ state: "visible", timeout: 10_000 });
  await correctButton.click();

  const titleInput = page.getByLabel("Titre");
  await titleInput.waitFor({ state: "visible", timeout: 10_000 });
  const prefilledTitle = await titleInput.inputValue();
  check(prefilledTitle, originalTitle, "browser_correction_form_prefilled_title");

  const correctedTitle = `${originalTitle} (corrigée depuis l'écran)`;
  await titleInput.fill(correctedTitle);

  const confirmCorrectionButton = page.getByRole("button", { name: "Confirmer la correction" });
  await confirmCorrectionButton.click();

  const correctionHeading = page.getByRole("heading", { name: `Correction confirmée : ${correctedTitle}` });
  await correctionHeading.waitFor({ state: "visible", timeout: 10_000 });

  const [{ status: statusAfterBrowserCorrection, title: titleAfterBrowserCorrection }] = await db.execute(
    sql`select status, title from public.flash_info_versions where id = ${versionId}::uuid`
  );
  check(statusAfterBrowserCorrection, "modifiee", "browser_correction_status_in_db");
  check(titleAfterBrowserCorrection, correctedTitle, "browser_correction_title_in_db");

  const [correctionDecisionRow] = await db.execute(
    sql`select decision, decided_by from public.flash_correction_decisions where version_id = ${versionId}::uuid`
  );
  check(correctionDecisionRow.decision, "confirmee", "browser_correction_decision_confirmee_in_db");
  check(correctionDecisionRow.decided_by, validatorCreated.user.id, "browser_correction_decided_by_validator");

  // --- Recette responsive a 320/390/1440 px sur cet ecran complete, sans
  // re-naviguer (le panneau de resultat de correction est un etat React
  // local, pas une donnee relue au montage). ---
  const widths = [320, 390, 1440];
  const responsiveResults = [];
  for (const width of widths) {
    consoleErrors = [];
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    await page.screenshot({
      path: path.join(OUT_DIR, `valider-publication-lot4-${width}.png`),
      fullPage: true,
    });
    responsiveResults.push({ width, overflow, consoleErrors: [...consoleErrors] });
  }

  console.log(
    JSON.stringify(
      {
        institutionSlug,
        marker,
        assertions,
        responsiveResults,
      },
      null,
      2
    )
  );

  const failedResponsive = responsiveResults.filter((r) => r.overflow !== 0 || r.consoleErrors.length > 0);
  if (failedResponsive.length > 0) {
    console.error("ECHEC_RECETTE_NAVIGATEUR_FLASH_PUBLICATION", JSON.stringify(failedResponsive, null, 2));
    process.exitCode = 1;
  }
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  for (const userId of createdUserIds) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
}
