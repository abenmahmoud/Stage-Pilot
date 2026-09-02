import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, count, eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import * as schema from "../db/schema.ts";
import {
  createCommunicationInboundAttachmentIngestor,
  CommunicationInboundIngestionError,
} from "../api/_shared/communication-inbound-ingestion.ts";
import {
  createCommunicationBrevoAttachmentDownloader,
  createCommunicationInboundQuarantineStore,
} from "../api/_shared/communication-inbound-transfer.ts";

const DATABASE_URL = process.env.LYCEEGEST_LOCAL_DATABASE_URL;
const LOCAL_SUPABASE_URL = process.env.LYCEEGEST_LOCAL_SUPABASE_URL;
const LOCAL_SUPABASE_SERVER_KEY = process.env.LYCEEGEST_LOCAL_SUPABASE_SERVER_KEY;
const STORAGE_ORIGIN = "https://local-lyceegest.supabase.co";
const INSTITUTION_ID = "00000000-0000-4000-8000-000000009401";
const INBOUND_ID = "00000000-0000-4000-8000-000000009410";
const REFERENCE_SECRET = "synthetic-local-ingestion-reference-" + "x".repeat(32);
const FIXTURE_API_KEY = "synthetic-local-brevo-key-" + "x".repeat(32);
const FIXTURE_TOKEN = "synthetic-local-ingestion-token";
const CONFLICT_TOKEN = "synthetic-local-conflict-token";
const FIXTURE_BYTES = new TextEncoder().encode("%PDF-1.7\nFictional local ingestion A\n%%EOF");
const CONFLICT_BYTES = new TextEncoder().encode("%PDF-1.7\nFictional local ingestion B\n%%EOF");

