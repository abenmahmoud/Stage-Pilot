import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, isAbsolute } from "node:path";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { createCommunicationInboundScanner } from "../workers/communication-inbound-scanner.mjs";
import { createSiteContentFileWorker } from "../workers/site-content-file-worker-core.mjs";

const IMAGE_DIGEST = "sha256:f0954d679017eb6d48221e2b2be3ac5457bf278a844f39b672376f55a085f591";
const IMAGE = `clamav/clamav@${IMAGE_DIGEST}`;
const CONTAINER = `lyceegest-clamav-site-content-recipe-${process.pid}`;
const DOCKER = process.env.LYCEEGEST_DOCKER_EXE
  ?? "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
const DATABASE_URL = process.env.LYCEEGEST_LOCAL_DATABASE_URL;
const LOCAL_SUPABASE_URL = process.env.LYCEEGEST_LOCAL_SUPABASE_URL;
const LOCAL_SUPABASE_SERVER_KEY = process.env.LYCEEGEST_LOCAL_SUPABASE_SERVER_KEY;
const SCANNER_INSTITUTION_ID = "00000000-0000-4000-8000-000000009701";
const SCANNER_INBOUND_ID = "00000000-0000-4000-8000-000000009702";
const ASSET_IDS = [
  "00000000-0000-4000-8000-000000009710",
  "00000000-0000-4000-8000-000000009711",
  "00000000-0000-4000-8000-000000009712",
  "00000000-0000-4000-8000-000000009713",
  "00000000-0000-4000-8000-000000009714",
];
const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PREFIX = "lyceegest-inbound-scan-";
const workerRequire = createRequire(new URL("../workers/package.json", import.meta.url));
const JSZip = workerRequire("jszip");
const dockerEnvironment = Object.fromEntries([
  "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "USERPROFILE", "HOMEDRIVE",
  "HOMEPATH", "APPDATA", "LOCALAPPDATA",
].flatMap((key) => process.env[key] ? [[key, process.env[key]]] : []));

if (!process.argv.includes("--local-stack-only")) throw new Error("local_stack_confirmation_required");
if (!isAbsolute(DOCKER)
  || !["docker", "docker.exe"].includes(basename(DOCKER).toLowerCase())
  || !existsSync(DOCKER)) throw new Error("docker_cli_missing");

function localDatabaseUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1"
    || parsed.port !== "54322" || parsed.pathname !== "/postgres"
    || parsed.search || parsed.hash || parsed.username !== "postgres") {
    throw new Error("local_database_required");
  }
  return value;
}

function localSupabaseUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1"
    || !["54321", "55321"].includes(parsed.port)
    || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("local_supabase_required");
  }
  return value.replace(/\/$/u, "");
}

function localServerKey(value) {
  if (typeof value !== "string" || !/^sb_secret_[A-Za-z0-9_-]{20,200}$/u.test(value)) {
    throw new Error("local_server_key_required");
  }
  return value;
}

const dbUrl = localDatabaseUrl(DATABASE_URL);
const localOrigin = localSupabaseUrl(LOCAL_SUPABASE_URL);
const localServerSecret = localServerKey(LOCAL_SUPABASE_SERVER_KEY);
const sql = postgres(dbUrl, {
  prepare: false,
  max: 3,
  connect_timeout: 10,
  idle_timeout: 20,
  onnotice: () => {},
});
const storage = createClient(localOrigin, localServerSecret, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}).storage;
const paths = new Set();
let clamavCreated = false;

function docker(args, { input } = {}) {
  return spawnSync(DOCKER, args, {
    encoding: "utf8",
    input,
    maxBuffer: 64 * 1024,
    windowsHide: true,
    env: dockerEnvironment,
  });
}

function expectDocker(result, code) {
  if (result.error || result.status !== 0 || result.signal) throw new Error(code);
  return result.stdout.trim();
}

