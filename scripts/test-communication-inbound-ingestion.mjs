import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import test from "node:test";
import { createCommunicationInboundAttachmentIngestor, CommunicationInboundIngestionError }
  from "../api/_shared/communication-inbound-ingestion.ts";
import { confirmCommunicationInboundObjectQuarantine }
  from "../api/_shared/communication-inbound-object-persistence.ts";

const scope = { institutionId: "00000000-0000-4000-8000-000000009401",
  inboundId: "00000000-0000-4000-8000-000000009410" };
const input = { ...scope, attachmentIndex: 0, downloadToken: "synthetic-not-persisted-token",
  estimatedBytes: 1, mediaType: "application/pdf" };
const fixtureBytes = new TextEncoder().encode("%PDF-1.7\nSynthetic attachment\n%%EOF");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sha256 = digest(fixtureBytes);
const referenceSecret = "synthetic-ingestion-secret-" + "x".repeat(32);
const dialect = new PgDialect();
const rejectsCode = (pending, code) => assert.rejects(pending, (error) => {
  assert.ok(error instanceof CommunicationInboundIngestionError);
  assert.equal(error.code, code);
  assert.equal(error.message, code);
  assert.equal(error.cause, undefined);
  return true;
});

// Transaction stub checks call ordering/rollback. The isolated DB recipe proves SQL behavior.
function harness() {
  const h = { state: { objects: [], events: [], queue: [] }, calls: [], buffers: [], stores: 0,
    parentExists: true, failQueue: false, loseCommit: false, locked: false, stored: null, hideExistingOnce: false };
  h.transaction = async (work) => {
    const before = structuredClone(h.state);
    h.calls.push("begin");
    const checkWhere = (where, needsObject = false) => {
      const query = dialect.sqlToQuery(where);
      assert.ok(query.params.includes(scope.institutionId));
      assert.ok(query.params.includes(scope.inboundId));
      if (needsObject) assert.ok(query.params.includes(h.state.objects[0].id));
    };
    const tx = {
      select() {
        let table;
        const builder = {
          from(value) { table = getTableName(value); return builder; },
          where(value) { checkWhere(value); return builder; },
          limit() { return builder; },
          for(lock) { assert.equal(lock, "update"); h.locked = true; h.calls.push("lock"); return builder; },
          then(resolve, reject) {
            let rows = table === "communication_inbound"
              ? (h.parentExists ? [{ id: scope.inboundId }] : []) : h.state.objects;
            if (table === "communication_inbound_objects" && h.hideExistingOnce) {
              h.hideExistingOnce = false;
              rows = [];
            }
            return Promise.resolve(structuredClone(rows)).then(resolve, reject);
          },
        };
        return builder;
      },
      insert(table) {
        const name = getTableName(table);
        return { values(value) {
          h.calls.push(name === "communication_inbound_objects" ? "reserve" : value.eventType);
          if (name === "communication_inbound_objects") {
            if (h.state.objects.some((row) => row.objectRefHash === value.objectRefHash)) {
              return { onConflictDoNothing: () => ({ returning: async () => [] }) };
            }
            h.state.objects.push({ sha256: null, ...structuredClone(value) });
            return { onConflictDoNothing: () => ({ returning: async () => [structuredClone(value)] }) };
          }
          h.state.events.push(structuredClone(value));
          return Promise.resolve();
        } };
      },
      update() {
        return { set(value) { return { where(where) {
          checkWhere(where, true);
          assert.ok(dialect.sqlToQuery(where).params.includes("reserved"));
          if (h.state.objects[0].status !== "reserved") return { returning: async () => [] };
          Object.assign(h.state.objects[0], value);
          return { returning: async () => [{ id: h.state.objects[0].id }] };
        } }; } };
      },
      async execute(query) {
        const compiled = dialect.sqlToQuery(query);
        if (compiled.sql === "set local lock_timeout = '5s'") return [];
        assert.match(compiled.sql, /pgmq.send/);
        assert.deepEqual(compiled.params, [scope.institutionId, scope.inboundId, h.state.objects[0].id]);
        h.state.queue.push(compiled.params);
        h.calls.push("queue");
        if (h.failQueue) { h.failQueue = false; throw new Error("private-database-prose"); }
      },
    };
    let result;
    try { result = await work(tx); }
    catch (error) { h.state = before; h.calls.push("rollback"); throw error; }
    finally { h.locked = false; }
    h.calls.push("commit");
    if (h.loseCommit && h.state.queue.length) { h.loseCommit = false; throw new Error("private-commit-prose"); }
    return result;
  };
  h.download = async () => {
    h.calls.push("download");
    const bytes = Uint8Array.from(fixtureBytes);
    h.buffers.push(bytes);
    return { bytes, mediaType: input.mediaType, sizeBytes: bytes.length, sha256 };
  };
  h.store = async ({ confirmation, bytes }) => {
    assert.equal(h.locked, true);
    assert.equal(h.state.objects.length, 1);
    assert.ok(h.calls.indexOf("commit", h.calls.indexOf("reserve")) >= 0);
    assert.equal(digest(bytes), confirmation.sha256);
    h.stores += 1;
    h.stored ??= Uint8Array.from(bytes);
    assert.deepEqual(h.stored, bytes);
    return confirmation;
  };
  h.create = (overrides = {}) => createCommunicationInboundAttachmentIngestor({
    transaction: h.transaction, download: h.download, store: h.store, referenceSecret, ...overrides,
  });
  return h;
}