if (!process.argv.includes("--local-stack-only")) {
  throw new Error("local_stack_confirmation_required");
}

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
const client = postgres(dbUrl, {
  prepare: false,
  max: 3,
  connect_timeout: 10,
  idle_timeout: 20,
  onnotice: () => {},
});
const database = drizzle(client, { schema });
const storageAdmin = createClient(localOrigin, localServerSecret, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const {
  institutions,
  communicationInbound,
  communicationInboundObjects,
  communicationInboundObjectEvents,
} = schema;
const storagePaths = new Set();
let storagePosts = 0;
let providerCalls = 0;

function createMappedFetch() {
  return async (url, init) => {
    assert.equal(typeof url, "string");
    assert.ok(url.startsWith(`${STORAGE_ORIGIN}/storage/v1/`));
    if (init?.method === "POST") storagePosts += 1;
    const response = await fetch(localOrigin + url.slice(STORAGE_ORIGIN.length), init);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

const download = createCommunicationBrevoAttachmentDownloader({
  apiKey: FIXTURE_API_KEY,
  fetchImpl: async (url) => {
    providerCalls += 1;
    const token = url.endsWith(`/${FIXTURE_TOKEN}`)
      ? FIXTURE_TOKEN
      : url.endsWith(`/${CONFLICT_TOKEN}`) ? CONFLICT_TOKEN : null;
    assert.ok(token);
    const bytes = token === FIXTURE_TOKEN ? FIXTURE_BYTES : CONFLICT_BYTES;
    return new Response(bytes, { headers: { "content-type": "application/pdf" } });
  },
});
const store = createCommunicationInboundQuarantineStore({
  supabaseUrl: STORAGE_ORIGIN,
  serviceRoleKey: localServerSecret,
  fetchImpl: createMappedFetch(),
  timeoutMs: 20_000,
});

function input(downloadToken = FIXTURE_TOKEN) {
  return {
    institutionId: INSTITUTION_ID,
    inboundId: INBOUND_ID,
    attachmentIndex: 0,
    downloadToken,
    mediaType: "application/pdf",
    estimatedBytes: 1,
  };
}

async function targetedCounts() {
  const [row] = await client`select
    (select count(*)::integer from public.institutions
      where id = ${INSTITUTION_ID}::uuid) as institutions,
    (select count(*)::integer from public.communication_inbound
      where institution_id = ${INSTITUTION_ID}::uuid) as inbound,
    (select count(*)::integer from public.communication_inbound_objects
      where institution_id = ${INSTITUTION_ID}::uuid) as objects,
    (select count(*)::integer from public.communication_inbound_object_events
      where institution_id = ${INSTITUTION_ID}::uuid) as events,
    (select count(*)::integer from pgmq.q_communication_inbound_scan
      where message ->> 'institution_id' = ${INSTITUTION_ID}) as active,
    (select count(*)::integer from pgmq.a_communication_inbound_scan
      where message ->> 'institution_id' = ${INSTITUTION_ID}) as archived,
    (select count(*)::integer from supabase_migrations.schema_migrations) as migrations`;
  return row;
}

async function cleanupStorage() {
  if (!storagePaths.size) return;
  const { error } = await storageAdmin.storage
    .from("communication-inbound-quarantine")
    .remove([...storagePaths]);
  if (error) throw new Error("local_storage_cleanup_failed");
}

async function cleanupDatabase() {
  await client.begin(async (tx) => {
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

let result;
let runError;
try {
  const before = await targetedCounts();
  assert.deepEqual({ ...before, migrations: undefined }, {
    institutions: 0,
    inbound: 0,
    objects: 0,
    events: 0,
    active: 0,
    archived: 0,
    migrations: undefined,
  }, "local_fixture_scope_must_be_empty");
  assert.equal(before.migrations, 93, "local_migration_count_mismatch");
  assert.equal(FIXTURE_BYTES.byteLength, CONFLICT_BYTES.byteLength);

  await database.insert(institutions).values({
    id: INSTITUTION_ID,
    slug: "local-inbound-ingestion-recipe",
    name: "Local fictional inbound ingestion recipe",
    status: "draft",
  });
  await database.insert(communicationInbound).values({
    id: INBOUND_ID,
    institutionId: INSTITUTION_ID,
    provider: "brevo_inbound",
    externalMessageHash: createHash("sha256").update("local-ingestion-inbound").digest("hex"),
    status: "received",
  });

  let interruptConfirmation = true;
  const transaction = (work) => database.transaction(async (tx) => {
    const receipt = await work(tx);
    if (interruptConfirmation && receipt?.accepted && receipt.status === "quarantine") {
      interruptConfirmation = false;
      throw new Error("synthetic_confirmation_interruption");
    }
    return receipt;
  });
  const ingest = createCommunicationInboundAttachmentIngestor({
    transaction,
    download,
    store,
    referenceSecret: REFERENCE_SECRET,
    concurrency: 1,
  });

  await assert.rejects(ingest(input()), (error) => {
    assert.ok(error instanceof CommunicationInboundIngestionError);
    assert.equal(error.code, "persistence_failed");
    return true;
  });
  const [reserved] = await database.select().from(communicationInboundObjects)
    .where(and(
      eq(communicationInboundObjects.institutionId, INSTITUTION_ID),
      eq(communicationInboundObjects.inboundId, INBOUND_ID),
    ));
  assert.equal(reserved.status, "reserved");
  assert.equal(reserved.sha256, null);
  storagePaths.add(reserved.storagePath);
  const [{ eventCountAfterInterruption }] = await database.select({
    eventCountAfterInterruption: count(),
  }).from(communicationInboundObjectEvents)
    .where(eq(communicationInboundObjectEvents.inboundObjectId, reserved.id));
  assert.equal(eventCountAfterInterruption, 1);
  const [queueAfterInterruption] = await client`select count(*)::integer as total
    from pgmq.q_communication_inbound_scan
    where message ->> 'institution_id' = ${INSTITUTION_ID}`;
  assert.equal(queueAfterInterruption.total, 0);
  const { data: storedAfterInterruption, error: storedReadError } = await storageAdmin.storage
    .from("communication-inbound-quarantine")
    .download(reserved.storagePath);
  assert.equal(storedReadError, null);
  assert.deepEqual(new Uint8Array(await storedAfterInterruption.arrayBuffer()), FIXTURE_BYTES);

  const recovered = await ingest(input());
  assert.equal(recovered.objectId, reserved.id);
  assert.equal(recovered.status, "quarantine");
  assert.equal(recovered.duplicate, false);
  assert.deepEqual(await ingest(input()), { ...recovered, duplicate: true });
  await assert.rejects(ingest(input(CONFLICT_TOKEN)), (error) => {
    assert.ok(error instanceof CommunicationInboundIngestionError);
    assert.equal(error.code, "reservation_conflict");
    return true;
  });

  const [confirmed] = await database.select().from(communicationInboundObjects)
    .where(eq(communicationInboundObjects.id, recovered.objectId));
  assert.equal(confirmed.status, "quarantine");
  assert.equal(confirmed.sha256, createHash("sha256").update(FIXTURE_BYTES).digest("hex"));
  const events = await database.select().from(communicationInboundObjectEvents)
    .where(eq(communicationInboundObjectEvents.inboundObjectId, recovered.objectId));
  assert.deepEqual(events.map((event) => event.eventType), ["object.reserved", "object.quarantined"]);
  const jobs = await client`select message from pgmq.q_communication_inbound_scan
    where message ->> 'institution_id' = ${INSTITUTION_ID}`;
  assert.equal(jobs.length, 1);
  assert.deepEqual(jobs[0].message, {
    schema: 1,
    job_type: "scan_communication_inbound_object",
    institution_id: INSTITUTION_ID,
    inbound_id: INBOUND_ID,
    object_id: recovered.objectId,
  });
  assert.equal(storagePosts, 2);
  assert.equal(providerCalls, 4);
  assert.doesNotMatch(JSON.stringify(events), /synthetic-local-ingestion-token|%PDF|Fictional local/u);

  result = {
    migrations: before.migrations,
    database: "local-postgresql",
    storage: "local-private",
    reservationRows: 1,
    interruptionRecovered: 1,
    duplicateReplays: 1,
    conflictsRefused: 1,
    queueJobs: 1,
    providerCalls,
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
    const after = await targetedCounts();
    assert.deepEqual({
      institutions: after.institutions,
      inbound: after.inbound,
      objects: after.objects,
      events: after.events,
      active: after.active,
      archived: after.archived,
    }, { institutions: 0, inbound: 0, objects: 0, events: 0, active: 0, archived: 0 });
    for (const path of storagePaths) {
      const { data, error } = await storageAdmin.storage
        .from("communication-inbound-quarantine")
        .download(path);
      assert.equal(data, null);
      assert.ok(error);
    }
    console.log(JSON.stringify({ ...result, databaseResidues: 0, storageResidues: 0 }));
  }
} finally {
  await client.end({ timeout: 5 }).catch((error) => { runError ??= error; });
}
if (runError) throw runError;
