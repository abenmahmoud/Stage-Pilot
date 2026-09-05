// Recette navigateur réelle (Chromium local) — LOT 6 du plan de visibilité
// publique (docs/operations/PLAN_FLASH_PUBLIC_2026-09-05.md). Seul lot qui
// rend réellement le site public dans un navigateur : jusqu'ici le rendu du
// bandeau `FlashPublicBulletin` reposait sur une lecture du code (LOT 2),
// jamais sur un affichage. Pile Supabase locale jetable, établissement et
// comptes entièrement fictifs, aucune donnée réelle, aucune commande
// --linked/db push/URL distante.
//
// Route anonyme : contrairement à `test-flash-browser-recette.mjs` (LOT 8 du
// plan de persistance, écran admin, session aal2 nécessaire), la page
// publique ("/") n'exige aucune authentification. Seule
// `GET /api/content/flash/public` est réellement appelée au montage de
// `FlashPublicBulletin` ; elle est servie par un petit serveur HTTP local qui
// invoque directement le vrai handler (`api/content/flash/public.ts`), jamais
// une réimplémentation.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
const BUILD_DIR = path.join(OUT_DIR, "dist-public");
mkdirSync(OUT_DIR, { recursive: true });

// Clés de démonstration publiques du CLI Supabase local (identiques sur toute
// pile locale par défaut) ; jamais des secrets réels.
const LOCAL_API_URL = "http://127.0.0.1:54321";
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
process.env.VITE_SUPABASE_URL = LOCAL_API_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SERVICE_ROLE_KEY;

const marker = randomUUID().replaceAll("-", "").slice(0, 10);
const institutionSlug = `flash-public-browser-recette-${marker}`;
process.env.SUPPORT_INSTITUTION_SLUG = institutionSlug;

const [{ sql }, { db }, { createClient }] = await Promise.all([
  import("drizzle-orm"),
  import("../db/index.js"),
  import("@supabase/supabase-js"),
]);
const proposalsHandler = (await import("../api/flash/proposals/index.js")).default;
const decisionHandler = (await import("../api/flash/proposals/[id]/decision.js")).default;
const publicationHandler = (await import("../api/flash/proposals/[id]/publication.js")).default;
const publicFeedHandler = (await import("../api/content/flash/public.js")).default;

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

function authHeaders(token, idempotencyKey) {
  const headers = { authorization: `Bearer ${token}` };
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
  return headers;
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
    values (${institutionId}::uuid, ${institutionSlug}, 'Lycée fictif recette navigateur visibilité publique flash', 'pilot')`);

  const admin = createClient(LOCAL_API_URL, LOCAL_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  async function createFictionalActor(label, role, password) {
    const email = `flash-public-browser-recette-${marker}-${label}@example.test`;
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
    return { id: data.user.id, token: signIn.data.session.access_token };
  }

  const proposer = await createFictionalActor("proposer", "professeur", "recette-pubbrowser-pw-01!");
  const validator = await createFictionalActor("validator", "administration", "recette-pubbrowser-pw-02!");
  createdUserIds.push(proposer.id, validator.id);

  await db.execute(sql`insert into public.institution_memberships
      (institution_id, user_id, role, service_codes, status)
    values (${institutionId}::uuid, ${proposer.id}::uuid, 'admin', array[]::text[], 'active')`);
  await db.execute(sql`insert into public.institution_memberships
      (institution_id, user_id, role, service_codes, status)
    values (${institutionId}::uuid, ${validator.id}::uuid, 'admin', array['referent_numerique']::text[], 'active')`);

  // --- Publier une flash publique fictive réelle, pour que le bandeau ait
  // réellement quelque chose à afficher pendant cette recette. ---
  const idemKey = `flash-public-browser-recette-${marker}`;
  const proposeBody = {
    title: "Portes ouvertes fictives du lycée",
    bodyMarkdown: "Journée portes ouvertes fictive samedi prochain, de 9h à 17h.",
    importance: "normale",
    channels: [],
    groupRefs: ["public:site"],
    smsContactRefs: [],
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  };
  const created = await callHandler(proposalsHandler, {
    method: "POST",
    headers: authHeaders(proposer.token, idemKey),
    body: proposeBody,
    query: {},
  });
  if (created.status !== 201) throw new Error(`propose_failed:${created.status}:${JSON.stringify(created.body)}`);
  const flashInfoId = created.body.version.flashInfoId;
  const decision = await callHandler(decisionHandler, {
    method: "POST",
    headers: authHeaders(validator.token),
    query: { id: flashInfoId },
    body: { decision: "validee", content: null },
  });
  if (decision.status !== 200) throw new Error(`decision_failed:${decision.status}:${JSON.stringify(decision.body)}`);
  const publish = await callHandler(publicationHandler, {
    method: "POST",
    headers: authHeaders(validator.token),
    query: { id: flashInfoId },
    body: {},
  });
  if (publish.status !== 200) throw new Error(`publish_failed:${publish.status}:${JSON.stringify(publish.body)}`);

  // --- Build frontend contre la pile locale (répertoire de sortie isolé, ne
  // touche pas dist/ utilisé par `npm run build`) ---
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

  // --- Serveur HTTP local : fichiers statiques + la seule route GET
  // réellement appelée au montage du bandeau public ---
  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname === "/api/content/flash/public") {
        const result = await callHandler(publicFeedHandler, { method: "GET", headers: {}, query: {}, body: {} });
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

  const widths = [320, 390, 1440];
  const results = [];
  for (const width of widths) {
    consoleErrors = [];
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const bulletinText = await page
      .locator(".lycee-flash-bulletin")
      .innerText()
      .catch(() => null);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    await page.screenshot({ path: path.join(OUT_DIR, `public-${width}.png`), fullPage: true });
    results.push({
      width,
      overflow,
      consoleErrors: [...consoleErrors],
      bulletinVisible: typeof bulletinText === "string" && bulletinText.includes("Portes ouvertes fictives"),
    });
  }

  console.log(JSON.stringify({ institutionSlug, marker, results }, null, 2));

  for (const result of results) {
    assert.equal(result.overflow, 0, `overflow_at_${result.width}`);
    assert.deepEqual(result.consoleErrors, [], `console_errors_at_${result.width}`);
    assert.equal(result.bulletinVisible, true, `bulletin_not_rendered_at_${result.width}`);
  }

  const failed = results.filter((r) => r.overflow !== 0 || r.consoleErrors.length > 0 || !r.bulletinVisible);
  if (failed.length > 0) {
    console.error("ECHEC_RECETTE_NAVIGATEUR_FLASH_PUBLIC", JSON.stringify(failed, null, 2));
    process.exitCode = 1;
  }
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}
