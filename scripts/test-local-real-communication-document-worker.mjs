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
import { createCommunicationDocumentWorker } from "../workers/communication-document-worker-core.mjs";

const IMAGE_DIGEST = "sha256:f0954d679017eb6d48221e2b2be3ac5457bf278a844f39b672376f55a085f591";
const IMAGE = `clamav/clamav@${IMAGE_DIGEST}`;
const CONTAINER = `lyceegest-clamav-communication-document-recipe-${process.pid}`;
const DOCKER = process.env.LYCEEGEST_DOCKER_EXE
  ?? "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
const DATABASE_URL = process.env.LYCEEGEST_LOCAL_DATABASE_URL;
const LOCAL_SUPABASE_URL = process.env.LYCEEGEST_LOCAL_SUPABASE_URL;
const LOCAL_SUPABASE_SERVER_KEY = process.env.LYCEEGEST_LOCAL_SUPABASE_SERVER_KEY;
const INSTITUTION_ID = "00000000-0000-4000-8000-000000009801";
const USER_ID = "00000000-0000-4000-8000-000000009802";
const DOCUMENT_IDS = [
  "00000000-0000-4000-8000-000000009810",
  "00000000-0000-4000-8000-000000009811",
  "00000000-0000-4000-8000-000000009812",
  "00000000-0000-4000-8000-000000009813",
  "00000000-0000-4000-8000-000000009814",
];
const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PREFIX = "lyceegest-inbound-scan-";
const workerRequire = createRequire(new URL("../workers/package.json", import.meta.url));
const JSZip = workerRequire("jszip");
const { PDFDocument, StandardFonts } = workerRequire("pdf-lib");
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
  return async ({ bytes, document }) => {
    const result = await scan({
      bytes,
      confirmation: {
        institutionId: document.institutionId,
        inboundId: document.id,
        objectId: document.id,
        mediaType: document.mimeType,
        sizeBytes: document.sizeBytes,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    });
    return result.status;
  };
}

async function validPdf(text) {
  const document = await PDFDocument.create();
  const page = document.addPage([595, 842]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: 50, y: 780, size: 14, font });
  return Buffer.from(await document.save());
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

