import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
const articlePage = readFileSync(new URL("../src/pages/prototype/PublicContentPage.tsx", import.meta.url), "utf8");
const client = readFileSync(new URL("../src/pages/prototype/public-content-client.ts", import.meta.url), "utf8");

test("routes the initial and paginated public feed through one validator", () => {
  assert.equal(page.match(/\.then\(readPublicContentPayload\)/g)?.length, 2);
  assert.match(page, /const payload = await readPublicContentPayload\(response\)/);
  const read = client.indexOf("export async function readPublicContentPayload");
  const unknown = client.indexOf("readJsonApiResponse<unknown>", read);
  const validation = client.indexOf("if (!isPublicContentPayload(payload))", unknown);
  assert.ok(read < unknown && unknown < validation);
});

test("validates both news and school-page consumers", () => {
  const school = page.indexOf("function SchoolView");
  const fetch = page.indexOf('fetch("/api/content/public", { signal: controller.signal })', school);
  const validation = page.indexOf(".then(readPublicContentPayload)", fetch);
  const update = page.indexOf("setPublishedPages", validation);
  assert.notEqual(school, -1);
  assert.ok(school < fetch && fetch < validation && validation < update);
});

test("bounds every public item, asset and cursor", () => {
  assert.match(client, /value\.items\.length > 100/);
  assert.match(client, /value\.assets\.length <= 20/);
  assert.match(client, /kindMatchesMime/);
  assert.match(client, /isBoundedString\(value\.bodyMarkdown, 30_000, true\)/);
  assert.match(client, /value\.audience === "tous"/);
  assert.match(client, /isBoundedString\(value\.nextCursor, 512\)/);
  assert.match(client, /new Set\(slugs\)\.size === slugs\.length/);
});

test("accepts signed media only from the configured private content bucket", () => {
  assert.match(client, /url\.protocol === "https:"/);
  assert.match(client, /url\.origin === supabaseUrl\.origin/);
  assert.match(client, /url\.pathname\.startsWith\("\/storage\/v1\/object\/sign\/site-content\/"\)/);
  assert.match(client, /url\.searchParams\.has\("token"\)/);
});

test("validates the dedicated article response and binds it to the requested slug", () => {
  assert.match(articlePage, /readPublicContentPagePayload\(response, slug\)/);
  assert.doesNotMatch(articlePage, /response\.json\(\)/);
  assert.match(client, /payload\.items\.length > 1/);
  assert.match(client, /payload\.nextCursor !== null/);
  assert.match(client, /item && item\.slug !== expectedSlug/);
});