test("commits the measured reservation before storage and atomically queues a single scan", async () => {
  const h = harness();
  const receipt = await h.create()(input);
  assert.deepEqual(Object.keys(receipt).sort(), ["accepted", "duplicate", "objectId", "status"]);
  assert.equal(receipt.status, "quarantine");
  assert.equal(receipt.duplicate, false);
  assert.equal(h.state.objects[0].sizeBytes, fixtureBytes.length);
  assert.equal(h.state.queue.length, 1);
  assert.deepEqual(h.state.events.map((event) => event.eventType), ["object.reserved", "object.quarantined"]);
  assert.ok(h.buffers.every((bytes) => bytes.every((byte) => byte === 0)));
  assert.doesNotMatch(JSON.stringify(h.state), /synthetic-not-persisted-token|%PDF|private-prose/);
});

test("rejects malformed inputs before database and rejects a missing scope before download", async () => {
  const h = harness();
  const ingest = h.create();
  for (const bad of [null, [], {}, { ...input, subject: "forbidden" }, { ...input, institutionId: "invalid" },
    { ...input, attachmentIndex: 20 }, { ...input, estimatedBytes: -1 }, { ...input, mediaType: "text/html" },
    { ...input, downloadToken: "../?not-allowed" }, { ...input, downloadToken: "x".repeat(2049) }]) {
    await rejectsCode(ingest(bad), "input_invalid");
  }
  assert.deepEqual(h.calls, []);
  h.parentExists = false;
  await rejectsCode(ingest(input), "parent_missing");
  assert.ok(!h.calls.includes("download"));
});

test("retains the committed reservation after storage failure and safely retries", async () => {
  const h = harness();
  const ingest = h.create({ store: async () => { throw new Error("private-storage-prose"); } });
  await rejectsCode(ingest(input), "storage_failed");
  const reservedId = h.state.objects[0].id;
  assert.equal(h.state.objects[0].status, "reserved");
  assert.equal(h.state.queue.length, 0);
  assert.equal(h.state.events.length, 1);
  assert.equal((await h.create()(input)).objectId, reservedId);
  assert.ok(h.buffers.every((bytes) => bytes.every((byte) => byte === 0)));
});

test("rolls back confirmation and event when queue writing fails, then resumes the same object", async () => {
  const h = harness();
  h.failQueue = true;
  const ingest = h.create();
  await rejectsCode(ingest(input), "persistence_failed");
  const id = h.state.objects[0].id;
  assert.equal(h.state.objects[0].status, "reserved");
  assert.equal(h.state.queue.length, 0);
  assert.equal(h.state.events.length, 1);
  assert.equal((await ingest(input)).objectId, id);
  assert.equal(h.state.queue.length, 1);
  assert.equal(h.state.events.length, 2);
});

test("replays every confirmed state without storage or a second scan", async () => {
  const h = harness();
  const ingest = h.create();
  const first = await ingest(input);
  for (const status of ["quarantine", "clean", "blocked", "scan_error"]) {
    h.state.objects[0].status = status;
    h.state.objects[0].storageBucket = status === "clean" ? "communication-inbound-clean" : "communication-inbound-quarantine";
    assert.deepEqual(await ingest(input), { ...first, status, duplicate: true });
  }
  assert.equal(h.stores, 1);
  assert.equal(h.state.queue.length, 1);
});

test("never recreates purged content or accepts a digest substitution", async () => {
  const h = harness();
  const ingest = h.create();
  await ingest(input);
  h.state.objects[0].sha256 = "f".repeat(64);
  await rejectsCode(ingest(input), "reservation_conflict");
  h.state.objects[0].sha256 = sha256;
  h.state.objects[0].status = "purged";
  await rejectsCode(ingest(input), "object_retired");
  assert.equal(h.stores, 1);
  assert.equal(h.state.queue.length, 1);
});

