import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createCommunicationInboundScanRepository } from "../workers/communication-inbound-scan-repository.mjs";
import {
  createCommunicationInboundScanProcessor,
  CommunicationInboundWorkerError,
} from "../workers/communication-inbound-scan-core.mjs";
import {
  runCommunicationInboundScanBatch,
  verifyCommunicationInboundWorkerConfiguration,
} from "../workers/communication-inbound-scan-worker.mjs";
import {
  createCommunicationInboundCleanStore,
  createCommunicationInboundQuarantineReader,
} from "../api/_shared/communication-inbound-transfer.ts";

const scope = {
  institutionId: "00000000-0000-4000-8000-000000009301",
  inboundId: "00000000-0000-4000-8000-000000009310",
  objectId: "00000000-0000-4000-8000-000000009320",
};
const bytes = Buffer.from("Fictional inbound file");
const confirmation = { ...scope, sizeBytes: bytes.length, mediaType: "text/plain",
  sha256: createHash("sha256").update(bytes).digest("hex") };
const path = `institutions/${scope.institutionId}/inbound/${scope.inboundId}/objects/${scope.objectId}`;
const job = { schema: 1, job_type: "scan_communication_inbound_object",
  institution_id: scope.institutionId, inbound_id: scope.inboundId, object_id: scope.objectId };
const cleanResult = (reference) => ({ ...reference, status: "clean", scanDetail: "clamav_clean",
  scannedAt: new Date().toISOString() });

function fixture(options = {}) {
  let state = { object: { ...confirmation, storagePath: path, storageBucket: "communication-inbound-quarantine",
    status: "quarantine", scanDetail: "awaiting_antivirus", scannedAt: null },
  job: { message: structuredClone(job), readCount: 1, active: true }, events: [], archived: false };
  const calls = { download: 0, scan: 0, store: 0, storedCopies: 0 };
  const stored = new Map();
  const owned = [];
  const trace = [];
  let fault = null;
  const inject = (point) => { if (fault === point) { fault = null; throw new Error("private-provider-detail"); } };
  const process = createCommunicationInboundScanProcessor({
    concurrency: options.concurrency ?? 2,
    withTransaction: async (work) => {
      const before = structuredClone(state);
      try {
        const result = await work({
          async lockJob(lease) {
            trace.push("job");
            return lease.msgId === "1" && state.job?.readCount === lease.readCount && state.job.active
              ? { message: state.job.message } : null;
          },
          async lockObject(reference) {
            trace.push("object");
            return Object.keys(scope).every((key) => reference[key] === scope[key]) ? state.object : null;
          },
          async setObject(reference, patch) {
            assert.deepEqual(reference, scope);
            assert.ok({ quarantine: ["clean", "blocked", "scan_error"], scan_error: ["quarantine"] }
              [state.object.status]?.includes(patch.status), "legal state transition");
            Object.assign(state.object, patch);
            trace.push(patch.status);
            inject("update");
          },
          async addEvent(reference, type, summary) {
            assert.deepEqual(reference, scope);
            assert.equal(type, `object.${state.object.status === "quarantine" ? "quarantined" : state.object.status}`);
            state.events.push({ type, summary });
            inject("event");
          },
          async acknowledgeJob(id) { assert.equal(id, "1"); state.job = null; trace.push("ack"); inject("ack"); },
          async archiveJob(id) { assert.equal(id, "1"); state.job = null; state.archived = true; inject("archive"); },
          async retryJob(id, seconds) {
            assert.equal(id, "1"); state.job.active = false; state.job.delay = seconds; inject("retry");
          },
        });
        if (fault === "commit_ack") { fault = null; throw { committed: true }; }
        return result;
      } catch (error) { if (!error.committed) state = before; throw error; }
    },
    download: async (reference) => {
      calls.download += 1;
      trace.push("download");
      if (options.download) return options.download(reference);
      const copy = Buffer.from(bytes); owned.push(copy); return copy;
    },
    scan: async (input) => {
      calls.scan += 1; trace.push("scan");
      return options.scan ? options.scan(input) : cleanResult(input.confirmation);
    },
    storeClean: async (input) => {
      calls.store += 1; trace.push("store");
      if (options.storeClean) return options.storeClean(input);
      if (!stored.has(path)) { stored.set(path, Buffer.from(input.bytes)); calls.storedCopies += 1; }
      else assert.deepEqual(stored.get(path), input.bytes);
      return { ...input.confirmation };
    },
  });
  return { process, calls, owned, trace, stored,
    get state() { return state; },
    inject(point) { fault = point; },
    lease(count = state.job?.readCount ?? 1) {
      if (state.job) { state.job.readCount = count; state.job.active = true; }
      return { msgId: "1", readCount: count };
    },
  };
}

