import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import test from "node:test";
import {
  CommunicationInboundTransferError,
  createCommunicationBrevoAttachmentDownloader,
  createCommunicationInboundQuarantineStore,
  hashCommunicationBrevoAttachmentReference,
} from "../api/_shared/communication-inbound-transfer.ts";

const apiKey = "synthetic-brevo-key-" + "x".repeat(48);
const serviceRoleKey = "synthetic-storage-key-" + "y".repeat(48);
const bytes = new TextEncoder().encode("%PDF-1.7\nFictional inbound attachment\n%%EOF");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const scope = {
  institutionId: "00000000-0000-4000-8000-000000009301",
  inboundId: "00000000-0000-4000-8000-000000009310",
  objectId: "00000000-0000-4000-8000-000000009320",
};
const descriptor = { downloadToken: "synthetic+/token=", mediaType: "application/pdf", estimatedBytes: 1 };
const confirmation = { ...scope, mediaType: descriptor.mediaType, sizeBytes: bytes.length, sha256 };
const supabaseUrl = "https://fictional-inbound.supabase.co";
const objectUrl = `${supabaseUrl}/storage/v1/object/communication-inbound-quarantine/institutions/${scope.institutionId}/inbound/${scope.inboundId}/objects/${scope.objectId}`;
const response = (body = bytes, headers = {}) => new Response(body, {
  headers: { "content-type": "application/pdf", ...headers },
});
const rejectsCode = (pending, code) => assert.rejects(pending, (error) => {
  assert.ok(error instanceof CommunicationInboundTransferError);
  assert.equal(error.code, code);
  assert.equal(error.message, code);
  assert.equal(error.cause, undefined);
  assert.doesNotMatch(JSON.stringify(error), /synthetic-brevo|synthetic-storage|private-prose|token=/);
  return true;
});

test("downloads only from Brevo with transient credentials and measures real size", async () => {
  let calls = 0;
  const download = createCommunicationBrevoAttachmentDownloader({ apiKey, fetchImpl: async (url, init) => {
    calls += 1;
    assert.equal(url, "https://api.brevo.com/v3/inbound/attachments/synthetic%2B%2Ftoken%3D");
    assert.equal(init.method, "GET");
    assert.equal(init.headers["api-key"], apiKey);
    assert.equal(init.redirect, "error");
    assert.equal(init.credentials, "omit");
    assert.equal(init.cache, "no-store");
    assert.ok(init.signal instanceof AbortSignal);
    return response(bytes, { "content-length": String(bytes.length), "content-disposition": "private-prose" });
  } });
  const result = await download(descriptor);
  assert.equal(calls, 1);
  assert.deepEqual(Object.keys(result).sort(), ["bytes", "mediaType", "sha256", "sizeBytes"]);
  assert.deepEqual(result.bytes, bytes);
  assert.equal(result.sizeBytes, bytes.length);
  assert.equal(result.sha256, sha256);
  assert.doesNotMatch(JSON.stringify(result), /downloadToken|synthetic|private-prose/);
});

test("rejects malformed credentials, tokens and descriptors before network", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return response(); };
  for (const bad of [undefined, "short", apiKey + "\n", "x".repeat(2049)]) {
    assert.throws(() => createCommunicationBrevoAttachmentDownloader({ apiKey: bad, fetchImpl }));
  }
  for (const timeoutMs of [0, 99, 30001, 100.5]) {
    assert.throws(() => createCommunicationBrevoAttachmentDownloader({ apiKey, fetchImpl, timeoutMs }));
  }
  const download = createCommunicationBrevoAttachmentDownloader({ apiKey, fetchImpl });
  for (const invalid of [null, [], {},
    { ...descriptor, originalName: "private-prose" },
    { ...descriptor, estimatedBytes: -1 }, { ...descriptor, estimatedBytes: 1.5 },
    { ...descriptor, estimatedBytes: 10 * 1024 * 1024 + 1 },
    { ...descriptor, mediaType: "text/html" },
    ...["", ".", "..", "token?redirect=http://localhost", "token#fragment", "token\r\nkey", "x".repeat(2049)]
      .map((downloadToken) => ({ ...descriptor, downloadToken })),
  ]) await rejectsCode(download(invalid), "input_invalid");
  assert.equal(calls, 0);
});