async function startClamav() {
  const digest = expectDocker(
    docker(["image", "inspect", IMAGE, "--format", "{{index .RepoDigests 0}}"]),
    "pinned_clamav_image_missing",
  );
  assert.ok(digest.endsWith(IMAGE_DIGEST));
  expectDocker(docker([
    "run", "-d", "--rm", "--name", CONTAINER, "--network", "none",
    "--memory", "3g", "--cpus", "2", IMAGE,
  ]), "clamav_container_start_failed");
  clamavCreated = true;
  let healthy = false;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const health = docker(["inspect", CONTAINER, "--format", "{{.State.Health.Status}}"]);
    if (health.status === 0 && health.stdout.trim() === "healthy") {
      healthy = true;
      break;
    }
    if (health.status === 0 && health.stdout.trim() === "unhealthy") {
      throw new Error("clamav_container_unhealthy");
    }
  }
  if (!healthy) throw new Error("clamav_container_not_ready");
  const hostConfig = JSON.parse(expectDocker(
    docker(["inspect", CONTAINER, "--format", "{{json .HostConfig}}"]),
    "clamav_container_isolation_unavailable",
  ));
  assert.equal(hostConfig.NetworkMode, "none");
  assert.deepEqual(hostConfig.PortBindings ?? {}, {});
}

function createScanner({ failFirst = false } = {}) {
  let unavailable = failFirst;
  const scan = createCommunicationInboundScanner({
    executable: DOCKER,
    endpoint: { port: 3310 },
    timeoutMs: 60_000,
    concurrency: 1,
    spawnImpl(executable, args, options) {
      assert.equal(executable, DOCKER);
      assert.deepEqual(args.filter((_, index) => index !== 1), [
        "--config-file", "--stream", "--no-summary", "-",
      ]);
      assert.equal(
        readFileSync(args[1], "utf8"),
        "TCPAddr 127.0.0.1\nTCPSocket 3310\nStreamMaxLength 10485761\n",
      );
      const target = unavailable ? `${CONTAINER}-unavailable` : CONTAINER;
      unavailable = false;
      return spawn(executable, [
        "exec", "-i", target, "clamdscan", "--stream", "--no-summary", "-",
      ], {
        ...options,
        env: { ...dockerEnvironment, LANG: "C", LC_ALL: "C" },
      });
    },
  });
  return async ({ bytes, asset }) => {
    const result = await scan({
      bytes,
      confirmation: {
        institutionId: SCANNER_INSTITUTION_ID,
        inboundId: SCANNER_INBOUND_ID,
        objectId: asset.id,
        mediaType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        sha256: asset.sha256,
      },
    });
    return result.status;
  };
}