test("holds a scoped lease, scans, promotes and acknowledges with one state transaction", async () => {
  const h = fixture();
  assert.deepEqual(await h.process(h.lease()), { status: "clean", objectId: scope.objectId });
  assert.deepEqual(h.trace, ["job", "object", "download", "scan", "store", "clean", "ack"]);
  assert.equal(h.state.object.storageBucket, "communication-inbound-clean");
  assert.deepEqual(h.state.events, [{ type: "object.clean", summary: { antivirus: "clamav_clean" } }]);
  assert.equal(h.state.job, null);
  assert.ok(h.owned.every((buffer) => buffer.every((byte) => byte === 0)));
});

test("rolls back state, evidence and acknowledgement on database failures then reuses the clean copy", async () => {
  for (const point of ["update", "event", "ack"]) {
    const h = fixture(); h.inject(point);
    await assert.rejects(h.process(h.lease()), { code: "processing_unavailable" });
    assert.equal(h.state.object.status, "quarantine");
    assert.equal(h.state.events.length, 0);
    assert.ok(h.state.job);
    assert.equal(h.stored.size, 1);
    assert.equal((await h.process(h.lease(2))).status, "clean");
    assert.equal(h.calls.storedCopies, 1);
    assert.equal(h.state.events.length, 1);
  }
});

test("does not repeat a completed scan after a lost commit acknowledgement", async () => {
  const h = fixture(); h.inject("commit_ack");
  await assert.rejects(h.process(h.lease()), { code: "processing_unavailable" });
  assert.equal(h.state.object.status, "clean");
  assert.deepEqual(await h.process({ msgId: "1", readCount: 1 }), { status: "stale" });
  assert.equal(h.calls.scan, 1);
});

test("keeps detected files private and records a blocked verdict without promotion", async () => {
  const h = fixture({ scan: async ({ confirmation: reference }) => ({ ...cleanResult(reference),
    status: "blocked", scanDetail: "antivirus_detected_threat" }) });
  assert.equal((await h.process(h.lease())).status, "blocked");
  assert.equal(h.calls.store, 0);
  assert.equal(h.state.object.storageBucket, "communication-inbound-quarantine");
  assert.equal(h.state.events[0].type, "object.blocked");
});

test("retries transient failures with backoff and stops at five attempts", async () => {
  const h = fixture({ scan: async () => { throw { code: "scan_timeout", message: "private-provider-detail" }; } });
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = await h.process(h.lease(attempt));
    assert.equal(result.status, attempt === 5 ? "failed" : "retry");
    assert.equal(h.state.object.status, "scan_error");
    if (attempt < 5) assert.equal(h.state.job.delay, [30, 120, 300, 900][attempt - 1]);
  }
  assert.equal(h.calls.scan, 5);
  assert.equal(h.state.archived, true);
  assert.equal(h.state.events.filter((event) => event.type === "object.quarantined").length, 4);
  assert.doesNotMatch(JSON.stringify(h.state), /private-provider-detail/);
});

test("archives lease exhaustion without another scan, including repeated pre-commit crashes", async () => {
  for (const status of ["quarantine", "scan_error"]) {
    const h = fixture(); h.state.object.status = status;
    assert.equal((await h.process(h.lease(6))).status, "failed");
    assert.equal(h.calls.download, 0);
    assert.equal(h.state.object.status, "scan_error");
  }
});

test("does not promote substituted bytes, forged receipts, stale timestamps or unsafe archives", async () => {
  const cases = [
    { download: async () => Buffer.from("different content") },
    { scan: async () => { throw { code: "unsafe_archive" }; } },
    { scan: async ({ confirmation: reference }) => ({ ...cleanResult(reference), institutionId: scope.inboundId }) },
    { scan: async ({ confirmation: reference }) => ({ ...cleanResult(reference), scannedAt: "2020-01-01T00:00:00.000Z" }) },
    { scan: async ({ confirmation: reference }) => ({ ...cleanResult(reference), extra: "private-provider-detail" }) },
    { storeClean: async ({ confirmation: reference }) => ({ ...reference, sha256: "0".repeat(64) }) },
  ];
  for (const options of cases) {
    const h = fixture(options);
    assert.notEqual((await h.process(h.lease())).status, "clean");
    assert.equal(h.state.object.status, "scan_error");
    assert.equal(h.state.object.storageBucket, "communication-inbound-quarantine");
    assert.equal(h.state.events.some((event) => event.type === "object.clean"), false);
  }
});

