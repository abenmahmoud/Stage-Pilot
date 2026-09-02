import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute } from "node:path";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import {
  createCommunicationInboundCleanStore,
  createCommunicationInboundQuarantineReader,
  createCommunicationInboundQuarantineStore,
} from "../api/_shared/communication-inbound-transfer.ts";
import { createCommunicationInboundScanner } from "../workers/communication-inbound-scanner.mjs";
import { createCommunicationInboundScanProcessor } from "../workers/communication-inbound-scan-core.mjs";
import { createCommunicationInboundScanRepository } from "../workers/communication-inbound-scan-repository.mjs";
import { runCommunicationInboundScanBatch } from "../workers/communication-inbound-scan-worker.mjs";

const IMAGE_DIGEST = "sha256:f0954d679017eb6d48221e2b2be3ac5457bf278a844f39b672376f55a085f591";
const IMAGE = `clamav/clamav@${IMAGE_DIGEST}`;
const CONTAINER = `lyceegest-clamav-worker-recipe-${process.pid}`;
const DOCKER = process.env.LYCEEGEST_DOCKER_EXE
  ?? "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
const DATABASE_URL = process.env.LYCEEGEST_LOCAL_DATABASE_URL;
const LOCAL_SUPABASE_URL = process.env.LYCEEGEST_LOCAL_SUPABASE_URL;
const LOCAL_SUPABASE_SERVER_KEY = process.env.LYCEEGEST_LOCAL_SUPABASE_SERVER_KEY;
const STORAGE_ORIGIN = "https://local-lyceegest.supabase.co";
const PREFIX = "lyceegest-inbound-scan-";
const INSTITUTION_ID = "00000000-0000-4000-8000-000000009501";
const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
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

