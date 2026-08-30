import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readJsonApiResponse } from "../shared/json-api-response.ts";
import { readBoundedJsonResponse } from "../workers/bounded-download.mjs";

const apiSource = readFileSync(new URL("../api/_shared/brevo.ts", import.meta.url), "utf8");
const workerSource = readFileSync(new URL("../workers/support-email-worker.mjs", import.meta.url), "utf8");

test("borne les accusés Brevo dans l'API et le worker", () => {
  assert.match(apiSource, /BREVO_RESPONSE_MAX_BYTES = 256 \* 1024/);
  assert.match(apiSource, /requireOk: false/);
  assert.doesNotMatch(apiSource, /response\.json\(\)/);
  assert.match(workerSource, /brevoResponseMaxBytes = 256 \* 1024/);
  assert.match(workerSource, /readBoundedJsonResponse/);
  assert.doesNotMatch(workerSource, /response\.json\(\)/);
});

test("conserve un accusé d'idempotence HTTP 400 borné", async () => {
  const response = new Response(JSON.stringify({ code: "duplicate_parameter" }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
  const payload = await readJsonApiResponse(response, { maxBytes: 1024, requireOk: false });
  assert.deepEqual(payload, { code: "duplicate_parameter" });
});

test("le worker conserve aussi l'accusé HTTP 400", async () => {
  const response = new Response(JSON.stringify({ code: "duplicate_parameter" }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
  const payload = await readBoundedJsonResponse(response, 1024);
  assert.deepEqual(payload, { code: "duplicate_parameter" });
});

test("refuse les accusés annoncés ou réellement surdimensionnés", async () => {
  await assert.rejects(
    () => readJsonApiResponse(new Response("{}", {
      headers: { "content-length": "1025", "content-type": "application/json" },
    }), { maxBytes: 1024, requireOk: false }),
    /réponse du service est invalide/u
  );

  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"message":"'));
      controller.enqueue(new Uint8Array(700).fill(0x61));
      controller.enqueue(new Uint8Array(700).fill(0x62));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    () => readBoundedJsonResponse(new Response(body), 1024),
    /download_size_invalid/
  );
  assert.equal(cancelled, true);
});
