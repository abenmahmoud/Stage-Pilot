import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import WebSocket from "ws";

const execFileAsync = promisify(execFile);
const confirmation = process.env.IDENTITY_DIRECTORY_TEST_CONFIRM;
const expectedProjectRef = process.env.IDENTITY_DIRECTORY_EXPECTED_PROJECT_REF;
const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (confirmation !== "preview-only") {
  throw new Error("Set IDENTITY_DIRECTORY_TEST_CONFIRM=preview-only");
}
if (!expectedProjectRef || !/^[a-z]{20}$/.test(expectedProjectRef)) {
  throw new Error("IDENTITY_DIRECTORY_EXPECTED_PROJECT_REF is required");
}
if (!databaseUrl || !databaseUrl.includes(expectedProjectRef)) {
  throw new Error("DATABASE_URL does not match the expected preview project");
}
if (!supabaseUrl || new URL(supabaseUrl).hostname !== `${expectedProjectRef}.supabase.co`) {
  throw new Error("SUPABASE_URL does not match the expected preview project");
}
if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");

const sql = postgres(databaseUrl, { prepare: false, max: 2, idle_timeout: 20 });
const storage = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket },
}).storage;
const defaultWorkerPath = fileURLToPath(
  new URL("../workers/identity-directory-worker.mjs", import.meta.url)
);
const workerPath = process.env.IDENTITY_DIRECTORY_WORKER_PATH ?? defaultWorkerPath;
const defaultVaultPath = fileURLToPath(
  new URL("../workers/identity-directory-vault.mjs", import.meta.url)
);
const vaultPath = process.env.IDENTITY_DIRECTORY_VAULT_PATH ?? defaultVaultPath;
const {
  decryptIdentityVaultPayload,
  identityVaultConfig,
} = await import(pathToFileURL(vaultPath).href);
const vaultConfig = identityVaultConfig();
const bucket = "identity-ingest";
const runId = randomUUID();
const marker = runId.slice(0, 8);
const resources = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fictitiousCsv() {
  const header = [
    "record_type",
    "person_ref",
    "person_type",
    "first_name",
    "last_name",
    "academic_email",
    "personal_email",
    "phone",
    "class_ref",
    "service_code",
    "active_from",
    "active_until",
    "subject_person_ref",
    "relationship_type",
    "object_ref",
    "valid_from",
    "valid_until",
  ];
  const studentRef = `TEST-STUDENT-${marker}`;
  const guardianRef = `TEST-GUARDIAN-${marker}`;
  const staffRef = `TEST-STAFF-${marker}`;
  const rows = [
    [
      "person",
      studentRef,
      "student",
      "CamilleTest",
      "MartinTest",
      `camille.${marker}@example.test`,
      "",
      "+33600000001",
      "TEST-2GT1",
      "",
      "2026-09-01",
      "2027-08-31",
      "",
      "",
      "",
      "",
      "",
    ],
    [
      "person",
      guardianRef,
      "guardian",
      "NoraTest",
      "MartinTest",
      "",
      `nora.${marker}@example.test`,
      "+33600000002",
      "",
      "",
      "2026-09-01",
      "2027-08-31",
      "",
      "",
      "",
      "",
      "",
    ],
    [
      "person",
      staffRef,
      "staff",
      "AlexTest",
      "DurandTest",
      `alex.${marker}@example.test`,
      "",
      "+33600000003",
      "",
      "referent_numerique",
      "2026-09-01",
      "2027-08-31",
      "",
      "",
      "",
      "",
      "",
    ],
    [
      "relationship",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      guardianRef,
      "guardian_of",
      studentRef,
      "2026-09-01",
      "2027-08-31",
    ],
  ];
  return Buffer.from(
    [header, ...rows].map((row) => row.map((value) => `"${value}"`).join(",")).join("\n"),
    "utf8"
  );
}

async function context() {
  const [row] = await sql`
    select i.id as institution_id, m.user_id
    from public.institutions i
    join public.institution_memberships m on m.institution_id = i.id
    where i.slug = 'blaise-cendrars-sevran'
      and m.status = 'active'
      and m.role = 'admin'
    order by m.created_at
    limit 1
  `;
  if (!row) throw new Error("No active preview administrator found");
  return row;
}

