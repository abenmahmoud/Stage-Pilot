import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import WebSocket from "ws";

const execFileAsync = promisify(execFile);
const confirmation = process.env.SCHEDULE_DOCUMENT_TEST_CONFIRM;
const expectedProjectRef = process.env.SCHEDULE_DOCUMENT_EXPECTED_PROJECT_REF;
const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const depotUrl = process.env.LYCEEGEST_URL;
const depotToken = process.env.LYCEEGEST_TOKEN;
const serviceName = process.env.SCHEDULE_DOCUMENT_WORKER_SERVICE
  ?? "lycee-schedule-document-worker.service";

if (confirmation !== "preview-only") {
  throw new Error("Set SCHEDULE_DOCUMENT_TEST_CONFIRM=preview-only");
}
if (!expectedProjectRef || !/^[a-z]{20}$/.test(expectedProjectRef)) {
  throw new Error("SCHEDULE_DOCUMENT_EXPECTED_PROJECT_REF is required");
}
if (!databaseUrl || !databaseUrl.includes(expectedProjectRef)) {
  throw new Error("DATABASE_URL does not match the expected preview project");
}
if (!supabaseUrl || new URL(supabaseUrl).hostname !== `${expectedProjectRef}.supabase.co`) {
  throw new Error("SUPABASE_URL does not match the expected preview project");
}
if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
if (!depotUrl || !depotToken || depotToken.length < 32) {
  throw new Error("The Depot Lycee endpoint and token are required");
}

const endpoint = new URL(`${depotUrl.replace(/\/$/, "")}/edt`);
if (endpoint.protocol !== "https:" || endpoint.hostname !== "lycee-blaise-cendrars-sevran.fr") {
  throw new Error("The Depot Lycee endpoint is not the expected preview domain");
}