test("keeps RFC822 with nested parts private until the MIME extraction policy exists", async () => {
  const h = fixture(); h.state.object.mediaType = "message/rfc822";
  assert.equal((await h.process(h.lease())).status, "failed");
  assert.equal(h.calls.download, 0);
  assert.equal(h.state.object.scanDetail, "unsupported_media");
});

test("refuses stale leases and archives malformed or cross-institution jobs without object mutation", async () => {
  const stale = fixture(); stale.state.job.active = false;
  assert.deepEqual(await stale.process({ msgId: "1", readCount: 1 }), { status: "stale" });
  for (const message of [null, { ...job, token: "synthetic-token" }, { ...job, schema: 2 },
    { ...job, institution_id: scope.inboundId }]) {
    const h = fixture(); h.state.job.message = message;
    assert.equal((await h.process(h.lease())).status, "archived");
    assert.equal(h.state.object.status, "quarantine");
    assert.equal(h.calls.download, 0);
    assert.equal(h.state.events.length, 0);
  }
});

test("never recreates terminal objects when another job is delivered", async () => {
  for (const status of ["clean", "blocked", "purged"]) {
    const h = fixture(); h.state.object.status = status;
    assert.equal((await h.process(h.lease())).status, "already_processed");
    assert.equal(h.state.object.status, status);
    assert.equal(h.calls.download, 0);
  }
});

test("rolls back retries and archival failures instead of losing the queued task", async () => {
  for (const point of ["retry", "archive"]) {
    const h = fixture({ scan: async () => { throw { code: "scan_timeout" }; } }); h.inject(point);
    await assert.rejects(h.process(h.lease(point === "archive" ? 5 : 1)), { code: "processing_unavailable" });
    assert.equal(h.state.object.status, "quarantine");
    assert.ok(h.state.job);
    assert.equal(h.state.events.length, 0);
  }
});

test("bounds in-process admission and releases it after work finishes", async () => {
  let release, entered;
  const pendingScan = new Promise((resolveScan) => { release = resolveScan; });
  const ready = new Promise((resolveReady) => { entered = resolveReady; });
  const h = fixture({ concurrency: 1, scan: async ({ confirmation: reference }) => {
    entered(); await pendingScan; return cleanResult(reference);
  } });
  const first = h.process(h.lease()); await ready;
  await assert.rejects(h.process(h.lease()), { code: "capacity_exceeded" });
  release(); await first;
  assert.equal((await h.process({ msgId: "1", readCount: 1 })).status, "stale");
});

test("rejects malformed lease IDs before transaction or content access", async () => {
  const h = fixture();
  for (const lease of [null, {}, { msgId: "0", readCount: 1 }, { msgId: "1 OR 1=1", readCount: 1 },
    { msgId: "9223372036854775808", readCount: 1 }, { msgId: "1", readCount: 0 },
    { msgId: "1", readCount: 1, token: "private-provider-detail" }]) {
    await assert.rejects(h.process(lease), (error) => error instanceof CommunicationInboundWorkerError && error.code === "lease_invalid");
  }
  assert.equal(h.trace.length, 0);
});

test("uses fixed private buckets and verifies downloaded and promoted content", async () => {
  const calls = [];
  const options = { supabaseUrl: "https://fictional-inbound.supabase.co",
    serviceRoleKey: "synthetic-storage-key-" + "x".repeat(40),
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method });
      assert.equal(init.redirect, "error");
      if (init.method === "POST") {
        assert.equal(init.headers["x-upsert"], "false");
        return new Response(null, { status: 409 });
      }
      return new Response(bytes, { headers: { "content-type": "text/plain", "content-length": String(bytes.length) } });
    } };
  const downloaded = await createCommunicationInboundQuarantineReader(options)(confirmation);
  assert.deepEqual(Buffer.from(downloaded), bytes);
  const receipt = await createCommunicationInboundCleanStore(options)({ confirmation, bytes: downloaded });
  assert.deepEqual(receipt, confirmation);
  assert.match(calls[0].url, /\/communication-inbound-quarantine\//);
  assert.match(calls[1].url, /\/communication-inbound-clean\//);
  assert.equal(calls[2].url, calls[1].url);
  downloaded.fill(0);
});