test("accepts generic provider media but rejects contradictory types and encoding", async () => {
  for (const media of ["application/octet-stream", "application/pdf; charset=binary", null]) {
    const download = createCommunicationBrevoAttachmentDownloader({ apiKey, fetchImpl: async () => {
      const r = response();
      if (media === null) r.headers.delete("content-type");
      else r.headers.set("content-type", media);
      return r;
    } });
    assert.equal((await download(descriptor)).sha256, sha256);
  }
  for (const headers of [{ "content-type": "text/html" }, { "content-encoding": "gzip" }]) {
    let cancelled = false;
    const download = createCommunicationBrevoAttachmentDownloader({ apiKey, fetchImpl: async () => response(
      new ReadableStream({ cancel() { cancelled = true; } }), headers
    ) });
    await rejectsCode(download(descriptor), "content_media_invalid");
    assert.equal(cancelled, true);
  }
});

test("maps provider failures without reading or retaining provider prose", async () => {
  for (const [status, code] of [
    [401, "provider_authorization_failed"], [403, "provider_authorization_failed"],
    [404, "provider_not_found"], [410, "provider_not_found"],
    [429, "provider_rate_limited"], [503, "transfer_unavailable"],
    [302, "provider_rejected"], [206, "provider_rejected"], [400, "provider_rejected"],
  ]) {
    let cancelled = false;
    const download = createCommunicationBrevoAttachmentDownloader({ apiKey, fetchImpl: async () => new Response(
      new ReadableStream({ cancel() { cancelled = true; } }), { status }
    ) });
    await rejectsCode(download(descriptor), code);
    assert.equal(cancelled, true);
  }
  const download = createCommunicationBrevoAttachmentDownloader({ apiKey, fetchImpl: async () => {
    throw new Error("private-prose" + apiKey + descriptor.downloadToken);
  } });
  await rejectsCode(download(descriptor), "transfer_unavailable");
});

test("refuses a redirected or substituted response even with a forged transport", async () => {
  for (const property of ["redirected", "url"]) {
    const download = createCommunicationBrevoAttachmentDownloader({ apiKey, fetchImpl: async () => {
      const r = response();
      Object.defineProperty(r, property, { value: property === "url" ? "https://elsewhere.invalid/file" : true });
      return r;
    } });
    await rejectsCode(download(descriptor), "redirect_refused");
  }
});

test("bounds declared and streamed size and cancels failures without waiting for cancellation", async () => {
  for (const header of ["0", "-1", "1.5", "1e9", "10485761", "not-a-size", "9999999999999999999"]) {
    let cancelled = false;
    const download = createCommunicationBrevoAttachmentDownloader({ apiKey, timeoutMs: 100, fetchImpl: async () => response(
      new ReadableStream({ cancel() { cancelled = true; return new Promise(() => {}); } }),
      { "content-length": header }
    ) });
    await rejectsCode(download(descriptor), "content_size_invalid");
    assert.equal(cancelled, true);
  }
  for (const r of [response(new Uint8Array()), response(bytes, { "content-length": "2" }),
    response(new Uint8Array(10 * 1024 * 1024 + 1))]) {
    const download = createCommunicationBrevoAttachmentDownloader({ apiKey, fetchImpl: async () => r });
    await rejectsCode(download(descriptor), "content_size_invalid");
  }
});

test("times out both headers and a stalled body and cancels a late response", async () => {
  let capturedSignal;
  let finishHeaders;
  let lateCancelled = false;
  const download = createCommunicationBrevoAttachmentDownloader({ apiKey, timeoutMs: 100, fetchImpl: (_url, init) => {
    capturedSignal = init.signal;
    return new Promise((resolve) => { finishHeaders = resolve; });
  } });
  await rejectsCode(download(descriptor), "transfer_timeout");
  assert.equal(capturedSignal.aborted, true);
  finishHeaders(response(new ReadableStream({ cancel() { lateCancelled = true; } })));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(lateCancelled, true);
  let bodyCancelled = false;
  const bodyDownload = createCommunicationBrevoAttachmentDownloader({ apiKey, timeoutMs: 100, fetchImpl: async () => response(
    new ReadableStream({ cancel() { bodyCancelled = true; } })
  ) });
  await rejectsCode(bodyDownload(descriptor), "transfer_timeout");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(bodyCancelled, true);
});

