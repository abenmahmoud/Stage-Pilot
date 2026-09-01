import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  boundedBlobToBuffer,
  readBoundedResponseBytes,
} from "../workers/bounded-download.mjs";

const workers = [
  "support-file-worker.mjs",
  "communication-document-worker.mjs",
  "identity-directory-worker.mjs",
  "knowledge-document-worker.mjs",
  "schedule-document-worker.mjs",
  "site-content-file-worker.mjs",
];

test("contrôle les six workers avant toute copie complète en mémoire", () => {
  for (const worker of workers) {
    const source = readFileSync(new URL(`../workers/${worker}`, import.meta.url), "utf8");
    assert.match(source, /boundedBlobToBuffer|readBoundedResponseBytes/);
    assert.doesNotMatch(source, /\.arrayBuffer\(\)/);
  }
});

test("refuse un Blob trop grand ou incohérent avant arrayBuffer", async () => {
  let readCalled = false;
  const fakeBlob = {
    size: 11,
    async arrayBuffer() {
      readCalled = true;
      return new Uint8Array(11).buffer;
    },
  };
  await assert.rejects(() => boundedBlobToBuffer(fakeBlob, 11, 10), /download_size_invalid/);
  await assert.rejects(() => boundedBlobToBuffer(fakeBlob, 10, 20), /download_size_invalid/);
  assert.equal(readCalled, false);
});

test("accepte un Blob dont la taille correspond au registre", async () => {
  const blob = new Blob([new Uint8Array([1, 2, 3, 4])]);
  const bytes = await boundedBlobToBuffer(blob, 4, 10);
  assert.deepEqual([...bytes], [1, 2, 3, 4]);
});

test("refuse une réponse annoncée trop grande avant lecture", async () => {
  await assert.rejects(
    () => readBoundedResponseBytes(new Response("x", {
      headers: { "content-length": "11" },
    }), 10),
    /download_size_invalid/
  );
});

test("annule une réponse chunkée dès le dépassement", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(6));
      controller.enqueue(new Uint8Array(6));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    () => readBoundedResponseBytes(new Response(body), 10),
    /download_size_invalid/
  );
  assert.equal(cancelled, true);
});