test("does not return private storage bytes when size, digest or media differs", async () => {
  for (const response of [new Response("x", { headers: { "content-type": "text/plain" } }),
    new Response(Buffer.alloc(bytes.length), { headers: { "content-type": "text/plain" } }),
    new Response(bytes, { headers: { "content-type": "text/html" } })]) {
    const read = createCommunicationInboundQuarantineReader({ supabaseUrl: "https://fictional-inbound.supabase.co",
      serviceRoleKey: "synthetic-storage-key-" + "x".repeat(40), fetchImpl: async () => response });
    await assert.rejects(read(confirmation));
  }
});

test("bounds batches, waits for every active processor and returns only counters", async () => {
  let next = 0, active = 0, maxActive = 0;
  const result = await runCommunicationInboundScanBatch({ limit: 20, concurrency: 4,
    repository: { async lease() { return { msgId: String(++next), readCount: 1 }; } },
    async processLease(lease) {
      active += 1; maxActive = Math.max(active, maxActive);
      await new Promise((done) => setTimeout(done, 2)); active -= 1;
      if (lease.msgId === "5") throw new Error("private-provider-detail");
      return { status: "clean" };
    },
  });
  assert.equal(result.leased, 20); assert.equal(result.clean, 19); assert.equal(result.errors, 1);
  assert.equal(maxActive, 4); assert.equal(active, 0);
  assert.doesNotMatch(JSON.stringify(result), /private-provider-detail/);
});

test("requires explicit preview flags and rejects foreign or malformed configuration without leaking it", () => {
  const env = { COMMUNICATION_INBOUND_SCAN_ENABLED: "true", COMMUNICATION_INBOUND_CLAMAV_VERIFIED: "true",
    DATABASE_URL: "postgresql://postgres:synthetic-password@db.xijocumlwivhbmffrnlj.supabase.co/postgres",
    VITE_SUPABASE_URL: "https://xijocumlwivhbmffrnlj.supabase.co" };
  assert.deepEqual(verifyCommunicationInboundWorkerConfiguration(env, ["--preview-only"]), { limit: 10, concurrency: 2 });
  for (const changes of [ { DATABASE_URL: "private-provider-detail" },
    { DATABASE_URL: "postgresql://postgres:synthetic-password@db.other.supabase.co/postgres" },
    { VITE_SUPABASE_URL: "https://other.supabase.co" }, { COMMUNICATION_INBOUND_SCAN_ENABLED: "false" },
    { DATABASE_URL: env.DATABASE_URL + "?host=db.other.supabase.co" },
    { DATABASE_URL: env.DATABASE_URL + "?sslmode=disable" },
    { DATABASE_URL: env.DATABASE_URL + "#ignored" },
    { DATABASE_URL: "postgresql://%:synthetic-password@aws-0-eu-west-3.pooler.supabase.com/postgres" },
    { DATABASE_URL: "postgresql://postgres.other:synthetic-password@aws-0-eu-west-3.pooler.supabase.com/postgres" },
    { COMMUNICATION_INBOUND_CLAMAV_VERIFIED: "false" }, { COMMUNICATION_INBOUND_SCAN_BATCH_SIZE: "21" }]) {
    assert.throws(() => verifyCommunicationInboundWorkerConfiguration({ ...env, ...changes }, ["--preview-only"]),
      (error) => !/private-provider-detail|synthetic-password/.test(error.message));
  }
  assert.throws(() => verifyCommunicationInboundWorkerConfiguration(env, []));
  assert.deepEqual(verifyCommunicationInboundWorkerConfiguration({ ...env,
    DATABASE_URL: "postgresql://postgres.xijocumlwivhbmffrnlj:synthetic-password@aws-0-eu-west-3.pooler.supabase.com:6543/postgres",
  }, ["--preview-only"]), { limit: 10, concurrency: 2 });
});

