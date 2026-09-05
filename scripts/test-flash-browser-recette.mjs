// Recette navigateur reelle (Chromium local) — LOT 8 du plan de persistance
// flash. Seul lot qui rend reellement les deux ecrans dans un navigateur :
// jusqu'ici le contrat responsive reposait sur une lecture du code (tests
// statiques du LOT 6), jamais sur un rendu. Pile Supabase locale jetable,
// etablissement et compte entierement fictifs, aucune donnee reelle, aucune
// commande --linked/db push/URL distante.
//
// Authentification : connexion reelle (signInWithPassword) puis MFA TOTP
// reellement enrole et verifie (meme algorithme que
// scripts/test-preview-routing-review-client.mjs) pour atteindre aal2 —
// jamais un JWT fabrique a la main. La session aal2 obtenue est deposee dans
// le localStorage du navigateur avant navigation, ce qui evite de re-scripter
// le formulaire de connexion agent tout en restant un jeton reellement emis
// par le GoTrue local.
//
// Les deux seules routes API reellement appelees par l'ecran de validation au
// montage (`GET /api/flash/validation/queue` et `.../expired`) sont servies
// par un petit serveur HTTP local qui invoque directement les vrais handlers
// (memes modules que l'application), comme au LOT 7 — jamais une
// reimplementation des regles metier. L'ecran de proposition n'appelle aucune
// route au montage (formulaire local), donc aucun serveur n'est necessaire
// pour lui au-dela des fichiers statiques.

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
const institutionSlug = `flash-browser-recette-${marker}`;
process.env.SUPPORT_INSTITUTION_SLUG = institutionSlug;

const [{ sql }, { db }, { createClient }] = await Promise.all([
  import("drizzle-orm"),
  import("../db/index.js"),
  import("@supabase/supabase-js"),
]);
const queueHandler = (await import("../api/flash/validation/queue.js")).default;
const expiredHandler = (await import("../api/flash/validation/expired.js")).default;

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

let browser;
let server;
const institutionId = randomUUID();
const createdUserIds = [];

try {
  await db.execute(sql`insert into public.institutions (id, slug, name, status)
    values (${institutionId}::uuid, ${institutionSlug}, 'Lycee fictif recette navigateur flash', 'pilot')`);

  const admin = createClient(LOCAL_API_URL, LOCAL_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `flash-browser-recette-${marker}@example.test`;
  const password = "recette-flash-browser-pw-01!";
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "superadmin" },
  });
  if (createErr) throw new Error(`create_user_failed:${createErr.message}`);
  createdUserIds.push(created.user.id);

  await db.execute(sql`insert into public.institution_memberships
      (institution_id, user_id, role, service_codes, status)
    values (${institutionId}::uuid, ${created.user.id}::uuid, 'admin', array['referent_numerique']::text[], 'active')`);

  // --- Session aal2 reelle : signIn, enrolement TOTP, defi, verification ---
  const client = createClient(LOCAL_API_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`sign_in_failed:${signIn.error.message}`);

  const enrollment = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Recette navigateur flash LOT 8",
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

  // --- Build frontend contre la pile locale (repertoire de sortie isole, ne
  // touche pas dist/ utilise par `npm run build`) ---
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

  // --- Serveur HTTP local : fichiers statiques + les deux routes GET
  // reellement appelees au montage de l'ecran de validation ---
  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname === "/api/flash/validation/queue" || url.pathname === "/api/flash/validation/expired") {
        const handler = url.pathname.endsWith("queue") ? queueHandler : expiredHandler;
        const result = await callHandler(handler, {
          method: "GET",
          headers: { authorization: req.headers.authorization ?? "" },
          query: {},
          body: {},
        });
        const body = JSON.stringify(result.body);
        res.writeHead(result.status, { "content-type": "application/json; charset=utf-8" });
        res.end(body);
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

  const widths = [320, 390, 1440];
  const screens = [
    { name: "proposer", path: "/admin/informations-flash/proposer" },
    { name: "valider", path: "/admin/informations-flash/valider" },
  ];

  const results = [];
  for (const screen of screens) {
    for (const width of widths) {
      consoleErrors = [];
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}${screen.path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      const finalUrl = page.url();
      await page.screenshot({
        path: path.join(OUT_DIR, `${screen.name}-${width}.png`),
        fullPage: true,
      });
      results.push({
        screen: screen.name,
        width,
        overflow,
        consoleErrors: [...consoleErrors],
        finalUrl,
      });
    }
  }

  console.log(JSON.stringify({ institutionSlug, marker, results }, null, 2));

  const failed = results.filter((r) => r.overflow !== 0 || r.consoleErrors.length > 0);
  if (failed.length > 0) {
    console.error("ECHEC_RECETTE_NAVIGATEUR_FLASH", JSON.stringify(failed, null, 2));
    process.exitCode = 1;
  }
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}
