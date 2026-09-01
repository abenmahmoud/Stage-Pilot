import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  CommunicationInboundScanError,
  createCommunicationInboundScanner,
} from "../workers/communication-inbound-scanner.mjs";
import { parseCommunicationInboundQuarantineConfirmation } from "../shared/communication-inbound-content-policy.ts";

const workerRequire = createRequire(new URL("../workers/package.json", import.meta.url));
const JSZip = workerRequire("jszip");
const scope = {
  institutionId: "00000000-0000-4000-8000-000000009301",
  inboundId: "00000000-0000-4000-8000-000000009310",
  objectId: "00000000-0000-4000-8000-000000009320",
};
const input = (bytes = Buffer.from("Fictional inbound document"), mediaType = "text/plain") => ({
  bytes,
  confirmation: { ...scope, mediaType, sizeBytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex") },
});
const rejected = (pending, code) => assert.rejects(pending, (error) => {
  assert.ok(error instanceof CommunicationInboundScanError);
  assert.equal(error.code, code);
  assert.equal(error.message, code);
  assert.equal(error.cause, undefined);
  assert.doesNotMatch(JSON.stringify(error), /synthetic-secret|private-address|daemon-detail/);
  return true;
});

// Real OS pipes/process lifetime, but intentionally NOT a ClamAV engine.
function harness({ mode = "clean", timeoutMs, concurrency, onSpawn, endpoint = { port: 3310 } } = {}) {
  const children = [];
  const directories = [];
  const scan = createCommunicationInboundScanner({
    executable: process.execPath, endpoint, timeoutMs, concurrency,
    spawnImpl(executable, args, options) {
      assert.equal(executable, process.execPath);
      assert.deepEqual(args.filter((_, index) => index !== 1), ["--config-file", "--stream", "--no-summary", "-"]);
      const configPath = args[1];
      const directory = dirname(configPath);
      directories.push(directory);
      assert.deepEqual(readdirSync(directory), ["clamdscan.conf"]);
      assert.equal(readFileSync(configPath, "utf8"), endpoint.socketPath
        ? `LocalSocket "${endpoint.socketPath}"\nStreamMaxLength 10485761\n`
        : "TCPAddr 127.0.0.1\nTCPSocket 3310\nStreamMaxLength 10485761\n");
      assert.equal(options.windowsHide, true);
      assert.equal(options.shell, false);
      assert.deepEqual(options.stdio, ["pipe", "pipe", "pipe"]);
      for (const key of Object.keys(options.env)) {
        assert.ok(["systemroot", "windir", "temp", "tmp", "lang", "lc_all"].includes(key.toLowerCase()));
      }
      const program = `
        const mode = ${JSON.stringify(mode)};
        if (mode === 'abandon') process.exit(0);
        const crypto = require('node:crypto');
        const chunks = [];
        process.stdin.on('data', chunk => chunks.push(chunk));
        process.stdin.on('end', () => {
          const body = Buffer.concat(chunks);
          if (mode === 'hang') { setInterval(() => {}, 1000); return; }
          if (mode === 'flood') { process.stdout.write('x'.repeat(100000)); setInterval(() => {}, 1000); return; }
          if (mode === 'stderr-flood') { process.stderr.write('daemon-detail'.repeat(10000)); setInterval(() => {}, 1000); return; }
          if (mode === 'error') { process.stderr.write('daemon-detail private-address'); process.exitCode = 2; return; }
          if (mode === 'empty') return;
          if (mode === 'ambiguous') { process.stdout.write('stream: OK\\nstream: ERROR\\n'); return; }
          if (mode === 'warning') { process.stderr.write('daemon-detail'); process.stdout.write('stream: OK\\n'); return; }
          if (mode === 'blocked-warning') { process.stderr.write('daemon-detail'); process.stdout.write('stream: Synthetic.Test FOUND\\n'); process.exitCode = 1; return; }
          if (mode === 'split') { process.stdout.write('stream: '); setTimeout(() => process.stdout.write('OK\\n'), 20); return; }
          if (mode === 'wrong-code') { process.stdout.write('stream: OK\\n'); process.exitCode = 2; return; }
          if (mode === 'early') { process.exit(0); return; }
          if (mode === 'blocked') { process.stdout.write('stream: Synthetic.Test FOUND\\n'); process.exitCode = 1; return; }
          if (mode.startsWith('sha:') && crypto.createHash('sha256').update(body).digest('hex') !== mode.slice(4)) {
            process.exitCode = 2; return;
          }
          process.stdout.write('stream: OK\\r\\n');
        });
      `;
      const child = spawn(executable, ["-e", program], options);
      children.push(child);
      onSpawn?.(child);
      return child;
    },
  });
  return { scan, children, assertReleased() {
    assert.ok(children.every((child) => child.exitCode !== null || child.signalCode !== null));
    assert.ok(directories.every((path) => !existsSync(path)));
  } };
}

test("streams an exact private snapshot through native pipes and returns a scoped receipt", async () => {
  const request = input();
  const original = Buffer.from(request.bytes);
  const h = harness({ mode: `sha:${request.confirmation.sha256}` });
  const pending = h.scan(request);
  request.bytes.fill(0);
  request.confirmation.sha256 = "0".repeat(64);
  const result = await pending;
  assert.deepEqual(result, { ...input(original).confirmation, status: "clean",
    scanDetail: "clamav_clean", scannedAt: result.scannedAt });
  assert.ok(Number.isFinite(Date.parse(result.scannedAt)));
  h.assertReleased();
});

test("refuses invalid configuration and never accepts arbitrary remote scan targets", () => {
  for (const options of [
    {}, { executable: "clamdscan" }, { executable: process.execPath + "\n" },
    { endpoint: { port: 0 } }, { endpoint: { port: 65536 } },
    { endpoint: { port: 3310, host: "external.invalid" } },
    { endpoint: { socketPath: "relative" } }, { endpoint: { socketPath: "/run/clam\nTCPAddr elsewhere" } },
    { timeoutMs: 99 }, { timeoutMs: 120001 }, { concurrency: 0 }, { concurrency: 5 },
  ]) assert.throws(() => createCommunicationInboundScanner({
    executable: process.execPath, endpoint: { port: 3310 }, ...options,
    ...(Object.keys(options).length ? {} : { executable: undefined }),
  }), { code: "configuration_invalid" });
});

test("rejects extra fields, metadata substitutions and oversized contents before spawn", async () => {
  const h = harness();
  for (const request of [null, {}, { ...input(), originalName: "private-address" },
    input(Buffer.alloc(0)), input(Buffer.alloc(10 * 1024 * 1024 + 1)),
    { ...input(), bytes: "not bytes" },
    { ...input(), confirmation: { ...input().confirmation, institutionId: "other" } },
    { ...input(), confirmation: { ...input().confirmation, mediaType: "text/html" } },
    { ...input(), confirmation: { ...input().confirmation, token: "synthetic-secret" } },
  ]) await rejected(h.scan(request), "input_invalid");
  await rejected(h.scan({ ...input(), confirmation: { ...input().confirmation, sizeBytes: 1 } }), "digest_mismatch");
  await rejected(h.scan({ ...input(), confirmation: { ...input().confirmation, sha256: "0".repeat(64) } }), "digest_mismatch");
  assert.equal(h.children.length, 0);
});

test("sends the complete ten-megabyte limit without client-side truncation", async () => {
  const request = input(Buffer.alloc(10 * 1024 * 1024, 61));
  const h = harness({ mode: `sha:${request.confirmation.sha256}` });
  assert.equal((await h.scan(request)).status, "clean");
  h.assertReleased();
});

test("returns only a scoped blocked receipt without exposing scanner signatures", async () => {
  const h = harness({ mode: "blocked" });
  const result = await h.scan(input());
  assert.equal(result.status, "blocked");
  assert.equal(result.scanDetail, "antivirus_detected_threat");
  assert.doesNotMatch(JSON.stringify(result), /Synthetic.Test|FOUND/);
  h.assertReleased();
});

test("rejects empty, contradictory, warning and nonzero-clean scanner replies", async () => {
  for (const mode of ["empty", "ambiguous", "warning", "blocked-warning", "wrong-code", "error", "early"]) {
    const h = harness({ mode });
    await rejected(h.scan(input()), "scanner_unavailable");
    h.assertReleased();
  }
});

test("accepts an exact clean reply delivered in several native writes", async () => {
  const h = harness({ mode: "split" });
  assert.equal((await h.scan(input())).status, "clean");
  h.assertReleased();
});

test("kills and reaps timed-out or excessive-output processes before returning", async () => {
  for (const mode of ["hang", "flood", "stderr-flood"]) {
    const h = harness({ mode, timeoutMs: mode === "hang" ? 300 : 5000 });
    await rejected(h.scan(input()), mode === "hang" ? "scan_timeout" : "scanner_unavailable");
    h.assertReleased();
  }
});

test("releases the admission slot after a timeout without queuing extra documents", async () => {
  let spawned;
  const ready = new Promise((resolveReady) => { spawned = resolveReady; });
  const h = harness({ mode: "hang", timeoutMs: 500, concurrency: 1, onSpawn: spawned });
  const first = rejected(h.scan(input()), "scan_timeout");
  await ready;
  await rejected(h.scan(input()), "capacity_exceeded");
  await first;
  await rejected(h.scan(input()), "scan_timeout");
  assert.equal(h.children.length, 2);
  h.assertReleased();
});

test("native missing executable fails closed and cleans its temporary configuration", async () => {
  let directory;
  const scan = createCommunicationInboundScanner({
    executable: join(dirname(process.execPath), "nonexistent-lyceegest-clamdscan"),
    endpoint: { port: 3310 }, timeoutMs: 500,
    spawnImpl(executable, args, options) {
      directory = dirname(args[1]);
      return spawn(executable, args, options);
    },
  });
  await rejected(scan(input()), "scanner_unavailable");
  assert.ok(directory && !existsSync(directory));
});

test("refuses a process that exits before consuming its input", async () => {
  const h = harness({ mode: "abandon" });
  await rejected(h.scan(input(Buffer.alloc(10 * 1024 * 1024))), "scanner_unavailable");
  h.assertReleased();
});

test("accepts a fixed local socket without passing a user filename", async () => {
  const h = harness({ endpoint: { socketPath: "/run/clamav/clamd.sock" } });
  assert.equal((await h.scan(input())).status, "clean");
  h.assertReleased();
});

async function officeBytes(kind, active = false) {
  const entry = { docx: "word/document.xml", xlsx: "xl/workbook.xml", pptx: "ppt/presentation.xml" }[kind];
  const media = {
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  }[kind];
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<Types><Override PartName="/${entry}" ContentType="${media}.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${entry}"/></Relationships>`);
  zip.file(entry, "<document/>");
  if (active) zip.file(`${entry.split("/")[0]}/vbaProject.bin`, "fictional active content");
  return input(await zip.generateAsync({ type: "nodebuffer" }), media);
}

test("validates DOCX, XLSX and PPTX archives even after a nominal clean scan", async () => {
  const h = harness();
  for (const kind of ["docx", "xlsx", "pptx"]) {
    assert.equal((await h.scan(await officeBytes(kind))).status, "clean");
    await rejected(h.scan(await officeBytes(kind, true)), "unsafe_archive");
    const malformed = input(Buffer.from("not a ZIP"), (await officeBytes(kind)).confirmation.mediaType);
    await rejected(h.scan(malformed), "unsafe_archive");
  }
  h.assertReleased();
});

test("snapshots confirmation accessors once before validation and archive inspection", async () => {
  const request = await officeBytes("docx", true);
  const mime = request.confirmation.mediaType;
  let reads = 0;
  Object.defineProperty(request.confirmation, "mediaType", { enumerable: true,
    get() { reads += 1; return reads <= 2 ? mime : "text/plain"; } });
  const h = harness();
  await rejected(h.scan(request), "unsafe_archive");
  assert.equal(reads, 1);
  h.assertReleased();
});

test("captures the input view once and refuses a late oversized getter substitution", async () => {
  const small = Buffer.from("x");
  const large = Buffer.alloc(10 * 1024 * 1024 + 1, 97);
  const request = { confirmation: { ...input(small).confirmation,
    sha256: createHash("sha256").update(large).digest("hex") } };
  let reads = 0;
  Object.defineProperty(request, "bytes", { enumerable: true,
    get() { reads += 1; return reads <= 4 ? small : large; } });
  const h = harness();
  await rejected(h.scan(request), "digest_mismatch");
  assert.equal(reads, 1);
  assert.equal(h.children.length, 0);
});

test("returns an independent confirmation with no copied symbolic fields", () => {
  const source = input().confirmation;
  source[Symbol("private-address")] = "synthetic-secret";
  const result = parseCommunicationInboundQuarantineConfirmation(source);
  assert.notEqual(result, source);
  source.sha256 = "0".repeat(64);
  assert.notEqual(result.sha256, source.sha256);
  assert.equal(Object.getOwnPropertySymbols(result).length, 0);
});

test("keeps scanner isolated from live routes, credentials, database and storage", () => {
  const source = readFileSync(new URL("../workers/communication-inbound-scanner.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /SUPABASE|DATABASE_URL|BREVO|OPENAI|\.upload\(|\.remove\(|pgmq|console\./u);
  const route = readFileSync(new URL("../api/webhooks/brevo/communications-inbound.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /createCommunicationInboundScanner/u);
});