function repositoryFixture(overrides = {}) {
  const calls = [];
  let transaction = false;
  const sql = async (strings, ...values) => {
    const query = strings.join("?").replace(/\s+/gu, " ").trim();
    calls.push({ query, values, transaction });
    if (overrides.respond) return overrides.respond(query, values);
    if (query.includes("pgmq.read(")) return [{ msgId: "1", readCount: 1 }];
    if (query.startsWith("select message")) return [{ message: job }];
    if (query.includes("for update") || query.includes("returning id")) return [{ id: scope.objectId }];
    if (query.includes("pgmq.set_vt(")) return [{ msg_id: "1" }];
    if (/pgmq\.(delete|archive)\(/u.test(query)) return [{ ok: true }];
    return [];
  };
  sql.json = (value) => ({ encodedJson: value });
  sql.begin = async (work) => {
    assert.equal(transaction, false); transaction = true;
    try { return await work(sql); }
    finally { transaction = false; }
  };
  return { repository: createCommunicationInboundScanRepository(sql), calls };
}

test("repository scopes every object write and binds queue arguments inside one transaction", async () => {
  const h = repositoryFixture();
  assert.deepEqual(await h.repository.lease(), { msgId: "1", readCount: 1 });
  await h.repository.withTransaction(async (tx) => {
    assert.deepEqual(await tx.lockJob({ msgId: "1", readCount: 1 }), { message: job });
    await tx.lockObject(scope);
    await tx.setObject(scope, { status: "clean", scanDetail: "clamav_clean", scannedAt: new Date(0),
      storageBucket: "communication-inbound-clean" });
    await tx.addEvent(scope, "object.clean", { antivirus: "clamav_clean" });
    await tx.acknowledgeJob("1");
    await tx.archiveJob("2");
    await tx.retryJob("3", 120);
  });
  assert.equal(h.calls[0].transaction, false);
  assert.match(h.calls[0].query, /pgmq\.read\('communication_inbound_scan', 300, 1\)/);
  assert.ok(h.calls.slice(1).every((call) => call.transaction));
  for (const call of h.calls.filter(({ query }) => query.includes("public.communication_inbound_objects"))) {
    assert.match(call.query, /where id = \?::uuid and institution_id = \?::uuid and inbound_id = \?::uuid/);
    assert.deepEqual(call.values.slice(-3), [scope.objectId, scope.institutionId, scope.inboundId]);
  }
  const lock = h.calls.find(({ query }) => query.startsWith("select message"));
  assert.match(lock.query, /read_ct = \? and vt > clock_timestamp\(\) for update/);
  assert.deepEqual(lock.values, ["1", 1]);
  assert.ok(h.calls.some(({ query }) => query === "set local statement_timeout = '10s'"));
  assert.ok(h.calls.some(({ values }) => values.some((value) => value?.encodedJson?.antivirus === "clamav_clean")));
  assert.deepEqual(h.calls.at(-1).values, ["3", 120]);
});

test("repository refuses empty writes and unsuccessful acknowledgements instead of silently committing", async () => {
  for (const operation of ["setObject", "acknowledgeJob", "archiveJob", "retryJob"]) {
    const h = repositoryFixture({ respond: () => [] });
    await assert.rejects(h.repository.withTransaction(async (tx) => {
      if (operation === "setObject") return tx.setObject(scope, { status: "scan_error", scanDetail: "scan_timeout" });
      return tx[operation]("1", 30);
    }), /inbound_scan_(write|queue)_conflict/);
  }
  const h = repositoryFixture({ respond: () => [] });
  assert.equal(await h.repository.lease(), null);
  await h.repository.withTransaction(async (tx) => {
    assert.equal(await tx.lockJob({ msgId: "1", readCount: 1 }), null);
    assert.equal(await tx.lockObject(scope), null);
  });
});

test("the executable worker stays disabled without its deployment gates", () => {
  const result = spawnSync(process.execPath, ["--import", "./scripts/ts-test-resolver.mjs",
    "--experimental-strip-types", "workers/communication-inbound-scan-worker.mjs", "--preview-only"], {
    cwd: new URL("../", import.meta.url), encoding: "utf8", windowsHide: true,
    env: { ...process.env, COMMUNICATION_INBOUND_SCAN_ENABLED: "false", DATABASE_URL: "private-provider-detail" },
    timeout: 5000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /communication_inbound_scan_unavailable/);
  assert.doesNotMatch(result.stdout + result.stderr, /private-provider-detail/);
});