test("creates stable institution-bound references without provider tokens", () => {
  const input = { institutionId: scope.institutionId, inboundId: scope.inboundId, attachmentIndex: 0, secret: apiKey };
  const hash = hashCommunicationBrevoAttachmentReference(input);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hashCommunicationBrevoAttachmentReference(input), hash);
  for (const change of [{ attachmentIndex: 1 }, { institutionId: scope.objectId }, { inboundId: scope.objectId }, { secret: serviceRoleKey }]) {
    assert.notEqual(hashCommunicationBrevoAttachmentReference({ ...input, ...change }), hash);
  }
  assert.throws(() => hashCommunicationBrevoAttachmentReference({ ...input, attachmentIndex: 20 }));
  assert.throws(() => hashCommunicationBrevoAttachmentReference({ ...input, institutionId: "invalid" }),
    (error) => error instanceof CommunicationInboundTransferError && error.code === "input_invalid");
});

function fakeStorage() {
  const stored = new Map();
  const calls = [];
  let writes = 0;
  const fetchImpl = async (url, init) => {
    calls.push({ url, method: init.method });
    assert.equal(url, objectUrl);
    assert.equal(init.redirect, "error");
    assert.equal(init.credentials, "omit");
    assert.equal(init.cache, "no-store");
    assert.equal(init.headers.apikey, serviceRoleKey);
    if (init.method === "POST") {
      assert.equal(init.headers["x-upsert"], "false");
      assert.equal(init.headers["content-type"], confirmation.mediaType);
      const incoming = new Uint8Array(await init.body.arrayBuffer());
      if (stored.has(url)) return new Response("private-prose", { status: 400 });
      stored.set(url, incoming);
      writes += 1;
      return new Response("{}", { status: 201 });
    }
    assert.equal(init.method, "GET");
    return stored.has(url) ? response(stored.get(url)) : new Response(null, { status: 404 });
  };
  return { stored, calls, fetchImpl, get writes() { return writes; } };
}

test("writes only to opaque quarantine and verifies actual bytes before confirmation", async () => {
  const storage = fakeStorage();
  const store = createCommunicationInboundQuarantineStore({ supabaseUrl, serviceRoleKey, fetchImpl: storage.fetchImpl });
  assert.deepEqual(await store({ confirmation, bytes }), confirmation);
  assert.deepEqual(await store({ confirmation, bytes }), confirmation);
  assert.equal(storage.writes, 1);
  assert.deepEqual(storage.calls.map((call) => call.method), ["POST", "GET", "POST", "GET"]);
  assert.deepEqual(storage.stored.get(objectUrl), bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), sha256);
});

test("recovers after a lost upload response without replacing the first object", async () => {
  const storage = fakeStorage();
  let loseResponse = true;
  const store = createCommunicationInboundQuarantineStore({ supabaseUrl, serviceRoleKey, fetchImpl: async (url, init) => {
    const r = await storage.fetchImpl(url, init);
    if (init.method === "POST" && loseResponse) {
      loseResponse = false;
      throw new Error("private-prose");
    }
    return r;
  } });
  await rejectsCode(store({ confirmation, bytes }), "transfer_unavailable");
  assert.deepEqual(await store({ confirmation, bytes }), confirmation);
  assert.equal(storage.writes, 1);
});

test("twenty concurrent retries produce one stored object and matching receipts", async () => {
  const storage = fakeStorage();
  const store = createCommunicationInboundQuarantineStore({ supabaseUrl, serviceRoleKey, fetchImpl: storage.fetchImpl });
  const results = await Promise.all(Array.from({ length: 20 }, () => store({ confirmation, bytes })));
  assert.equal(storage.writes, 1);
  assert.ok(results.every((result) => result.sha256 === sha256));
});