async function assertIsolatedQueue() {
  const [state] = await sql`
    select
      (select count(*)::int from pgmq.q_identity_directory_scan) as queued,
      (select count(*)::int from public.identity_directory_imports
        where title like '[TEST] Worker %') as stale_imports,
      (select count(*)::int from public.identity_directory_private_rows private_row
        join public.identity_directory_imports directory_import on directory_import.id = private_row.import_id
        where directory_import.title like '[TEST] Worker %') as stale_private_rows
  `;
  assert(state.queued === 0, "Identity scan queue is not empty before the test");
  assert(state.stale_imports === 0, "A stale identity worker test import exists");
  assert(state.stale_private_rows === 0, "A stale encrypted identity test row exists");
}

async function enqueueImport({ institutionId, actorId, bytes, suffix }) {
  const importId = randomUUID();
  const jobId = randomUUID();
  const path = `${institutionId}/worker-test/${runId}/${suffix}.csv`;
  const { error } = await storage.from(bucket).upload(path, bytes, {
    contentType: "text/csv",
    upsert: false,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  resources.push({ importId, jobId, path });

  await sql.begin(async (transaction) => {
    await transaction`
      insert into public.identity_directory_imports (
        id, institution_id, title, purpose_description, source_type,
        original_name, mime_type, size_bytes, storage_bucket, storage_path,
        status, uploaded_by, uploaded_at, validation_summary
      ) values (
        ${importId}, ${institutionId}, ${`[TEST] Worker ${suffix}`},
        'Recette automatisée avec données entièrement fictives sur la preview uniquement.',
        'csv', ${`${suffix}.csv`}, 'text/csv', ${bytes.length}, ${bucket}, ${path},
        'quarantined', ${actorId}, now(), ${transaction.json({ antivirus: "pending" })}
      )
    `;
    await transaction`
      select pgmq.send(
        'identity_directory_scan',
        jsonb_build_object(
          'job_id', ${jobId}::uuid,
          'job_type', 'scan_identity_directory',
          'institution_id', ${institutionId}::uuid,
          'import_id', ${importId}::uuid,
          'attempt', 0
        )
      )
    `;
  });
  return { importId, path };
}

async function runWorker() {
  const { stdout } = await execFileAsync(process.execPath, [workerPath], {
    cwd: dirname(workerPath),
    env: process.env,
    timeout: 180_000,
  });
  const outcome = JSON.parse(stdout.trim());
  assert(outcome.claimed === 1, "Worker did not claim exactly one test job");
  return outcome.outcomes[0];
}

async function importState(importId) {
  const [state] = await sql`
    select status, row_count, valid_row_count, rejected_row_count, validation_summary
    from public.identity_directory_imports
    where id = ${importId}
  `;
  return state;
}

async function cleanOwnResources() {
  for (const resource of resources) {
    await storage.from(bucket).remove([resource.path]);
    const queued = await sql`
      select msg_id
      from pgmq.q_identity_directory_scan
      where message ->> 'job_id' = ${resource.jobId}
    `;
    for (const row of queued) {
      await sql`select pgmq.delete('identity_directory_scan', ${row.msg_id}::bigint)`;
    }
    await sql`delete from public.identity_directory_audit where resource_id = ${resource.importId}`;
    await sql`delete from public.identity_directory_imports where id = ${resource.importId}`;
  }
}

async function verifyCleanup() {
  if (resources.length === 0) {
    return { imports: 0, rows: 0, private_rows: 0, audits: 0, jobs: 0 };
  }
  const ids = resources.map((resource) => resource.importId);
  const jobs = resources.map((resource) => resource.jobId);
  const [counts] = await sql`
    select
      (select count(*)::int from public.identity_directory_imports
        where id = any(${ids}::uuid[])) as imports,
      (select count(*)::int from public.identity_directory_rows
        where import_id = any(${ids}::uuid[])) as rows,
      (select count(*)::int from public.identity_directory_private_rows
        where import_id = any(${ids}::uuid[])) as private_rows,
      (select count(*)::int from public.identity_directory_audit
        where resource_id = any(${ids}::uuid[])) as audits,
      (select count(*)::int from pgmq.q_identity_directory_scan
        where message ->> 'job_id' = any(${jobs}::text[])) as jobs
  `;
  assert(
    counts.imports === 0 && counts.rows === 0 && counts.private_rows === 0
      && counts.audits === 0 && counts.jobs === 0,
    "Integration test cleanup is incomplete");
  return counts;
}

try {
  await assertIsolatedQueue();
  const actor = await context();
  const clean = await enqueueImport({
    institutionId: actor.institution_id,
    actorId: actor.user_id,
    bytes: fictitiousCsv(),
    suffix: "clean",
  });
  const cleanOutcome = await runWorker();
  const cleanState = await importState(clean.importId);
  assert(cleanOutcome === "review", "Clean file did not reach review");
  assert(cleanState?.status === "review", "Clean import status is not review");
  assert(cleanState?.row_count === 4, "Clean import row count is incorrect");
  assert(cleanState?.validation_summary?.antivirus === "clamav_clean", "Antivirus proof is missing");

  const storedRows = await sql`
    select to_jsonb(identity_directory_rows.*) as payload
    from public.identity_directory_rows
    where import_id = ${clean.importId}
    order by row_number
  `;
  const serialized = JSON.stringify(storedRows);
  for (const forbidden of [
    "CamilleTest",
    "NoraTest",
    "AlexTest",
    "MartinTest",
    "DurandTest",
    "@example.test",
    "+33600000001",
  ]) {
    assert(!serialized.includes(forbidden), `Raw identity value retained: ${forbidden}`);
  }

  const privateRows = await sql`
    select person_ref, key_version, payload_schema, iv, auth_tag, ciphertext
    from public.identity_directory_private_rows
    where import_id = ${clean.importId}
    order by person_ref
  `;
  assert(privateRows.length === 3, "Encrypted identity row count is incorrect");
  const privateSerialized = JSON.stringify(privateRows);
  for (const forbidden of [
    "CamilleTest",
    "NoraTest",
    "AlexTest",
    "MartinTest",
    "DurandTest",
    "@example.test",
    "+33600000001",
  ]) {
    assert(!privateSerialized.includes(forbidden), `Raw value leaked into encrypted rows: ${forbidden}`);
  }
  const camille = privateRows.find((row) => row.person_ref === `TEST-STUDENT-${marker}`);
  assert(camille, "Encrypted fictitious student is missing");
  const decrypted = decryptIdentityVaultPayload({
    envelope: {
      keyVersion: camille.key_version,
      payloadSchema: camille.payload_schema,
      iv: camille.iv,
      authTag: camille.auth_tag,
      ciphertext: camille.ciphertext,
    },
    institutionId: actor.institution_id,
    importId: clean.importId,
    personRef: camille.person_ref,
    key: vaultConfig.key,
  });
  assert(decrypted.firstName === "CamilleTest", "Encrypted first name did not round-trip");
  assert(decrypted.academicEmail === `camille.${marker}@example.test`, "Encrypted email did not round-trip");

  const eicar = Buffer.from(
    "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
    "ascii"
  );
  const threat = await enqueueImport({
    institutionId: actor.institution_id,
    actorId: actor.user_id,
    bytes: eicar,
    suffix: "eicar",
  });
  const threatOutcome = await runWorker();
  const threatState = await importState(threat.importId);
  assert(threatOutcome === "blocked", "EICAR file was not blocked");
  assert(threatState?.status === "rejected", "Threat import was not rejected");
  assert(
    threatState?.validation_summary?.reason === "antivirus_detected_threat",
    "Threat rejection reason is missing"
  );

  console.log(JSON.stringify({
    clean: {
      outcome: cleanOutcome,
      status: cleanState.status,
      rows: cleanState.row_count,
      rawIdentityRetained: false,
      encryptedPeople: privateRows.length,
      decryptRoundTrip: true,
    },
    threat: { outcome: threatOutcome, status: threatState.status },
  }));
} finally {
  await cleanOwnResources();
  const cleanup = await verifyCleanup();
  console.log(JSON.stringify({ cleanup }));
  await sql.end({ timeout: 5 });
}
