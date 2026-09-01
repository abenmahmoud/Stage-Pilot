import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = await Promise.all([
  readFile(new URL("../workers/site-content-file-worker.mjs", import.meta.url), "utf8"),
  readFile(new URL("../api/content/admin/assets/[id]/confirm.ts", import.meta.url), "utf8"),
  readFile(new URL("../api/content/admin/assets.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/pages/admin/ContentManagerPage.tsx", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260901073000_create_site_content_antivirus_pipeline.sql", import.meta.url), "utf8"),
  readFile(new URL("../deploy/lycee-site-content-file-worker.service", import.meta.url), "utf8"),
  readFile(new URL("../deploy/lycee-site-content-file-worker.timer", import.meta.url), "utf8"),
  readFile(new URL("../docs/operations/recipes/preview-site-content-antivirus-rollback.sql", import.meta.url), "utf8"),
]);
const [worker, confirm, reservation, page, migration, service, timer, recipe] = files;

test("creates a private quarantine state machine and dedicated queue", () => {
  assert.match(migration, /pgmq\.create\('site_content_file_scan'\)/);
  assert.match(migration, /'pending', 'quarantine', 'ready', 'blocked', 'scan_error', 'archived'/);
  assert.match(migration, /status = 'ready'[\s\S]*storage_bucket = 'site-content'[\s\S]*scan_detail = 'clamav_clean'/);
  assert.match(migration, /site_content_assets_status_transition/);
  assert.match(migration, /'site-content-quarantine'[\s\S]*false[\s\S]*10485760/);
  assert.match(migration, /source_system = 'wordpress'[\s\S]*scan_detail is null/);
  assert.match(migration, /site_content_asset_clean_proof_required/);
  assert.doesNotMatch(migration, /update public\.site_content_assets[\s\S]*legacy_unverified/);
});

test("binds one exact upload to quarantine before queuing antivirus", () => {
  assert.match(reservation, /from\(SITE_CONTENT_QUARANTINE_BUCKET\)/);
  assert.match(reservation, /storageBucket: SITE_CONTENT_QUARANTINE_BUCKET/);
  const boundedRead = confirm.indexOf("readBoundedBlobBytes");
  const signature = confirm.indexOf("matchesSiteContentFileSignature", boundedRead);
  const digest = confirm.indexOf('createHash("sha256")', signature);
  const quarantine = confirm.indexOf('status: "quarantine"', digest);
  const queue = confirm.indexOf("'site_content_file_scan'", quarantine);
  assert.ok(boundedRead >= 0 && signature > boundedRead && digest > signature && quarantine > digest && queue > quarantine);
  assert.match(confirm, /eq\(siteContentAssets\.status, "pending"\)/);
  assert.match(confirm, /res\.status\(confirmation\.status === "quarantine" \? 202 : 200\)/);
});

test("scans bounded bytes and verifies the digest before ClamAV", () => {
  const download = worker.indexOf("boundedBlobToBuffer");
  const digest = worker.indexOf('createHash("sha256")', download);
  const clam = worker.indexOf("clamScan(bytes", digest);
  const office = worker.indexOf("inspectSupportOfficeArchive", clam);
  const cleanUpload = worker.indexOf('.from("site-content")', office);
  const ready = worker.indexOf("status = 'ready'", cleanUpload);
  assert.ok(download >= 0 && digest > download && clam > digest && office > clam && cleanUpload > office && ready > cleanUpload);
  assert.match(worker, /digest !== asset\.sha256/);
  assert.match(worker, /status = 'blocked', scan_detail = \$\{detail\}/);
  assert.match(worker, /where id = \$\{asset\.id\} and status = 'quarantine'/);
});

test("keeps failures retryable and archives the fifth failed attempt", () => {
  assert.match(worker, /try \{[\s\S]*invalid_site_content_scan_job[\s\S]*catch \(error\)/);
  assert.match(worker, /if \(row\.read_ct >= 5\)/);
  assert.match(worker, /status = 'scan_error', scan_detail = \$\{code\}/);
  assert.match(worker, /pgmq\.archive\('site_content_file_scan'/);
  assert.match(worker, /action, summary[\s\S]*'scan_error'/);
  assert.match(worker, /asset\.scan_detail === "clamav_clean"[\s\S]*asset\.sha256/);
});

test("never attaches a quarantined asset in the browser", () => {
  assert.match(page, /from\("site-content-quarantine"\)\.uploadToSignedUrl/);
  assert.match(page, /if \(confirmed\.asset\.status === "ready"\)[\s\S]*attachReadyAsset\(confirmed\.asset\)/);
  assert.match(page, /uniquement après validation du contrôle antivirus/);
  assert.match(page, /Fichiers vérifiés/);
});

test("ships a bounded preview service without activating it", () => {
  assert.match(service, /Type=oneshot/);
  assert.match(service, /After=network-online\.target clamav-daemon\.service/);
  assert.match(service, /NoNewPrivileges=true/);
  assert.match(service, /ProtectSystem=strict/);
  assert.match(service, /MemoryMax=512M/);
  assert.match(timer, /OnUnitActiveSec=60s/);
});

test("keeps the database proof fictitious and residue-free", () => {
  assert.match(recipe, /^begin;/);
  assert.match(recipe, /99999999-9999-4999-8999-999999999991/);
  assert.match(recipe, /unsafe_ready_was_accepted/);
  assert.match(recipe, /status = 'quarantine'[\s\S]*status = 'ready'/);
  assert.match(recipe, /rollback;\s*$/);
  assert.doesNotMatch(recipe, /\bcommit\b/i);
});
