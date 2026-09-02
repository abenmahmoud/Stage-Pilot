import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../scripts/check-public-pilot-smoke.mjs", import.meta.url),
  "utf8"
);

test("pins the smoke check to the explicit LyceeGest preview alias", () => {
  assert.match(source, /PUBLIC_PILOT_SMOKE_CONFIRM !== "preview-only"/);
  assert.match(source, /PUBLIC_PILOT_SMOKE_EXPECTED_HOST/);
  assert.match(source, /base\.hostname === expectedHost/);
  assert.match(source, /base\.hostname === ALLOWED_HOST/);
  assert.match(source, /lyceegest-git-codex-lycee-connect-prototype-safe-scol\.vercel\.app/);
  assert.doesNotMatch(source, /gestion\.lycee-blaise-cendrars-sevran\.fr/);
});

test("performs only bounded anonymous reads", () => {
  assert.match(source, /method: "GET"/);
  assert.match(source, /redirect: "manual"/);
  assert.match(source, /AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/);
  assert.match(source, /MAX_RESPONSE_BYTES = 512 \* 1024/);
  assert.doesNotMatch(source, /method: "(?:POST|PUT|PATCH|DELETE)"/);
  assert.doesNotMatch(source, /authorization|cookie|service_role|DATABASE_URL/i);
  assert.doesNotMatch(source, /support\/assistant/);
});

test("checks public availability and private authorization boundaries", () => {
  for (const route of [
    "/prototype",
    "/api/content/public",
    "/api/support/requests",
    "/api/support/agent/requests",
    "/api/content/admin",
    "/api/communications/admin",
  ]) assert.ok(source.includes(route), `missing smoke route ${route}`);
  assert.match(source, /request\(base, path, 401, "application\/json"\)/);
  assert.match(source, /cacheControl\.includes\("no-store"\)/);
  assert.match(source, /!cacheControl\.includes\("public"\)/);
  assert.match(source, /writes: 0/);
  assert.match(source, /aiCalls: 0/);
});