test("refuses content substitution, wrong size and wrong MIME without deleting evidence", async () => {
  for (const kind of ["digest", "size", "media"]) {
    const storage = fakeStorage();
    storage.stored.set(objectUrl, kind === "digest" ? Uint8Array.from(bytes, (b) => b ^ 1) : bytes);
    const store = createCommunicationInboundQuarantineStore({ supabaseUrl, serviceRoleKey, fetchImpl: async (url, init) => {
      const r = await storage.fetchImpl(url, init);
      if (init.method !== "GET") return r;
      if (kind === "size") return response(new Uint8Array([1]));
      if (kind === "media") return response(bytes, { "content-type": "text/html" });
      return r;
    } });
    await rejectsCode(store({ confirmation, bytes }), kind === "digest" ? "content_digest_mismatch" : `content_${kind}_invalid`);
    assert.equal(storage.writes, 0);
    assert.ok(storage.calls.every((call) => ["POST", "GET"].includes(call.method)));
  }
});

test("rejects unsafe storage configuration and mismatched confirmation before writing", async () => {
  for (const bad of ["http://localhost", "https://x.supabase.co@elsewhere.invalid", "https://x.supabase.co/path", "https://x.supabase.co?q=1", "https://x.supabase.co:443"]) {
    assert.throws(() => createCommunicationInboundQuarantineStore({ supabaseUrl: bad, serviceRoleKey }));
  }
  let calls = 0;
  const store = createCommunicationInboundQuarantineStore({ supabaseUrl, serviceRoleKey, fetchImpl: async () => { calls += 1; return response(); } });
  await rejectsCode(store({ confirmation: { ...confirmation, downloadToken: "forbidden" }, bytes }), "input_invalid");
  await rejectsCode(store({ confirmation: { ...confirmation, objectId: "../elsewhere" }, bytes }), "input_invalid");
  await rejectsCode(store({ confirmation: { ...confirmation, sizeBytes: 1 }, bytes }), "content_size_invalid");
  await rejectsCode(store({ confirmation: { ...confirmation, sha256: "a".repeat(64) }, bytes }), "content_digest_mismatch");
  assert.equal(calls, 0);
});

test("fails closed on private storage rejection, missing content and stalled reads", async () => {
  for (const [status, code] of [[403, "storage_write_failed"], [503, "storage_write_failed"], [400, "storage_read_failed"]]) {
    const store = createCommunicationInboundQuarantineStore({ supabaseUrl, serviceRoleKey, fetchImpl: async (_url, init) =>
      new Response("private-prose", { status: init.method === "POST" ? status : 404 }) });
    await rejectsCode(store({ confirmation, bytes }), code);
  }
  const store = createCommunicationInboundQuarantineStore({ supabaseUrl, serviceRoleKey, timeoutMs: 100, fetchImpl: async (_url, init) =>
    init.method === "POST" ? new Response(null, { status: 201 }) : response(new ReadableStream()) });
  await rejectsCode(store({ confirmation, bytes }), "transfer_timeout");
});

