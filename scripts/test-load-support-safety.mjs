import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../scripts/load-test-support.mjs", import.meta.url),
  "utf8"
);
const httpSource = await readFile(
  new URL("../scripts/load-test-support-http.mjs", import.meta.url),
  "utf8"
);
const httpClientSource = await readFile(
  new URL("../scripts/load-test-support-http-client.mjs", import.meta.url),
  "utf8"
);

test("refuses any target that is not explicitly confirmed as preview", () => {
  assert.match(source, /LOAD_TEST_CONFIRM !== "preview-only"/);
  assert.match(source, /LOAD_TEST_EXPECTED_PROJECT_REF/);
  assert.match(source, /connectionString\.includes\(expectedProjectRef\)/);
});

test("binds all synthetic requests and queue payloads to one named institution", () => {
  assert.match(source, /LOAD_TEST_INSTITUTION_SLUG/);
  assert.match(source, /status in \('pilot', 'active'\)/);
  assert.match(source, /institution_id, idempotency_key_hash/);
  assert.match(source, /'institution_id', \$\{institutionId\}::uuid/);
});

test("scopes counts and cleanup to the synthetic run and institution", () => {
  assert.match(source, /r\.institution_id = \$\{institutionId\}/);
  assert.match(
    source,
    /delete from public\.support_requests[\s\S]*institution_id = \$\{institutionId\}[\s\S]*idempotency_key_hash like/
  );
  assert.match(source, /pgmq\.create\(\$\{queueName\}\)/);
  assert.match(source, /pgmq\.drop_queue\(\$\{queueName\}\)/);
});

test("proves one winner when concurrent requests reuse the same key", () => {
  assert.match(source, /const raceKey = `\$\{prefix\}race-key`/);
  assert.match(source, /on conflict do nothing[\s\S]*returning id/);
  assert.match(source, /const raceWinners = raceResults\.filter\(Boolean\)\.length/);
  assert.match(source, /raceWinners !== 1/);
  assert.match(source, /result\.race_requests !== 1/);
  assert.match(source, /result\.jobs !== count \+ 1/);
});

test("pins the HTTP recipe to one immutable protected preview", () => {
  assert.match(httpSource, /LOAD_TEST_HTTP_CONFIRM === "preview-only"/);
  assert.match(httpSource, /EXPECTED_PROJECT_REF = "xijocumlwivhbmffrnlj"/);
  assert.match(httpSource, /LOAD_TEST_HTTP_EXPECTED_PROJECT_REF === EXPECTED_PROJECT_REF/);
  assert.match(httpSource, /shareUrl\.hostname === expectedHost/);
  assert.match(httpSource, /endsWith\("\.vercel\.app"\)/);
  assert.match(httpSource, /!shareUrl\.hostname\.includes\("-git-"\)/);
  assert.match(httpSource, /shareUrl\.searchParams\.get\("_vercel_share"\)/);
});

test("bounds the HTTP volume and uses only worker-neutralized addresses", () => {
  assert.match(httpSource, /LOAD_TEST_HTTP_COUNT", 200, 1, 500/);
  assert.match(httpSource, /LOAD_TEST_HTTP_CONCURRENCY", 20, 1, 25/);
  assert.match(httpSource, /TEST_EMAIL_SUFFIX = "@test\.invalid"/);
  assert.doesNotMatch(httpSource, /@gmail\.com|@ac-creteil\.fr|@lycee-blaise-cendrars-sevran\.fr/);
  assert.match(httpSource, /external_provider_successes === 0/);
});

test("measures full HTTP idempotency and enforces the documented p95 target", () => {
  assert.match(httpSource, /postFixture\(fixture, new Map\(previewCookies\), false\)/);
  assert.match(httpSource, /postFixture\(fixture, cookies, true, creations\[index\]\.publicCode\)/);
  assert.match(httpSource, /state\.notification_jobs === count \* 2/);
  assert.match(httpSource, /state\.min_jobs_per_request === 2 && state\.max_jobs_per_request === 2/);
  assert.match(httpSource, /LOAD_TEST_HTTP_P95_TARGET_MS", 1500/);
  assert.match(httpSource, /metrics\.creation\.p95Ms <= p95TargetMs/);
});

test("cleans only its requests, sessions, queue jobs and pseudonymous limits", () => {
  assert.match(httpSource, /idempotency_key_hash = any\(\$\{idempotencyHashes\}::text\[\]\)/);
  assert.match(httpSource, /delete from pgmq\.q_support_jobs/);
  assert.match(httpSource, /delete from pgmq\.a_support_jobs/);
  assert.match(httpSource, /delete from public\.support_requests/);
  assert.match(httpSource, /delete from public\.support_device_sessions/);
  assert.match(httpSource, /delete from public\.support_rate_limits/);
  assert.match(httpSource, /restoreNetworkRateLimits\(\)/);
  assert.match(httpSource, /HTTP load-test cleanup failed/);
});

test("requires an explicit external preview supervisor when secrets stay redacted", () => {
  assert.match(httpClientSource, /LOAD_TEST_HTTP_EXTERNAL_CONFIRM === "supabase-mcp-preview"/);
  assert.match(httpClientSource, /LOAD_TEST_HTTP_RUN_MARKER/);
  assert.match(httpClientSource, /\^\[a-f0-9\]\{16\}\$/);
  assert.match(httpClientSource, /shareUrl\.hostname === expectedHost/);
  assert.match(httpClientSource, /!shareUrl\.hostname\.includes\("-git-"\)/);
  assert.match(httpClientSource, /TEST_EMAIL_SUFFIX = "@test\.invalid"/);
  assert.doesNotMatch(httpClientSource, /DATABASE_URL|SUPPORT_HASH_SECRET/);
});

test("the supervised client still performs and validates every idempotent replay", () => {
  assert.match(httpClientSource, /LOAD_TEST_HTTP_COUNT", 200, 1, 500/);
  assert.match(httpClientSource, /LOAD_TEST_HTTP_CONCURRENCY", 20, 1, 25/);
  assert.match(httpClientSource, /postFixture\(fixture, new Map\(previewCookies\), false\)/);
  assert.match(httpClientSource, /postFixture\(fixture, cookies, true, creations\[index\]\.publicCode\)/);
  assert.match(httpClientSource, /new Set\(creations\.map/);
  assert.match(httpClientSource, /metrics\.creation\.p95Ms <= p95TargetMs/);
});
