import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isAllowedPublicContentSignedUrlForOrigin } from "../shared/public-content-signed-url.ts";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
const articlePage = readFileSync(new URL("../src/pages/prototype/PublicContentPage.tsx", import.meta.url), "utf8");
const client = readFileSync(new URL("../src/pages/prototype/public-content-client.ts", import.meta.url), "utf8");
const markdown = readFileSync(new URL("../src/components/PublicContentMarkdown.tsx", import.meta.url), "utf8");
const contentManager = readFileSync(new URL("../src/pages/admin/ContentManagerPage.tsx", import.meta.url), "utf8");

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
  assert.match(client, /maxBytes: 16 \* 1024 \* 1024/);
});

test("accepts signed media only from the configured private content bucket", () => {
  const origin = "https://school-project.supabase.co";
  const token = "signed-token-value-1234567890";
  const modern = `${origin}/storage/v1/object/sign/site-content/123e4567-e89b-42d3-a456-426614174000/2026/08/123e4567-e89b-42d3-a456-426614174001.pdf?token=${token}`;
  const legacy = `${origin}/storage/v1/object/sign/site-content/legacy-wordpress/42/photo-lycee.jpg?token=${token}`;

  assert.equal(isAllowedPublicContentSignedUrlForOrigin(null, origin), true);
  assert.equal(isAllowedPublicContentSignedUrlForOrigin(modern, origin), true);
  assert.equal(isAllowedPublicContentSignedUrlForOrigin(legacy, origin), true);
  assert.equal(isAllowedPublicContentSignedUrlForOrigin(modern, "http://school-project.supabase.co"), false);
  assert.equal(isAllowedPublicContentSignedUrlForOrigin(modern.replace(origin, "https://other.supabase.co"), origin), false);
  assert.equal(isAllowedPublicContentSignedUrlForOrigin(`${modern}&download=1`, origin), false);
  assert.equal(isAllowedPublicContentSignedUrlForOrigin(`${modern}&token=second-token-value`, origin), false);
  assert.equal(isAllowedPublicContentSignedUrlForOrigin(modern.replace("?token=", "#fragment?token="), origin), false);
  assert.equal(isAllowedPublicContentSignedUrlForOrigin(modern.replace("123e4567-e89b-42d3-a456-426614174001.pdf", "%2e%2e%2fsecret.pdf"), origin), false);
  assert.equal(isAllowedPublicContentSignedUrlForOrigin(modern.replace(token, "x"), origin), false);
  assert.match(client, /isAllowedPublicContentSignedUrlForOrigin\(value, configured\)/);
});

test("validates the dedicated article response and binds it to the requested slug", () => {
  assert.match(articlePage, /readPublicContentPagePayload\(response, slug\)/);
  assert.doesNotMatch(articlePage, /response\.json\(\)/);
  assert.match(client, /payload\.items\.length > 1/);
  assert.match(client, /payload\.nextCursor !== null/);
  assert.match(client, /item && item\.slug !== expectedSlug/);
});

test("renders public markdown through one media and link policy", () => {
  assert.equal(page.match(/<PublicContentMarkdown>/g)?.length, 1);
  assert.equal(articlePage.match(/<PublicContentMarkdown>/g)?.length, 1);
  assert.equal(contentManager.match(/<PublicContentMarkdown>/g)?.length, 1);
  assert.match(markdown, /isAllowedPublicContentSignedUrl\(src\)/);
  assert.match(markdown, /url\.protocol !== "https:"/);
  assert.match(markdown, /\^mailto:/);
  assert.match(markdown, /\^tel:/);
  assert.match(markdown, /loading="lazy"/);
  assert.match(markdown, /referrerPolicy="no-referrer"/);
});