test("an unexpected reservation conflict can still recover the matching clean object", async () => {
  const h = harness();
  const ingest = h.create();
  const first = await ingest(input);
  h.state.objects[0].status = "clean";
  h.state.objects[0].storageBucket = "communication-inbound-clean";
  h.hideExistingOnce = true;
  assert.deepEqual(await ingest(input), { ...first, status: "clean", duplicate: true });
  assert.equal(h.state.objects.length, 1);
  assert.equal(h.state.queue.length, 1);
  assert.equal(h.stores, 1);
});

test("rejects a mismatched storage receipt without confirming it", async () => {
  const h = harness();
  const ingest = h.create({ store: async ({ confirmation }) => ({ ...confirmation, sha256: "0".repeat(64) }) });
  await rejectsCode(ingest(input), "reservation_conflict");
  assert.equal(h.state.queue.length, 0);
  assert.equal(h.state.objects[0].status, "reserved");
});

test("recovers a lost commit acknowledgement without depositing or queueing again", async () => {
  const h = harness();
  h.loseCommit = true;
  const ingest = h.create();
  await rejectsCode(ingest(input), "persistence_failed");
  assert.equal(h.state.objects[0].status, "quarantine");
  assert.equal((await ingest(input)).duplicate, true);
  assert.equal(h.stores, 1);
  assert.equal(h.state.queue.length, 1);
});

test("refuses excess admission without waiting or downloading and releases capacity after failure", async () => {
  const h = harness();
  let release;
  let started;
  const began = new Promise((resolve) => { started = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  const ingest = h.create({ concurrency: 1, download: async () => {
    started(); await gate; throw new Error("private-download-failure");
  } });
  const first = ingest(input);
  await began;
  const calls = h.calls.length;
  await rejectsCode(ingest(input), "capacity_exceeded");
  assert.equal(h.calls.length, calls);
  release();
  await rejectsCode(first, "transfer_failed");
  await rejectsCode(ingest(input), "transfer_failed");
  for (const concurrency of [0, 5, 1.5]) assert.throws(() => h.create({ concurrency }));
});

test("rejects inconsistent download bytes and erases them without reserving", async () => {
  const h = harness();
  const ingest = h.create({ download: async () => ({ ...await h.download(), sha256: "0".repeat(64) }) });
  await rejectsCode(ingest(input), "content_invalid");
  assert.equal(h.state.objects.length, 0);
  assert.ok(h.buffers.every((bytes) => bytes.every((byte) => byte === 0)));
});

test("classifies invalid downloaded sizes as content errors, not database errors", async () => {
  const h = harness();
  const bytes = new Uint8Array();
  const ingest = h.create({ download: async () => ({ bytes, mediaType: input.mediaType, sizeBytes: 0, sha256: digest(bytes) }) });
  await rejectsCode(ingest(input), "content_invalid");
  assert.equal(h.state.objects.length, 0);
});

test("reports database lock and serialization conflicts without leaking driver errors", async () => {
  const h = harness();
  for (const code of ["55P03", "40P01", "40001"]) {
    const ingest = h.create({ transaction: async () => {
      throw new Error("private-driver-prose", { cause: Object.assign(new Error("private-driver-prose"), { code }) });
    } });
    await rejectsCode(ingest(input), "database_busy");
  }
});

test("compare-and-set confirmation replays quarantine without another update or scan", async () => {
  const h = harness();
  const first = await h.create()(input);
  const result = await h.transaction((tx) => confirmCommunicationInboundObjectQuarantine({ tx,
    confirmation: { ...scope, objectId: first.objectId, mediaType: input.mediaType, sizeBytes: fixtureBytes.length, sha256 },
  }));
  assert.deepEqual(result, { ...first, duplicate: true });
  assert.equal(h.state.queue.length, 1);
  assert.equal(h.state.events.length, 2);
});

test("does not activate the webhook, client code, real credentials or deployment", () => {
  const source = readFileSync(new URL("../api/_shared/communication-inbound-ingestion.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../api/webhooks/brevo/communications-inbound.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /console\.|process\.env|fetch\(|createSignedUrl/);
  assert.doesNotMatch(route, /communication-inbound-ingestion|createCommunicationInboundAttachmentIngestor/);
});

test("preview recipe refuses missing or foreign connection settings without exposing their values", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  for (const databaseUrl of ["synthetic-private-invalid-uri", "postgresql://postgres:synthetic-private-password@elsewhere.invalid/postgres"]) {
    const run = spawnSync(process.execPath, ["--import", "./scripts/ts-test-resolver.mjs", "--experimental-strip-types",
      "scripts/test-preview-communication-inbound-ingestion.mjs", "--preview-only"], {
      cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: "utf8", timeout: 5000, maxBuffer: 100_000,
    });
    assert.equal(run.error, undefined);
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /inbound_scan_preview_configuration_invalid/);
    assert.doesNotMatch(run.stderr, /synthetic-private-invalid-uri|synthetic-private-password/);
  }
});