function fixture(index, bytes, {
  extension = "pdf",
  originalName = "communication-fictive.pdf",
  mimeType = "application/pdf",
} = {}) {
  const id = DOCUMENT_IDS[index];
  const path = `local-communication-document-recipe/${id}.${extension}`;
  paths.add(path);
  return {
    id,
    bytes: Buffer.from(bytes),
    path,
    originalName,
    mimeType,
    checksum: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function ensureEmptyScope() {
  const [row] = await sql`select
    (select count(*)::integer from public.communication_source_documents
      where id = any(${DOCUMENT_IDS}::uuid[])) as documents,
    (select count(*)::integer from public.communication_source_events
      where source_document_id = any(${DOCUMENT_IDS}::uuid[])) as events,
    (select count(*)::integer from pgmq.q_communication_document_scan
      where message ->> 'source_document_id' = any(${DOCUMENT_IDS}::text[])) as active,
    (select count(*)::integer from pgmq.a_communication_document_scan
      where message ->> 'source_document_id' = any(${DOCUMENT_IDS}::text[])) as archived,
    (select count(*)::integer from public.institutions where id = ${INSTITUTION_ID}::uuid) as institutions,
    (select count(*)::integer from auth.users where id = ${USER_ID}::uuid) as users,
    (select count(*)::integer from supabase_migrations.schema_migrations) as migrations`;
  assert.deepEqual(
    {
      documents: row.documents,
      events: row.events,
      active: row.active,
      archived: row.archived,
      institutions: row.institutions,
      users: row.users,
    },
    { documents: 0, events: 0, active: 0, archived: 0, institutions: 0, users: 0 },
    "local_fixture_scope_must_be_empty",
  );
  assert.equal(row.migrations, 93, "local_migration_count_mismatch");
  for (const path of paths) {
    const { data, error } = await storage.from("communication-ingest").download(path);
    assert.equal(data, null);
    assert.ok(error);
  }
  return row.migrations;
}

async function createScope() {
  await sql`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', ${USER_ID}::uuid,
      'authenticated', 'authenticated', 'local-communication-document@example.test', '',
      transaction_timestamp(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"fixture":true}'::jsonb, transaction_timestamp(), transaction_timestamp()
    )
  `;
  await sql`
    insert into public.institutions (id, slug, name, status)
    values (${INSTITUTION_ID}::uuid, 'local-communication-document-recipe',
      'Local fictional communication document recipe', 'draft')
  `;
}

async function createFixture(item) {
  await sql.begin(async (transaction) => {
    await transaction`
      insert into public.communication_source_documents (
        id, institution_id, original_name, mime_type, size_bytes,
        storage_path, uploaded_by
      ) values (
        ${item.id}::uuid, ${INSTITUTION_ID}::uuid, ${item.originalName},
        ${item.mimeType}, ${item.bytes.length}, ${item.path}, ${USER_ID}::uuid
      )
    `;
    await transaction`
      insert into public.communication_source_events (
        institution_id, source_document_id, event_type, actor_user_id, actor_type, summary
      ) values (
        ${INSTITUTION_ID}::uuid, ${item.id}::uuid, 'source.reserved',
        ${USER_ID}::uuid, 'user', ${transaction.json({ fixture: true })}
      )
    `;
  });
  const { error } = await storage.from("communication-ingest").upload(item.path, item.bytes, {
    contentType: item.mimeType,
    upsert: false,
  });
  if (error) throw new Error("local_communication_document_upload_failed");
  const job = {
    job_id: randomUUID(),
    job_type: "scan_communication_document",
    institution_id: INSTITUTION_ID,
    source_document_id: item.id,
    attempt: 0,
  };
  return sql.begin(async (transaction) => {
    await transaction`
      update public.communication_source_documents
      set status = 'quarantined', uploaded_at = now()
      where id = ${item.id}::uuid and institution_id = ${INSTITUTION_ID}::uuid
        and status = 'reserved'
    `;
    await transaction`
      insert into public.communication_source_events (
        institution_id, source_document_id, event_type, actor_user_id, actor_type, summary
      ) values (
        ${INSTITUTION_ID}::uuid, ${item.id}::uuid, 'source.confirmed',
        ${USER_ID}::uuid, 'user', ${transaction.json({ jobId: job.job_id })}
      )
    `;
    const [queued] = await transaction`
      select pgmq.send('communication_document_scan', ${transaction.json(job)})::text as "msgId"
    `;
    return queued.msgId;
  });
}

async function state(item) {
  const [row] = await sql`
    select status, checksum, extracted_text as "extractedText",
           analysis_error as "analysisError", extraction_summary as "extractionSummary",
           analyzed_at as "analyzedAt"
    from public.communication_source_documents
    where id = ${item.id}::uuid and institution_id = ${INSTITUTION_ID}::uuid
  `;
  return row;
}

async function stored(item) {
  const { data, error } = await storage.from("communication-ingest").download(item.path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

async function eventCount(item, eventType) {
  const [row] = await sql`
    select count(*)::integer as count
    from public.communication_source_events
    where source_document_id = ${item.id}::uuid and event_type = ${eventType}
  `;
  return row.count;
}

async function cleanupStorage() {
  const { error } = await storage.from("communication-ingest").remove([...paths]);
  if (error) throw new Error("local_storage_cleanup_failed");
}

async function cleanupDatabase() {
  await sql.begin(async (transaction) => {
    await transaction`set local session_replication_role = 'replica'`;
    await transaction`delete from pgmq.q_communication_document_scan
      where message ->> 'source_document_id' = any(${DOCUMENT_IDS}::text[])`;
    await transaction`delete from pgmq.a_communication_document_scan
      where message ->> 'source_document_id' = any(${DOCUMENT_IDS}::text[])`;
    await transaction`delete from public.communication_source_events
      where source_document_id = any(${DOCUMENT_IDS}::uuid[])`;
    await transaction`delete from public.communication_source_documents
      where id = any(${DOCUMENT_IDS}::uuid[])`;
    await transaction`delete from public.institutions where id = ${INSTITUTION_ID}::uuid`;
    await transaction`delete from auth.users where id = ${USER_ID}::uuid`;
  });
}

function storageWithOneRemovalFailure() {
  let fail = true;
  return {
    from(bucket) {
      const scoped = storage.from(bucket);
      return {
        download: (...args) => scoped.download(...args),
        remove: async (...args) => {
          if (bucket === "communication-ingest" && fail) {
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
  const clean = fixture(0, await validPdf("Communication fictive saine pour le lycée"));
  const blocked = fixture(1, await eicarDocx(), {
    extension: "docx",
    originalName: "eicar-fictif.docx",
    mimeType: DOCX_MIME,
  });
  const recovered = fixture(2, await validPdf("Communication reprise après panne scanner"));
  const cleanupRecovered = fixture(3, await eicarDocx(), {
    extension: "docx",
    originalName: "eicar-nettoyage-fictif.docx",
    mimeType: DOCX_MIME,
  });
  const tamperFailedClosed = fixture(4, await validPdf("Communication altérée après validation"));
  const migrationCount = await ensureEmptyScope();
  await createScope();
  await startClamav();

  await createFixture(clean);
  await createFixture(blocked);
  const firstWorker = createCommunicationDocumentWorker({
    sql,
    storage,
    scanBytes: createScanner(),
  });
  assert.deepEqual(await firstWorker.runBatch({ visibilitySeconds: 300, limit: 2 }), {
    claimed: 2,
    outcomes: ["review", "blocked"],
  });
  const cleanState = await state(clean);
  assert.equal(cleanState.status, "review");
  assert.equal(cleanState.checksum, clean.checksum);
  assert.match(cleanState.extractedText, /Communication fictive saine/u);
  assert.ok(cleanState.analyzedAt instanceof Date);
  assert.deepEqual(await stored(clean), clean.bytes);
  assert.equal(await eventCount(clean, "source.scanned"), 1);
  const blockedState = await state(blocked);
  assert.equal(blockedState.status, "rejected");
  assert.equal(blockedState.analysisError, "antivirus_detected_threat");
  assert.equal(await stored(blocked), null);
  assert.equal(await eventCount(blocked, "source.rejected"), 1);

  const recoveryJobId = await createFixture(recovered);
  const recoveryWorker = createCommunicationDocumentWorker({
    sql,
    storage,
    scanBytes: createScanner({ failFirst: true }),
  });
  assert.deepEqual(await recoveryWorker.runBatch({ visibilitySeconds: 300, limit: 1 }), {
    claimed: 1,
    outcomes: ["retrying"],
  });
  assert.equal((await state(recovered)).status, "quarantined");
  assert.equal((await sql`select msg_id from pgmq.set_vt(
    'communication_document_scan', ${recoveryJobId}::bigint, 0)`).length, 1);
  assert.deepEqual(await recoveryWorker.runBatch({ visibilitySeconds: 300, limit: 1 }), {
    claimed: 1,
    outcomes: ["review"],
  });
  assert.equal((await state(recovered)).status, "review");

  const cleanupJobId = await createFixture(cleanupRecovered);
  const cleanupFaultWorker = createCommunicationDocumentWorker({
    sql,
    storage: storageWithOneRemovalFailure(),
    scanBytes: createScanner(),
  });
  assert.deepEqual(await cleanupFaultWorker.runBatch({ visibilitySeconds: 300, limit: 1 }), {
    claimed: 1,
    outcomes: ["retrying"],
  });
  assert.equal((await state(cleanupRecovered)).status, "rejected");
  assert.deepEqual(await stored(cleanupRecovered), cleanupRecovered.bytes);
  assert.equal(await eventCount(cleanupRecovered, "source.rejected"), 1);
  assert.equal((await sql`select msg_id from pgmq.set_vt(
    'communication_document_scan', ${cleanupJobId}::bigint, 0)`).length, 1);
  const cleanupWorker = createCommunicationDocumentWorker({
    sql,
    storage,
    scanBytes: async () => { throw new Error("unexpected_terminal_rescan"); },
  });
  assert.deepEqual(await cleanupWorker.runBatch({ visibilitySeconds: 300, limit: 1 }), {
    claimed: 1,
    outcomes: ["rejected"],
  });
  assert.equal(await stored(cleanupRecovered), null);
  assert.equal(await eventCount(cleanupRecovered, "source.rejected"), 1);

  await createFixture(tamperFailedClosed);
  const tamperWorker = createCommunicationDocumentWorker({
    sql,
    storage,
    scanBytes: createScanner(),
  });
  assert.deepEqual(await tamperWorker.runBatch({ visibilitySeconds: 300, limit: 1 }), {
    claimed: 1,
    outcomes: ["review"],
  });
  const tamperedBytes = Buffer.from(tamperFailedClosed.bytes);
  tamperedBytes[tamperedBytes.length - 10] ^= 1;
  const removed = await storage.from("communication-ingest").remove([tamperFailedClosed.path]);
  if (removed.error) throw new Error("local_tamper_remove_failed");
  const uploaded = await storage.from("communication-ingest").upload(
    tamperFailedClosed.path,
    tamperedBytes,
    { contentType: tamperFailedClosed.mimeType, upsert: false },
  );
  if (uploaded.error) throw new Error("local_tamper_upload_failed");
  const tamperJob = {
    job_id: randomUUID(),
    job_type: "scan_communication_document",
    institution_id: INSTITUTION_ID,
    source_document_id: tamperFailedClosed.id,
    attempt: 0,
  };
  const [tamperQueued] = await sql`
    select pgmq.send('communication_document_scan', ${sql.json(tamperJob)})::text as "msgId"
  `;
  const terminalWorker = createCommunicationDocumentWorker({
    sql,
    storage,
    scanBytes: async () => { throw new Error("unexpected_terminal_rescan"); },
  });
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    if (attempt > 1) {
      assert.equal((await sql`select msg_id from pgmq.set_vt(
        'communication_document_scan', ${tamperQueued.msgId}::bigint, 0)`).length, 1);
    }
    assert.deepEqual(await terminalWorker.runBatch({ visibilitySeconds: 300, limit: 1 }), {
      claimed: 1,
      outcomes: [attempt === 5 ? "failed" : "retrying"],
    });
  }
  const tamperState = await state(tamperFailedClosed);
  assert.equal(tamperState.status, "failed");
  assert.equal(tamperState.analysisError, "communication_document_digest_mismatch");
  assert.equal(tamperState.extractedText, null);
  assert.equal(await eventCount(tamperFailedClosed, "source.scanned"), 1);
  assert.equal(await eventCount(tamperFailedClosed, "source.failed"), 1);

  const [queues] = await sql`select
    (select count(*)::integer from pgmq.q_communication_document_scan
      where message ->> 'source_document_id' = any(${DOCUMENT_IDS}::text[])) as active,
    (select count(*)::integer from pgmq.a_communication_document_scan
      where message ->> 'source_document_id' = any(${DOCUMENT_IDS}::text[])) as archived`;
  assert.deepEqual(queues, { active: 0, archived: 1 });
  assert.deepEqual([...tempEntries()].filter((name) => !tempBefore.has(name)), []);
  result = {
    migrations: migrationCount,
    database: "local-postgresql",
    storage: "local-private",
    antivirus: "ClamAV 1.5.4",
    extractedPdf: 1,
    blockedDocx: 1,
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
    const count = await ensureEmptyScope();
    assert.equal(count, 93);
    console.log(JSON.stringify(result));
  }
} finally {
  await sql.end({ timeout: 5 }).catch((error) => { runError ??= error; });
  if (clamavCreated) docker(["rm", "-f", CONTAINER]);
  const remaining = docker(["ps", "-a", "--filter", `name=^/${CONTAINER}$`, "--format", "{{.ID}}"]);
  if (remaining.status !== 0 || remaining.stdout.trim()) {
    runError ??= new Error("clamav_container_residue");
  }
}

if (runError) throw runError;
