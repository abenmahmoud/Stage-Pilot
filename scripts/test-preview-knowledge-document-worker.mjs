import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import WebSocket from "ws";

const execFileAsync = promisify(execFile);
const confirmation = process.env.KNOWLEDGE_DOCUMENT_TEST_CONFIRM;
const expectedProjectRef = process.env.KNOWLEDGE_DOCUMENT_EXPECTED_PROJECT_REF;
const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const serviceName = process.env.KNOWLEDGE_DOCUMENT_WORKER_SERVICE
  ?? "lycee-knowledge-document-worker.service";

if (confirmation !== "preview-only") {
  throw new Error("Set KNOWLEDGE_DOCUMENT_TEST_CONFIRM=preview-only");
}
if (!expectedProjectRef || !/^[a-z]{20}$/.test(expectedProjectRef)) {
  throw new Error("KNOWLEDGE_DOCUMENT_EXPECTED_PROJECT_REF is required");
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
const bucket = "knowledge-ingest";
const runId = randomUUID();
const resources = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
      to_regclass('pgmq.q_knowledge_document_scan') is not null as queue_exists,
      (select count(*)::int from pgmq.q_knowledge_document_scan) as queued,
      (select count(*)::int from public.knowledge_documents
        where title like '[TEST] Worker document %') as stale_documents,
      has_table_privilege('anon', 'pgmq.q_knowledge_document_scan', 'select') as anon_select,
      has_table_privilege('authenticated', 'pgmq.q_knowledge_document_scan', 'select') as authenticated_select
  `;
  assert(state.queue_exists, "Knowledge document queue does not exist");
  assert(state.queued === 0, "Knowledge document queue is not empty before the test");
  assert(state.stale_documents === 0, "A stale knowledge document test exists");
  assert(!state.anon_select && !state.authenticated_select, "Client roles can read the private queue");
}

async function enqueueDocument({ institutionId, actorId, bytes, suffix }) {
  const documentId = randomUUID();
  const jobId = randomUUID();
  const path = `${institutionId}/worker-test/${runId}/${suffix}.txt`;
  const { error } = await storage.from(bucket).upload(path, bytes, {
    contentType: "text/plain",
    upsert: false,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  resources.push({ documentId, jobId, path });

  await sql.begin(async (transaction) => {
    await transaction`
      insert into public.knowledge_documents (
        id, institution_id, title, purpose_description, source_type,
        classification, owner_service_code, service_codes, valid_from,
        review_due_at, original_name, mime_type, size_bytes, storage_bucket,
        storage_path, status, uploaded_by, uploaded_at, analysis_summary
      ) values (
        ${documentId}, ${institutionId}, ${`[TEST] Worker document ${suffix}`},
        'Recette automatisée avec un document entièrement fictif sur la preview uniquement.',
        'procedure', 'internal', 'referent_numerique', array['referent_numerique']::text[],
        current_date, now() + interval '30 days', ${`${suffix}.txt`}, 'text/plain',
        ${bytes.length}, ${bucket}, ${path}, 'quarantined', ${actorId}, now(),
        'Contrôle antivirus en attente.'
      )
    `;
    await transaction`
      select pgmq.send(
        'knowledge_document_scan',
        jsonb_build_object(
          'job_id', ${jobId}::uuid,
          'job_type', 'scan_knowledge_document',
          'institution_id', ${institutionId}::uuid,
          'document_id', ${documentId}::uuid,
          'attempt', 0
        )
      )
    `;
  });
  return { documentId, path };
}

async function runWorker() {
  await execFileAsync("systemctl", ["start", serviceName], { timeout: 180_000 });
  const { stdout } = await execFileAsync(
    "systemctl",
    ["show", serviceName, "-p", "Result", "-p", "ExecMainStatus"],
    { timeout: 30_000 }
  );
  assert(/Result=success/.test(stdout), "Worker service result is not success");
  assert(/ExecMainStatus=0/.test(stdout), "Worker service exit code is not zero");
}

async function documentState(documentId) {
  const [state] = await sql`
    select status, checksum, analysis_summary, proposed_knowledge, analysis_error
    from public.knowledge_documents
    where id = ${documentId}
  `;
  return state;
}

async function cleanOwnResources() {
  for (const resource of resources) {
    await storage.from(bucket).remove([resource.path]);
    const queued = await sql`
      select msg_id
      from pgmq.q_knowledge_document_scan
      where message ->> 'job_id' = ${resource.jobId}
    `;
    for (const row of queued) {
      await sql`select pgmq.delete('knowledge_document_scan', ${row.msg_id}::bigint)`;
    }
    await sql`delete from public.agent_skill_audit where resource_id = ${resource.documentId}`;
    await sql`delete from public.knowledge_documents where id = ${resource.documentId}`;
  }
}

async function verifyCleanup() {
  if (resources.length === 0) return { documents: 0, audits: 0, jobs: 0 };
  const ids = resources.map((resource) => resource.documentId);
  const jobs = resources.map((resource) => resource.jobId);
  const [counts] = await sql`
    select
      (select count(*)::int from public.knowledge_documents
        where id = any(${ids}::uuid[])) as documents,
      (select count(*)::int from public.agent_skill_audit
        where resource_id = any(${ids}::uuid[])) as audits,
      (select count(*)::int from pgmq.q_knowledge_document_scan
        where message ->> 'job_id' = any(${jobs}::text[])) as jobs
  `;
  assert(counts.documents === 0 && counts.audits === 0 && counts.jobs === 0,
    "Integration test cleanup is incomplete");
  return counts;
}

try {
  await assertIsolatedQueue();
  const actor = await context();
  const safeText = "Procédure fictive : remettre le formulaire vierge avant le vendredi 4 septembre.";
  const clean = await enqueueDocument({
    institutionId: actor.institution_id,
    actorId: actor.user_id,
    bytes: Buffer.from(safeText, "utf8"),
    suffix: "clean",
  });
  await runWorker();
  const cleanState = await documentState(clean.documentId);
  assert(cleanState?.status === "review", "Clean document did not reach human review");
  assert(cleanState?.proposed_knowledge?.state === "extracted", "Safe text was not extracted");
  assert(cleanState?.proposed_knowledge?.extractedText === safeText,
    "The locally extracted text is incomplete");
  assert(cleanState?.checksum?.length === 64, "Document checksum is missing");

  const eicar = Buffer.from(
    "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
    "ascii"
  );
  const threat = await enqueueDocument({
    institutionId: actor.institution_id,
    actorId: actor.user_id,
    bytes: eicar,
    suffix: "eicar",
  });
  await runWorker();
  const threatState = await documentState(threat.documentId);
  assert(threatState?.status === "rejected", "EICAR document was not rejected");
  assert(threatState?.analysis_error?.includes("menace"), "Threat rejection reason is missing");

  console.log(JSON.stringify({
    clean: {
      status: cleanState.status,
      extractedLocally: true,
      awaitsHumanReview: true,
    },
    threat: { status: threatState.status, storageRemoved: true },
  }));
} finally {
  await cleanOwnResources();
  const cleanup = await verifyCleanup();
  console.log(JSON.stringify({ cleanup }));
  await sql.end({ timeout: 5 });
}