function createMappedFetch() {
  return async (url, init) => {
    assert.equal(typeof url, "string");
    assert.ok(url.startsWith(`${STORAGE_ORIGIN}/storage/v1/`));
    const response = await fetch(localOrigin + url.slice(STORAGE_ORIGIN.length), init);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

function createScanner({ failFirst = false } = {}) {
  let unavailable = failFirst;
  return createCommunicationInboundScanner({
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
}

const storageOptions = {
  supabaseUrl: STORAGE_ORIGIN,
  serviceRoleKey: localServerSecret,
  fetchImpl: createMappedFetch(),
  timeoutMs: 20_000,
};
const storeQuarantine = createCommunicationInboundQuarantineStore(storageOptions);
const readQuarantine = createCommunicationInboundQuarantineReader(storageOptions);
const storeClean = createCommunicationInboundCleanStore(storageOptions);
const storageAdmin = createClient(localOrigin, localServerSecret, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const sql = postgres(dbUrl, { prepare: false, max: 3, connect_timeout: 10, idle_timeout: 20,
  onnotice: () => {} });
const paths = [];
let clamavCreated = false;

function fixture(index, content) {
  const suffix = String(index).padStart(2, "0");
  const inboundId = `00000000-0000-4000-8000-0000000095${suffix}`;
  const objectId = `00000000-0000-4000-8000-0000000096${suffix}`;
  const bytes = Buffer.from(content);
  const storagePath = `institutions/${INSTITUTION_ID}/inbound/${inboundId}/objects/${objectId}`;
  return {
    institutionId: INSTITUTION_ID,
    inboundId,
    objectId,
    bytes,
    storagePath,
    confirmation: {
      institutionId: INSTITUTION_ID,
      inboundId,
      objectId,
      mediaType: "text/plain",
      sizeBytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  };
}

async function ensureEmptyFixtureScope() {
  const [{ active, archived, institutions, migrations }] = await sql`select
    (select count(*)::integer from pgmq.q_communication_inbound_scan) as active,
    (select count(*)::integer from pgmq.a_communication_inbound_scan) as archived,
    (select count(*)::integer from public.institutions where id = ${INSTITUTION_ID}::uuid) as institutions,
    (select count(*)::integer from supabase_migrations.schema_migrations) as migrations`;
  assert.deepEqual({ active, archived, institutions }, { active: 0, archived: 0, institutions: 0 },
    "local_fixture_scope_must_be_empty");
  assert.equal(migrations, 93, "local_migration_count_mismatch");
  return migrations;
}

async function createFixture(item) {
  const job = { schema: 1, job_type: "scan_communication_inbound_object",
    institution_id: item.institutionId, inbound_id: item.inboundId, object_id: item.objectId };
  const [created] = await sql.begin(async (tx) => {
    await tx`insert into public.communication_inbound
      (id, institution_id, provider, external_message_hash, status)
      values (${item.inboundId}::uuid, ${item.institutionId}::uuid, 'brevo_inbound',
        ${createHash("sha256").update(`inbound-${item.inboundId}`).digest("hex")}, 'received')`;
    await tx`insert into public.communication_inbound_objects
      (id, institution_id, inbound_id, object_kind, object_ref_hash, media_type, size_bytes, storage_path)
      values (${item.objectId}::uuid, ${item.institutionId}::uuid, ${item.inboundId}::uuid,
        'attachment', ${createHash("sha256").update(`object-${item.objectId}`).digest("hex")},
        'text/plain', ${item.bytes.length}, ${item.storagePath})`;
    await tx`insert into public.communication_inbound_object_events
      (institution_id, inbound_object_id, actor_type, event_type, summary)
      values (${item.institutionId}::uuid, ${item.objectId}::uuid, 'provider', 'object.reserved',
        ${tx.json({ objectKind: "attachment", sizeBytes: item.bytes.length })})`;
    await tx`update public.communication_inbound_objects set status = 'quarantine',
      scan_detail = 'awaiting_antivirus', sha256 = ${item.confirmation.sha256}
      where id = ${item.objectId}::uuid and institution_id = ${item.institutionId}::uuid`;
    await tx`insert into public.communication_inbound_object_events
      (institution_id, inbound_object_id, actor_type, event_type, summary)
      values (${item.institutionId}::uuid, ${item.objectId}::uuid, 'system',
        'object.quarantined', ${tx.json({ scan: "pending" })})`;
    return tx`select pgmq.send('communication_inbound_scan', ${tx.json(job)})::text as "msgId"`;
  });
  await storeQuarantine({ bytes: item.bytes, confirmation: item.confirmation });
  paths.push({ bucket: "communication-inbound-quarantine", path: item.storagePath });
  paths.push({ bucket: "communication-inbound-clean", path: item.storagePath });
  return created.msgId;
}

async function objectState(item) {
  const [row] = await sql`select status, storage_bucket as "storageBucket",
      scan_detail as "scanDetail", sha256, scanned_at as "scannedAt"
    from public.communication_inbound_objects
    where id = ${item.objectId}::uuid and institution_id = ${item.institutionId}::uuid`;
  return row;
}

async function eventCount(item, type) {
  const [row] = await sql`select count(*)::integer as count
    from public.communication_inbound_object_events
    where institution_id = ${item.institutionId}::uuid
      and inbound_object_id = ${item.objectId}::uuid and event_type = ${type}`;
  return row.count;
}

async function processOne(scanner) {
  const repository = createCommunicationInboundScanRepository(sql);
  const processLease = createCommunicationInboundScanProcessor({
    withTransaction: repository.withTransaction,
    download: readQuarantine,
    scan: scanner,
    storeClean,
    concurrency: 1,
  });
  return runCommunicationInboundScanBatch({ repository, processLease, limit: 1, concurrency: 1 });
}

async function cleanupStorage() {
  for (const bucket of ["communication-inbound-quarantine", "communication-inbound-clean"]) {
    const names = paths.filter((item) => item.bucket === bucket).map((item) => item.path);
    if (!names.length) continue;
    const { error } = await storageAdmin.storage.from(bucket).remove(names);
    if (error) throw new Error("local_storage_cleanup_failed");
  }
}

async function cleanupDatabase() {
  await sql.begin(async (tx) => {
    await tx`set local session_replication_role = 'replica'`;
    await tx`delete from pgmq.q_communication_inbound_scan
      where message ->> 'institution_id' = ${INSTITUTION_ID}`;
    await tx`delete from pgmq.a_communication_inbound_scan
      where message ->> 'institution_id' = ${INSTITUTION_ID}`;
    await tx`delete from public.communication_inbound_object_events
      where institution_id = ${INSTITUTION_ID}::uuid`;
    await tx`delete from public.communication_inbound_objects
      where institution_id = ${INSTITUTION_ID}::uuid`;
    await tx`delete from public.communication_inbound
      where institution_id = ${INSTITUTION_ID}::uuid`;
    await tx`delete from public.institutions where id = ${INSTITUTION_ID}::uuid`;
  });
}

const tempEntries = () => new Set(readdirSync(tmpdir()).filter((name) => name.startsWith(PREFIX)));
const tempBefore = tempEntries();

try {
  const migrationCount = await ensureEmptyFixtureScope();
  await sql`insert into public.institutions (id, slug, name, status)
    values (${INSTITUTION_ID}::uuid, 'local-inbound-worker-recipe',
      'Local fictional inbound worker recipe', 'draft')`;
  await startClamav();

  const clean = fixture(10, "Fichier fictif sain pour la recette locale LyceeGest");
  await createFixture(clean);
  const cleanBatch = await processOne(createScanner());
  assert.equal(cleanBatch.clean, 1);
  const cleanState = await objectState(clean);
  assert.deepEqual(cleanState, {
    status: "clean",
    storageBucket: "communication-inbound-clean",
    scanDetail: "clamav_clean",
    sha256: clean.confirmation.sha256,
    scannedAt: cleanState.scannedAt,
  });
  assert.ok(cleanState.scannedAt instanceof Date);
  assert.equal(await eventCount(clean, "object.clean"), 1);

  const blocked = fixture(11, EICAR);
  await createFixture(blocked);
  const blockedBatch = await processOne(createScanner());
  assert.equal(blockedBatch.blocked, 1);
  const blockedState = await objectState(blocked);
  assert.equal(blockedState.status, "blocked");
  assert.equal(blockedState.storageBucket, "communication-inbound-quarantine");
  assert.equal(await eventCount(blocked, "object.blocked"), 1);

  const recovered = fixture(12, "Fichier fictif repris apres indisponibilite du scanner");
  const recoveryJobId = await createFixture(recovered);
  const scanner = createScanner({ failFirst: true });
  const retryBatch = await processOne(scanner);
  assert.equal(retryBatch.retry, 1);
  assert.equal((await objectState(recovered)).status, "scan_error");
  assert.equal(await eventCount(recovered, "object.scan_error"), 1);
  const reset = await sql`select msg_id from pgmq.set_vt(
    'communication_inbound_scan', ${recoveryJobId}::bigint, 0)`;
  assert.equal(reset.length, 1);
  const recoveredBatch = await processOne(scanner);
  assert.equal(recoveredBatch.clean, 1);
  assert.equal((await objectState(recovered)).status, "clean");
  assert.equal(await eventCount(recovered, "object.clean"), 1);

  const [{ active, archived }] = await sql`select
    (select count(*)::integer from pgmq.q_communication_inbound_scan
      where message ->> 'institution_id' = ${INSTITUTION_ID}) as active,
    (select count(*)::integer from pgmq.a_communication_inbound_scan
      where message ->> 'institution_id' = ${INSTITUTION_ID}) as archived`;
  assert.deepEqual({ active, archived }, { active: 0, archived: 0 });
  assert.deepEqual([...tempEntries()].filter((name) => !tempBefore.has(name)), []);

  console.log(JSON.stringify({ migrations: migrationCount, database: "local-postgresql",
    storage: "local-private", antivirus: "ClamAV 1.5.4", clean: 1, blocked: 1,
    retry: 1, recovered: 1, queueResidues: 0, temporaryResidues: 0 }));
} finally {
  let cleanupError;
  try { await cleanupStorage(); } catch (error) { cleanupError = error; }
  try { await cleanupDatabase(); } catch (error) { cleanupError ??= error; }
  await sql.end({ timeout: 5 }).catch((error) => { cleanupError ??= error; });
  if (clamavCreated) docker(["rm", "-f", CONTAINER]);
  const remaining = docker(["ps", "-a", "--filter", `name=^/${CONTAINER}$`, "--format", "{{.ID}}"]);
  if (remaining.status !== 0 || remaining.stdout.trim()) cleanupError ??= new Error("clamav_container_residue");
  if (cleanupError) throw cleanupError;
}
