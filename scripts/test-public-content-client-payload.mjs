import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");

test("routes the initial and paginated public feed through one validator", () => {
  assert.match(page, /fetch\("\/api\/content\/public"\)\s*\.then\(readPublicContentPayload\)/);
  assert.match(page, /const payload = await readPublicContentPayload\(response\)/);
  const read = page.indexOf("async function readPublicContentPayload");
  const unknown = page.indexOf("readApiResponse<unknown>", read);
  const validation = page.indexOf("if (!isPublicContentPayload(payload))", unknown);
  assert.ok(read < unknown && unknown < validation);
});

test("bounds every public item, asset and cursor", () => {
  assert.match(page, /value\.items\.length > 100/);
  assert.match(page, /value\.assets\.length <= 20/);
  assert.match(page, /kindMatchesMime/);
  assert.match(page, /isBoundedString\(value\.bodyMarkdown, 30_000, true\)/);
  assert.match(page, /value\.audience === "tous"/);
  assert.match(page, /isBoundedString\(value\.nextCursor, 512\)/);
  assert.match(page, /new Set\(slugs\)\.size === slugs\.length/);
});

test("accepts signed media only from the configured private content bucket", () => {
  assert.match(page, /url\.protocol === "https:"/);
  assert.match(page, /url\.origin === supabaseUrl\.origin/);
  assert.match(page, /url\.pathname\.startsWith\("\/storage\/v1\/object\/sign\/site-content\/"\)/);
  assert.match(page, /url\.searchParams\.has\("token"\)/);
});