const sql = postgres(databaseUrl, { prepare: false, max: 2, idle_timeout: 20 });
const storage = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket },
}).storage;
const bucket = "schedule-ingest";
const marker = randomUUID();
const shortMarker = marker.slice(0, 8);
const originalName = `edt-fictif-${marker}.csv`;
const bytes = Buffer.from(
  [
    "Classe,Jour,Heure debut,Heure fin,Matiere,Salle",
    `TEST-${shortMarker},Lundi,08:00,09:00,Matiere fictive,SALLE-TEST`,
  ].join("\n"),
  "utf8"
);
const checksum = createHash("sha256").update(bytes).digest("hex");
let sourceId;
let storagePath;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parisDay() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function plusDays(day, count) {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function schoolYearFor(day) {
  const year = Number(day.slice(0, 4));
  const start = Number(day.slice(5, 7)) >= 8 ? year : year - 1;
  return `${start}-${start + 1}`;
}

async function depot(body) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${depotToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Depot Lycee rejected the test (${response.status})`);
  return payload;
}

async function runWorker() {
  await execFileAsync("systemctl", ["start", serviceName], { timeout: 180_000 });
  const { stdout } = await execFileAsync(
    "systemctl",
    ["show", serviceName, "-p", "Result", "-p", "ExecMainStatus"],
    { timeout: 30_000 }
  );
  assert(/Result=success/.test(stdout), "Schedule worker service result is not success");
  assert(/ExecMainStatus=0/.test(stdout), "Schedule worker service exit code is not zero");
}

async function cleanOwnResources() {
  if (!sourceId) return;
  const [source] = await sql`
    select storage_bucket, storage_path
    from public.schedule_source_versions
    where id = ${sourceId}
  `;
  if (source) {
    storagePath = source.storage_path;
    const removed = await storage.from(source.storage_bucket).remove([source.storage_path]);
    if (removed.error) throw new Error("Fictitious schedule object cleanup failed");
  }
  const queued = await sql`
    select msg_id
    from pgmq.q_schedule_document_scan
    where message ->> 'source_version_id' = ${sourceId}
  `;
  for (const row of queued) {
    await sql`select pgmq.delete('schedule_document_scan', ${row.msg_id}::bigint)`;
  }
  await sql`delete from public.schedule_source_versions where id = ${sourceId}`;
}

async function verifyCleanup() {
  if (!sourceId) return { sources: 0, audits: 0, jobs: 0, storage: 0 };
  const [counts] = await sql`
    select
      (select count(*)::int from public.schedule_source_versions where id = ${sourceId}) as sources,
      (select count(*)::int from public.schedule_audit where source_version_id = ${sourceId}) as audits,
      (select count(*)::int from pgmq.q_schedule_document_scan
        where message ->> 'source_version_id' = ${sourceId}) as jobs
  `;
  let objectCount = 0;
  if (storagePath) {
    const separator = storagePath.lastIndexOf("/");
    const folder = storagePath.slice(0, separator);
    const fileName = storagePath.slice(separator + 1);
    const listed = await storage.from(bucket).list(folder, { search: fileName, limit: 10 });
    if (listed.error) throw new Error("Fictitious schedule storage verification failed");
    objectCount = listed.data.filter((item) => item.name === fileName).length;
  }
  assert(
    counts.sources === 0 && counts.audits === 0 && counts.jobs === 0 && objectCount === 0,
    "Schedule integration test cleanup is incomplete"
  );
  return { ...counts, storage: objectCount };
}

try {
  const today = parisDay();
  const reservation = await depot({
    mode: "reserve",
    originalName,
    sizeBytes: bytes.length,
    schoolYear: schoolYearFor(today),
    title: `[TEST] Synchronisation EDT ${shortMarker}`,
    effectiveFrom: today,
    effectiveUntil: null,
    freshUntil: plusDays(today, 2),
    sourceKind: "classes",
    sourceFormat: "tabular_import",
    mimeType: "text/csv",
    checksum,
  });
  assert(reservation.ok === true && reservation.status === "reserved", "Reservation failed");
  assert(reservation.duplicate === false, "The fictitious schedule unexpectedly already exists");
  assert(reservation.upload?.bucket === bucket, "Unexpected schedule storage bucket");
  sourceId = reservation.importId;
  storagePath = reservation.upload.path;

  const signedUrl = new URL(reservation.upload.signedUrl);
  assert(signedUrl.protocol === "https:" && signedUrl.hostname === `${expectedProjectRef}.supabase.co`,
    "Signed upload URL does not match the preview project");
  const upload = await fetch(signedUrl, {
    method: "PUT",
    headers: { "content-type": "text/csv", "x-upsert": "false" },
    body: bytes,
  });
  assert(upload.ok, "Signed upload failed");

  const confirmed = await depot({ mode: "confirm", importId: sourceId });
  assert(confirmed.ok === true && confirmed.status === "quarantined", "Confirmation failed");
  await runWorker();

  const [state] = await sql`
    select status, checksum, validation_summary
    from public.schedule_source_versions
    where id = ${sourceId}
  `;
  assert(state?.status === "mapping_pending", "CSV did not reach human column mapping");
  assert(state.checksum === checksum, "Schedule checksum changed during processing");
  assert(state.validation_summary?.securityScan === "clean", "Antivirus result is missing");
  assert(state.validation_summary?.humanMapping === "pending", "Human mapping gate is missing");
  assert(state.validation_summary?.activation === "blocked", "Activation gate is missing");
  assert(state.validation_summary?.tabularRowCount === 1, "Fictitious row count is incorrect");
  assert(state.validation_summary?.tabularHeaders?.length === 6, "Fictitious headers are incomplete");

  const duplicate = await depot({
    mode: "reserve",
    originalName,
    sizeBytes: bytes.length,
    schoolYear: schoolYearFor(today),
    title: `[TEST] Synchronisation EDT ${shortMarker}`,
    effectiveFrom: today,
    effectiveUntil: null,
    freshUntil: plusDays(today, 2),
    sourceKind: "classes",
    sourceFormat: "tabular_import",
    mimeType: "text/csv",
    checksum,
  });
  assert(duplicate.duplicate === true && duplicate.importId === sourceId,
    "Schedule deduplication did not reuse the processed version");

  console.log(JSON.stringify({
    transport: "accepted",
    antivirus: "clean",
    parsing: "complete",
    status: state.status,
    humanMapping: "required",
    duplicateSuppressed: true,
  }));
} finally {
  await cleanOwnResources();
  const cleanup = await verifyCleanup();
  console.log(JSON.stringify({ cleanup }));
  await sql.end({ timeout: 5 });
}
