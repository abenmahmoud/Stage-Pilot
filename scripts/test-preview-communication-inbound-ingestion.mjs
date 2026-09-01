import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema.ts";
import { createCommunicationInboundAttachmentIngestor }
  from "../api/_shared/communication-inbound-ingestion.ts";
import { createCommunicationBrevoAttachmentDownloader, createCommunicationInboundQuarantineStore }
  from "../api/_shared/communication-inbound-transfer.ts";
import { storeAndConfirmCommunicationInboundObject }
  from "../api/_shared/communication-inbound-object-persistence.ts";

const PROJECT_REF = "xijocumlwivhbmffrnlj";
assert.ok(process.argv.includes("--preview-only"));
let target;
try { target = new URL(process.env.DATABASE_URL ?? "invalid"); }
catch { throw new Error("preview_database_configuration_missing"); }
assert.ok(["postgres:", "postgresql:"].includes(target.protocol));
assert.ok(target.hostname === `db.${PROJECT_REF}.supabase.co`
  || (target.hostname.endsWith(".pooler.supabase.com")
    && decodeURIComponent(target.username) === `postgres.${PROJECT_REF}`), "Unexpected preview database target");
const client = postgres(target.href, { prepare: false, max: 1, connect_timeout: 10, idle_timeout: 5 });
const database = drizzle(client, { schema });
const { institutions, communicationInbound, communicationInboundObjects, communicationInboundObjectEvents } = schema;
const institutionId = randomUUID();
const otherInstitutionId = randomUUID();
const inboundId = randomUUID();
const fixtureBytes = new TextEncoder().encode("%PDF-1.7\nFictional ingestion recipe\n%%EOF");
const referenceSecret = "synthetic-ingestion-recipe-secret-" + "x".repeat(32);
const fixtureApiKey = "synthetic-brevo-recipe-" + "x".repeat(32);
const fixtureStorageKey = "synthetic-storage-recipe-" + "x".repeat(32);
const rollback = new Error("rollback_preview_ingestion_recipe");
const objects = new Map();
let writes = 0;
let scans = 0;
const download = createCommunicationBrevoAttachmentDownloader({ apiKey: fixtureApiKey, fetchImpl: async (url) => {
  assert.equal(url, "https://api.brevo.com/v3/inbound/attachments/synthetic-recipe-token");
  return new Response(fixtureBytes, { headers: { "content-type": "application/pdf" } });
} });
const store = createCommunicationInboundQuarantineStore({
  supabaseUrl: "https://fictional-ingestion.supabase.co", serviceRoleKey: fixtureStorageKey,
  fetchImpl: async (url, init) => {
    assert.ok(url.startsWith(`https://fictional-ingestion.supabase.co/storage/v1/object/communication-inbound-quarantine/institutions/${institutionId}/inbound/${inboundId}/objects/`));
    if (init.method === "POST") {
      if (objects.has(url)) return new Response(null, { status: 400 });
      objects.set(url, new Uint8Array(await init.body.arrayBuffer()));
      writes += 1;
      return new Response(null, { status: 201 });
    }
    assert.equal(init.method, "GET");
    return new Response(objects.get(url), { headers: { "content-type": "application/pdf" } });
  },
});
let rolledBack = false;
try {
  try {
    await database.transaction(async (root) => {
      await root.execute(sql`set local statement_timeout = '15s'`);
      await root.insert(institutions).values([
        { id: institutionId, slug: `ingestion-${institutionId}`, name: "Fictional Ingestion A", status: "draft" },
        { id: otherInstitutionId, slug: `ingestion-${otherInstitutionId}`, name: "Fictional Ingestion B", status: "draft" },
      ]);
      await root.insert(communicationInbound).values({ id: inboundId, institutionId,
        provider: "brevo_inbound", externalMessageHash: "d".repeat(64), status: "received" });
      let failAfterQueue = true;
      const transaction = (work) => root.transaction(async (tx) => {
        const result = await work(tx);
        if (failAfterQueue && result?.accepted && result.status === "quarantine") {
          failAfterQueue = false;
          throw new Error("synthetic_failure_after_queue");
        }
        return result;
      });
      const ingest = createCommunicationInboundAttachmentIngestor({ transaction, download, store, referenceSecret });
      const input = { institutionId, inboundId, attachmentIndex: 0,
        downloadToken: "synthetic-recipe-token", mediaType: "application/pdf", estimatedBytes: 1 };
      await assert.rejects(ingest(input), (error) => error.code === "persistence_failed");
      const [reserved] = await root.select().from(communicationInboundObjects)
        .where(eq(communicationInboundObjects.inboundId, inboundId));
      assert.equal(reserved.status, "reserved");
      assert.equal(reserved.sha256, null);
      assert.equal(writes, 1);
      const pending = await root.execute(sql`select count(*)::integer as total from pgmq.q_communication_inbound_scan
        where message ->> 'institution_id' = ${institutionId}`);
      assert.equal(pending[0].total, 0);
      const first = await ingest(input);
      assert.equal(first.objectId, reserved.id);
      assert.equal(first.status, "quarantine");
      assert.equal(writes, 1);
      assert.deepEqual(await ingest(input), { ...first, duplicate: true });
      const [confirmed] = await root.select().from(communicationInboundObjects)
        .where(eq(communicationInboundObjects.id, first.objectId));
      const confirmation = { institutionId, inboundId, objectId: first.objectId,
        mediaType: confirmed.mediaType, sizeBytes: confirmed.sizeBytes, sha256: confirmed.sha256 };
      await assert.rejects(root.transaction((tx) => storeAndConfirmCommunicationInboundObject({ tx,
        confirmation: { ...confirmation, institutionId: otherInstitutionId },
        store: async () => assert.fail("Cross-institution storage must not run"),
      })), /communication_inbound_object_quarantine_conflict/);
      await assert.rejects(root.transaction((tx) => storeAndConfirmCommunicationInboundObject({ tx,
        confirmation: { ...confirmation, sha256: "f".repeat(64) },
        store: async () => assert.fail("Conflicting storage must not run"),
      })), /communication_inbound_object_quarantine_conflict/);
      await root.update(communicationInboundObjects).set({ status: "clean",
        storageBucket: "communication-inbound-clean", scanDetail: "clamav_clean", scannedAt: new Date() })
        .where(and(eq(communicationInboundObjects.id, first.objectId), eq(communicationInboundObjects.institutionId, institutionId)));
      assert.deepEqual(await ingest(input), { ...first, status: "clean", duplicate: true });
      await root.update(communicationInboundObjects).set({ status: "purged" })
        .where(eq(communicationInboundObjects.id, first.objectId));
      await assert.rejects(ingest(input), (error) => error.code === "object_retired");
      assert.equal(writes, 1);
      const jobs = await root.execute(sql`select message from pgmq.q_communication_inbound_scan
        where message ->> 'institution_id' = ${institutionId}`);
      scans = jobs.length;
      assert.equal(scans, 1);
      assert.deepEqual(jobs[0].message, { schema: 1, job_type: "scan_communication_inbound_object",
        institution_id: institutionId, inbound_id: inboundId, object_id: first.objectId });
      const events = await root.select().from(communicationInboundObjectEvents)
        .where(eq(communicationInboundObjectEvents.institutionId, institutionId));
      assert.equal(events.length, 2);
      assert.doesNotMatch(JSON.stringify(events), /synthetic-recipe-token|%PDF|fictional-ingestion/);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
    rolledBack = true;
  }
  assert.equal(rolledBack, true);
  const residues = {};
  for (const [name, table, column] of [
    ["institutions", institutions, institutions.id],
    ["inbound", communicationInbound, communicationInbound.institutionId],
    ["objects", communicationInboundObjects, communicationInboundObjects.institutionId],
    ["events", communicationInboundObjectEvents, communicationInboundObjectEvents.institutionId],
  ]) {
    const [{ total }] = await database.select({ total: count() }).from(table)
      .where(inArray(column, [institutionId, otherInstitutionId]));
    residues[name] = total;
    assert.equal(total, 0);
  }
  const jobs = await database.execute(sql`select count(*)::integer as total from pgmq.q_communication_inbound_scan
    where message ->> 'institution_id' = ${institutionId}`);
  residues.queue = jobs[0].total;
  assert.equal(residues.queue, 0);
  console.log(JSON.stringify({ previewProject: PROJECT_REF, rollback: rolledBack, syntheticWrites: writes,
    scansBeforeRollback: scans, residues, realProviderCalls: 0, antivirusExecuted: false }));
} finally {
  for (const bytes of objects.values()) bytes.fill(0);
  objects.clear();
  await client.end({ timeout: 5 });
}