test("keeps transport disconnected from real webhooks and client code", () => {
  const route = readFileSync(new URL("../api/webhooks/brevo/communications-inbound.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /communication-inbound-transfer|createCommunicationBrevoAttachmentDownloader/);
  const source = readFileSync(new URL("../api/_shared/communication-inbound-transfer.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /console\.|process\.env|createSignedUrl|pgmq|\.remove\(/);
});

test("accepts the exact object ceiling without keeping unused buffer bytes", async () => {
  const maximum = new Uint8Array(10 * 1024 * 1024).fill(42);
  const download = createCommunicationBrevoAttachmentDownloader({ apiKey, fetchImpl: async () => response(maximum) });
  const result = await download({ ...descriptor, estimatedBytes: 0 });
  assert.equal(result.sizeBytes, maximum.length);
  assert.equal(result.bytes.buffer.byteLength, maximum.length);
  assert.equal(result.sha256, createHash("sha256").update(maximum).digest("hex"));
});

test("cancels a pending native read without masking its failure when cleanup never settles", async () => {
  let cancelled = false;
  const download = createCommunicationBrevoAttachmentDownloader({ apiKey, timeoutMs: 100, fetchImpl: async () => response(
    new ReadableStream({ cancel() { cancelled = true; return new Promise(() => {}); } })
  ) });
  await rejectsCode(download(descriptor), "transfer_timeout");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(cancelled, true);
  const reader = new ReadableStream({ cancel() { return new Promise(() => {}); } }).getReader();
  const pendingRead = reader.read();
  void reader.cancel();
  assert.doesNotThrow(() => reader.releaseLock());
  assert.deepEqual(await pendingRead, { value: undefined, done: true });
});

test("snapshots caller bytes and confirmation before asynchronous upload", async () => {
  const storage = fakeStorage();
  const mutableBytes = Uint8Array.from(bytes);
  const mutableConfirmation = { ...confirmation };
  const store = createCommunicationInboundQuarantineStore({ supabaseUrl, serviceRoleKey, fetchImpl: storage.fetchImpl });
  const pending = store({ confirmation: mutableConfirmation, bytes: mutableBytes });
  mutableBytes.fill(0);
  mutableConfirmation.objectId = scope.inboundId;
  mutableConfirmation.sha256 = "0".repeat(64);
  assert.deepEqual(await pending, confirmation);
  assert.deepEqual(storage.stored.get(objectUrl), bytes);
});

test("uses native HTTP for chunked download, immutable upload, readback and refused redirects", async () => {
  let persisted;
  let writes = 0;
  let redirectedRequests = 0;
  const serverErrors = [];
  const server = createServer(async (req, res) => {
    try {
      if (req.url === "/download") {
        assert.equal(req.headers["api-key"], apiKey);
        res.writeHead(200, { "content-type": "application/octet-stream" });
        res.write(bytes.subarray(0, 8));
        res.end(bytes.subarray(8));
      } else if (req.url === "/redirect") {
        res.writeHead(302, { location: "/forbidden" });
        res.end();
      } else if (req.url === "/forbidden") {
        redirectedRequests += 1;
        res.end();
      } else if (req.url === "/object") {
        assert.equal(req.headers.authorization, `Bearer ${serviceRoleKey}`);
        assert.equal(req.headers.apikey, serviceRoleKey);
        if (req.method === "POST") {
          assert.equal(req.headers["x-upsert"], "false");
          assert.equal(req.headers["content-type"], confirmation.mediaType);
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          if (persisted) {
            res.writeHead(400);
          } else {
            persisted = Buffer.concat(chunks);
            writes += 1;
            res.writeHead(201);
          }
          res.end("{}");
        } else {
          assert.equal(req.method, "GET");
          assert.ok(persisted);
          res.writeHead(200, { "content-type": "application/pdf", "content-length": String(persisted.length) });
          res.end(persisted);
        }
      } else {
        assert.fail("Unexpected fixture route");
      }
    } catch (error) {
      serverErrors.push(error);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const fixtureFetch = (route, expectedUrl) => async (url, init) => {
      assert.equal(url, expectedUrl);
      const actual = await fetch(origin + route, init);
      // Only the fixture remaps the host; native fetch still enforces redirect and abort options.
      return new Response(actual.body, { status: actual.status, headers: actual.headers });
    };
    const brevoUrl = "https://api.brevo.com/v3/inbound/attachments/synthetic%2B%2Ftoken%3D";
    const download = createCommunicationBrevoAttachmentDownloader({ apiKey, fetchImpl: fixtureFetch("/download", brevoUrl) });
    const downloaded = await download(descriptor);
    assert.deepEqual(downloaded.bytes, bytes);
    const store = createCommunicationInboundQuarantineStore({ supabaseUrl, serviceRoleKey, fetchImpl: fixtureFetch("/object", objectUrl) });
    assert.deepEqual(await store({ confirmation, bytes: downloaded.bytes }), confirmation);
    assert.deepEqual(await store({ confirmation, bytes: downloaded.bytes }), confirmation);
    assert.equal(writes, 1);
    assert.deepEqual(new Uint8Array(persisted), bytes);
    const redirect = createCommunicationBrevoAttachmentDownloader({ apiKey, fetchImpl: fixtureFetch("/redirect", brevoUrl) });
    await rejectsCode(redirect(descriptor), "transfer_unavailable");
    assert.equal(redirectedRequests, 0);
    assert.deepEqual(serverErrors, []);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
});
