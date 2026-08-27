import assert from "node:assert/strict";
import test from "node:test";
import {
  assertLegacyMediaType,
  isPostgresUniqueViolation,
  readLimitedResponseBytes,
} from "../shared/legacy-import.ts";

test("accepts the declared response media type", () => {
  assert.doesNotThrow(() => assertLegacyMediaType("image/jpeg", "image/jpeg; charset=binary"));
});

test("rejects a response whose media type changed", () => {
  assert.throws(() => assertLegacyMediaType("image/jpeg", "text/html"), /Type de fichier inattendu/);
});

test("rejects an oversized declared response before reading it", async () => {
  const response = new Response(new Uint8Array([1]), { headers: { "content-length": "11" } });
  await assert.rejects(() => readLimitedResponseBytes(response, 10), /Taille refusée/);
});

test("stops a streamed response that exceeds the real limit", async () => {
  const response = new Response(new Uint8Array(11));
  await assert.rejects(() => readLimitedResponseBytes(response, 10), /Taille refusée/);
});

test("returns a bounded media response", async () => {
  const bytes = await readLimitedResponseBytes(new Response(new Uint8Array([1, 2, 3])), 10);
  assert.deepEqual([...bytes], [1, 2, 3]);
});

test("detects a nested Postgres unique violation", () => {
  assert.equal(isPostgresUniqueViolation({ cause: { code: "23505" } }), true);
  assert.equal(isPostgresUniqueViolation({ code: "22001" }), false);
});