function fixture(index, content, {
  extension = "pdf",
  originalName = "document-fictif.pdf",
  mimeType = "application/pdf",
} = {}) {
  const id = ASSET_IDS[index];
  const bytes = Buffer.from(content);
  const path = `local-site-content-recipe/${id}.${extension}`;
  paths.add(path);
  return {
    id,
    bytes,
    path,
    originalName,
    mimeType,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function eicarDocx() {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file("word/document.xml", "<w:document/>");
  zip.file("word/eicar.com", EICAR);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function ensureEmptyScope() {
  const [row] = await sql`select
    (select count(*)::integer from public.site_content_assets
      where id = any(${ASSET_IDS}::uuid[])) as assets,
    (select count(*)::integer from public.site_content_audit
      where resource_id = any(${ASSET_IDS}::uuid[])) as audits,
    (select count(*)::integer from pgmq.q_site_content_file_scan
      where message ->> 'asset_id' = any(${ASSET_IDS}::text[])) as active,
    (select count(*)::integer from pgmq.a_site_content_file_scan
      where message ->> 'asset_id' = any(${ASSET_IDS}::text[])) as archived,
    (select count(*)::integer from supabase_migrations.schema_migrations) as migrations`;
  assert.deepEqual(
    { assets: row.assets, audits: row.audits, active: row.active, archived: row.archived },
    { assets: 0, audits: 0, active: 0, archived: 0 },
    "local_fixture_scope_must_be_empty",
  );
  assert.equal(row.migrations, 93, "local_migration_count_mismatch");
  for (const path of paths) {
    for (const bucket of ["site-content-quarantine", "site-content"]) {
      const { data, error } = await storage.from(bucket).download(path);
      assert.equal(data, null);
      assert.ok(error);
    }
  }
  return row.migrations;
}

async function createFixture(item) {
  await sql`insert into public.site_content_assets (
      id, storage_bucket, storage_path, original_name, mime_type, size_bytes,
      asset_kind, title, status, scan_detail, sha256
    ) values (
      ${item.id}::uuid, 'site-content-quarantine', ${item.path}, ${item.originalName},
      ${item.mimeType}, ${item.bytes.length}, 'document', 'Document fictif',
      'quarantine', 'awaiting_antivirus', ${item.sha256}
    )`;
  const { error } = await storage.from("site-content-quarantine").upload(item.path, item.bytes, {
    contentType: item.mimeType,
    upsert: false,
  });
  if (error) throw new Error("local_quarantine_upload_failed");
  const job = { job_type: "scan_site_content_asset", job_id: randomUUID(), asset_id: item.id };
  const [queued] = await sql`select pgmq.send('site_content_file_scan', ${sql.json(job)})::text as "msgId"`;
  return queued.msgId;
}

async function state(item) {
  const [row] = await sql`select status, storage_bucket as "storageBucket",
      scan_detail as "scanDetail", sha256, scanned_at as "scannedAt"
    from public.site_content_assets where id = ${item.id}::uuid`;
  return row;
}

async function stored(bucket, item) {
  const { data, error } = await storage.from(bucket).download(item.path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

async function auditCount(item, action) {
  const [row] = await sql`select count(*)::integer as count
    from public.site_content_audit
    where resource_id = ${item.id}::uuid and action = ${action}`;
  return row.count;
}

async function cleanupStorage() {
  for (const bucket of ["site-content-quarantine", "site-content"]) {
    const { error } = await storage.from(bucket).remove([...paths]);
    if (error) throw new Error("local_storage_cleanup_failed");
  }
}

async function cleanupDatabase() {
  await sql.begin(async (transaction) => {
    await transaction`set local session_replication_role = 'replica'`;
    await transaction`delete from pgmq.q_site_content_file_scan
      where message ->> 'asset_id' = any(${ASSET_IDS}::text[])`;
    await transaction`delete from pgmq.a_site_content_file_scan
      where message ->> 'asset_id' = any(${ASSET_IDS}::text[])`;
    await transaction`delete from public.site_content_audit
      where resource_id = any(${ASSET_IDS}::uuid[])`;
    await transaction`delete from public.site_content_assets
      where id = any(${ASSET_IDS}::uuid[])`;
  });
}

function storageWithOneRemovalFailure() {
  let fail = true;
  return {
    from(bucket) {
      const scoped = storage.from(bucket);
      return {
        download: (...args) => scoped.download(...args),
        upload: (...args) => scoped.upload(...args),
        remove: async (...args) => {
          if (bucket === "site-content-quarantine" && fail) {
            fail = false;
            return { data: null, error: { message: "synthetic_removal_failure" } };
          }
          return scoped.remove(...args);
        },
      };
    },
  };
}

const tempEntries = () => new Set(readdirSync(tmpdir()).filter((name) => name.startsWith(PREFIX)));
const tempBefore = tempEntries();
let result;
let runError;

try {
  const clean = fixture(0, "%PDF-1.7\nDocument fictif sain\n%%EOF");
  const blocked = fixture(1, await eicarDocx(), {
    extension: "docx",
    originalName: "eicar-fictif.docx",
    mimeType: DOCX_MIME,
  });
  const recovered = fixture(2, "%PDF-1.7\nDocument repris apres panne scanner\n%%EOF");
  const cleanupRecovered = fixture(3, "%PDF-1.7\nDocument repris apres panne nettoyage\n%%EOF");
  const tamperFailedClosed = fixture(4, "%PDF-1.7\nDocument altere apres validation\n%%EOF");
  const migrationCount = await ensureEmptyScope();
  await startClamav();

  await createFixture(clean);
  await createFixture(blocked);
  const firstWorker = createSiteContentFileWorker({ sql, storage, scanBytes: createScanner() });
  const firstBatch = await firstWorker.runBatch({ visibilitySeconds: 300, limit: 2 });
  assert.deepEqual(firstBatch, { claimed: 2, outcomes: ["clean", "blocked"] });
  const cleanState = await state(clean);
  assert.equal(cleanState.status, "ready");
  assert.equal(cleanState.storageBucket, "site-content");
  assert.equal(cleanState.scanDetail, "clamav_clean");
  assert.ok(cleanState.scannedAt instanceof Date);
  assert.deepEqual(await stored("site-content", clean), clean.bytes);
  assert.equal(await stored("site-content-quarantine", clean), null);
  assert.equal(await auditCount(clean, "scan_clean"), 1);
  const blockedState = await state(blocked);
  assert.equal(blockedState.status, "blocked");
  assert.equal(blockedState.scanDetail, "antivirus_detected_threat");
  assert.equal(await stored("site-content-quarantine", blocked), null);
  assert.equal(await stored("site-content", blocked), null);
  assert.equal(await auditCount(blocked, "scan_blocked"), 1);

  const recoveryJobId = await createFixture(recovered);
  const recoveryScanner = createScanner({ failFirst: true });
  const recoveryWorker = createSiteContentFileWorker({ sql, storage, scanBytes: recoveryScanner });
  assert.deepEqual(await recoveryWorker.runBatch({ visibilitySeconds: 300, limit: 1 }), {
    claimed: 1,
    outcomes: ["retrying"],
  });
  assert.equal((await state(recovered)).status, "quarantine");
  const resetRecovery = await sql`select msg_id from pgmq.set_vt(
    'site_content_file_scan', ${recoveryJobId}::bigint, 0)`;
  assert.equal(resetRecovery.length, 1);
  assert.deepEqual(await recoveryWorker.runBatch({ visibilitySeconds: 300, limit: 1 }), {
    claimed: 1,
    outcomes: ["clean"],
  });
  assert.equal((await state(recovered)).status, "ready");

  const cleanupJobId = await createFixture(cleanupRecovered);
  const faultWorker = createSiteContentFileWorker({
    sql,
    storage: storageWithOneRemovalFailure(),
    scanBytes: createScanner(),
  });
  assert.deepEqual(await faultWorker.runBatch({ visibilitySeconds: 300, limit: 1 }), {
    claimed: 1,
    outcomes: ["retrying"],
  });
  assert.equal((await state(cleanupRecovered)).status, "ready");
  assert.deepEqual(await stored("site-content", cleanupRecovered), cleanupRecovered.bytes);
  assert.deepEqual(await stored("site-content-quarantine", cleanupRecovered), cleanupRecovered.bytes);
  const resetCleanup = await sql`select msg_id from pgmq.set_vt(
    'site_content_file_scan', ${cleanupJobId}::bigint, 0)`;
  assert.equal(resetCleanup.length, 1);
  const cleanupWorker = createSiteContentFileWorker({ sql, storage, scanBytes: createScanner() });
  assert.deepEqual(await cleanupWorker.runBatch({ visibilitySeconds: 300, limit: 1 }), {
    claimed: 1,
    outcomes: ["clean"],
  });
  assert.equal(await stored("site-content-quarantine", cleanupRecovered), null);
  assert.equal(await auditCount(cleanupRecovered, "scan_clean"), 1);

  const tamperJobId = await createFixture(tamperFailedClosed);
  const tamperFaultWorker = createSiteContentFileWorker({
    sql,
    storage: storageWithOneRemovalFailure(),
    scanBytes: createScanner(),
  });
  assert.deepEqual(await tamperFaultWorker.runBatch({ visibilitySeconds: 300, limit: 1 }), {
    claimed: 1,
    outcomes: ["retrying"],
  });
  assert.equal((await state(tamperFailedClosed)).status, "ready");
  const tamperedBytes = Buffer.from(tamperFailedClosed.bytes);
  tamperedBytes[10] ^= 1;
  const removedClean = await storage.from("site-content").remove([tamperFailedClosed.path]);
  if (removedClean.error) throw new Error("local_clean_tamper_remove_failed");
  const uploadedTamper = await storage.from("site-content").upload(
    tamperFailedClosed.path,
    tamperedBytes,
    { contentType: tamperFailedClosed.mimeType, upsert: false },
  );
  if (uploadedTamper.error) throw new Error("local_clean_tamper_upload_failed");
  const terminalWorker = createSiteContentFileWorker({
    sql,
    storage,
    scanBytes: async () => { throw new Error("unexpected_terminal_rescan"); },
  });
  for (let attempt = 2; attempt <= 5; attempt += 1) {
    const resetTamper = await sql`select msg_id from pgmq.set_vt(
      'site_content_file_scan', ${tamperJobId}::bigint, 0)`;
    assert.equal(resetTamper.length, 1);
    const expected = attempt === 5 ? "failed" : "retrying";
    assert.deepEqual(await terminalWorker.runBatch({ visibilitySeconds: 300, limit: 1 }), {
      claimed: 1,
      outcomes: [expected],
    });
  }
  const tamperState = await state(tamperFailedClosed);
  assert.equal(tamperState.status, "archived");
  assert.equal(tamperState.scanDetail, "asset_digest_mismatch");
  assert.equal(await auditCount(tamperFailedClosed, "scan_clean"), 1);
  assert.equal(await auditCount(tamperFailedClosed, "scan_error"), 1);

  const [queues] = await sql`select
    (select count(*)::integer from pgmq.q_site_content_file_scan
      where message ->> 'asset_id' = any(${ASSET_IDS}::text[])) as active,
    (select count(*)::integer from pgmq.a_site_content_file_scan
      where message ->> 'asset_id' = any(${ASSET_IDS}::text[])) as archived`;
  assert.deepEqual(queues, { active: 0, archived: 1 });
  assert.deepEqual([...tempEntries()].filter((name) => !tempBefore.has(name)), []);
  result = {
    migrations: migrationCount,
    database: "local-postgresql",
    storage: "local-private",
    antivirus: "ClamAV 1.5.4",
    clean: 1,
    blocked: 1,
    scannerRecovery: 1,
    cleanupRecovery: 1,
    tamperFailClosed: 1,
    archivedFailureProof: 1,
    cleanupResidues: 0,
    temporaryResidues: 0,
  };
} catch (error) {
  runError = error;
} finally {
  let cleanupError;
  try { await cleanupStorage(); } catch (error) { cleanupError = error; }
  try { await cleanupDatabase(); } catch (error) { cleanupError ??= error; }
  if (!runError && cleanupError) runError = cleanupError;
}

try {
  if (!runError) {
    const counts = await ensureEmptyScope();
    assert.equal(counts, 93);
    console.log(JSON.stringify(result));
  }
} finally {
  await sql.end({ timeout: 5 }).catch((error) => { runError ??= error; });
  if (clamavCreated) docker(["rm", "-f", CONTAINER]);
  const remaining = docker(["ps", "-a", "--filter", `name=^/${CONTAINER}$`, "--format", "{{.ID}}"]);
  if (remaining.status !== 0 || remaining.stdout.trim()) runError ??= new Error("clamav_container_residue");
}
if (runError) throw runError;
