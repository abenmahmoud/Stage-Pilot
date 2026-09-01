import { createHash, createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

const EXPECTED_PROJECT_REF = "xijocumlwivhbmffrnlj";
const EXPECTED_INSTITUTION_SLUG = "blaise-cendrars-sevran";
const SUPPORT_COOKIE = "bc_support_session";
const TEST_EMAIL_SUFFIX = "@test.invalid";
const MAX_RESPONSE_BYTES = 256 * 1024;

async function loadEnvFile(path) {
  let content;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    const rawValue = match[2].trim();
    process.env[match[1]] = rawValue.length >= 2
      && ((rawValue.startsWith('"') && rawValue.endsWith('"'))
        || (rawValue.startsWith("'") && rawValue.endsWith("'")))
      ? rawValue.slice(1, -1)
      : rawValue;
  }
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function integerSetting(name, fallback, minimum, maximum) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
  invariant(
    Number.isInteger(value) && value >= minimum && value <= maximum,
    `${name} must be between ${minimum} and ${maximum}`
  );
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function personalHash(secret, value) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function percentile(values, percentage) {
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil((percentage / 100) * ordered.length) - 1);
  return Math.round(ordered[index]);
}

function splitSetCookieHeader(value) {
  return value.split(/,(?=\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=)/g);
}

function responseCookies(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  return values
    .flatMap(splitSetCookieHeader)
    .flatMap((entry) => {
      const pair = entry.split(";", 1)[0];
      const separator = pair.indexOf("=");
      if (separator < 1) return [];
      return [[pair.slice(0, separator).trim(), pair.slice(separator + 1).trim()]];
    });
}

function cookieHeader(cookies) {
  return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function bootstrapPreviewCookies(shareUrl) {
  const cookies = new Map();
  let target = new URL(shareUrl);
  for (let redirect = 0; redirect < 8; redirect += 1) {
    const response = await fetch(target, {
      redirect: "manual",
      headers: {
        accept: "text/html",
        ...(cookies.size > 0 ? { cookie: cookieHeader(cookies) } : {}),
      },
    });
    for (const [name, value] of responseCookies(response)) cookies.set(name, value);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      invariant(location, "Preview access redirect has no destination");
      target = new URL(location, target);
      continue;
    }
    invariant(response.ok, `Preview access bootstrap failed with HTTP ${response.status}`);
    invariant(cookies.size > 0, "Preview access did not issue an authorization cookie");
    return cookies;
  }
  throw new Error("Preview access followed too many redirects");
}

async function readJsonResponse(response) {
  const declaredLength = Number.parseInt(response.headers.get("content-length") ?? "0", 10);
  invariant(
    !Number.isFinite(declaredLength) || declaredLength <= MAX_RESPONSE_BYTES,
    "HTTP response is larger than the test contract"
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  invariant(bytes.byteLength <= MAX_RESPONSE_BYTES, "HTTP response is larger than the test contract");
  const text = new TextDecoder().decode(bytes);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Preview returned invalid JSON with HTTP ${response.status}`);
  }
}

function exactFields(value, fields, label) {
  invariant(value && typeof value === "object" && !Array.isArray(value), `${label} is invalid`);
  const keys = Object.keys(value);
  invariant(
    keys.length === fields.length && keys.every((key) => fields.includes(key)),
    `${label} has unexpected fields`
  );
}

function validateCreationPayload(payload, expectedDuplicate, expectedCode = null) {
  exactFields(payload, ["request", "confirmation", "agentAction", "duplicate"], "creation payload");
  exactFields(payload.request, ["publicCode", "status", "createdAt"], "created request");
  exactFields(
    payload.confirmation,
    ["status", "publicCode", "confirmedAt", "confirmationRef"],
    "persistence confirmation"
  );
  invariant(payload.duplicate === expectedDuplicate, "Idempotency flag is incorrect");
  invariant(/^BC-[0-9]{4}-[0-9]{6}$/.test(payload.request.publicCode), "Public code is invalid");
  if (expectedCode) invariant(payload.request.publicCode === expectedCode, "Idempotent code changed");
  invariant(
    typeof payload.request.status === "string" && payload.request.status.length <= 40,
    "Created status is invalid"
  );
  invariant(Number.isFinite(Date.parse(payload.request.createdAt)), "Created date is invalid");
  invariant(payload.confirmation.status === "persisted", "Persistence was not confirmed");
  invariant(
    payload.confirmation.publicCode === payload.request.publicCode,
    "Confirmation references another request"
  );
  invariant(
    payload.confirmation.confirmationRef === `support:${payload.request.publicCode}`,
    "Confirmation reference is invalid"
  );
  invariant(
    payload.confirmation.confirmedAt === new Date(payload.confirmation.confirmedAt).toISOString(),
    "Confirmation date is not canonical"
  );
  invariant(payload.agentAction === null, "The load test must not execute an agent action");
  return payload.request.publicCode;
}

async function mapConcurrent(items, concurrency, operation) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await operation(items[index], index);
    }
  }));
  return results;
}

function networkSnapshot(rows) {
  return new Map(rows.map((row) => [row.key_hash, {
    keyHash: row.key_hash,
    windowStartedAt: row.window_started_at,
    requestCount: Number(row.request_count),
    expiresAt: row.expires_at,
  }]));
}

function sameNetworkRow(left, right) {
  return left.windowStartedAt === right.windowStartedAt
    && left.requestCount === right.requestCount
    && left.expiresAt === right.expiresAt;
}

await loadEnvFile(process.env.PREVIEW_ENV_FILE ?? ".env.preview.runtime.local");

invariant(
  process.env.LOAD_TEST_HTTP_CONFIRM === "preview-only",
  "Set LOAD_TEST_HTTP_CONFIRM=preview-only after checking the isolated preview"
);
invariant(
  process.env.LOAD_TEST_HTTP_EXPECTED_PROJECT_REF === EXPECTED_PROJECT_REF,
  "LOAD_TEST_HTTP_EXPECTED_PROJECT_REF does not identify the approved preview database"
);

const shareUrl = new URL(process.env.LOAD_TEST_HTTP_SHARE_URL ?? "https://invalid.local/");
const expectedHost = process.env.LOAD_TEST_HTTP_EXPECTED_HOST ?? "";
invariant(shareUrl.protocol === "https:", "The preview URL must use HTTPS");
invariant(shareUrl.hostname === expectedHost, "The preview URL does not match LOAD_TEST_HTTP_EXPECTED_HOST");
invariant(
  shareUrl.hostname.endsWith(".vercel.app")
    && shareUrl.hostname.startsWith("lyceegest-")
    && !shareUrl.hostname.includes("-git-")
    && !shareUrl.hostname.includes("lycee-blaise-cendrars-sevran.fr"),
  "The HTTP load test requires one immutable Vercel preview"
);
invariant(shareUrl.pathname === "/", "The share URL must target the preview root");
invariant(
  [...shareUrl.searchParams.keys()].every((key) => key === "_vercel_share"),
  "The share URL contains an unexpected parameter"
);
invariant(
  /^[A-Za-z0-9_-]{20,200}$/.test(shareUrl.searchParams.get("_vercel_share") ?? ""),
  "The preview share token is missing or invalid"
);

const databaseUrl = process.env.LOAD_TEST_HTTP_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
invariant(databaseUrl !== "[SENSITIVE]", "Load the real preview database URL outside the repository");
const parsedDatabaseUrl = new URL(databaseUrl);
invariant(
  [parsedDatabaseUrl.hostname, parsedDatabaseUrl.username].some((value) =>
    value.includes(EXPECTED_PROJECT_REF)),
  "The database URL does not match the approved preview project"
);
const institutionSlug = process.env.LOAD_TEST_HTTP_INSTITUTION_SLUG
  ?? process.env.SUPPORT_INSTITUTION_SLUG
  ?? "";
invariant(
  institutionSlug === EXPECTED_INSTITUTION_SLUG,
  "The load test institution is not the approved preview tenant"
);
const hashSecret = process.env.SUPPORT_HASH_SECRET ?? "";
invariant(hashSecret.length >= 32, "SUPPORT_HASH_SECRET is unavailable");

const count = integerSetting("LOAD_TEST_HTTP_COUNT", 200, 1, 500);
const concurrency = integerSetting("LOAD_TEST_HTTP_CONCURRENCY", 20, 1, 25);
const p95TargetMs = integerSetting("LOAD_TEST_HTTP_P95_TARGET_MS", 1500, 500, 5000);
const runId = randomUUID().replaceAll("-", "");
const marker = runId.slice(0, 16);
const endpoint = new URL("/api/support/requests", shareUrl.origin);
const sql = postgres(databaseUrl, { prepare: false, max: 4, connect_timeout: 10, idle_timeout: 10 });
const runStartedAt = Date.now();
let institutionId = null;
let initialNetworkRows = new Map();
let completedPostResponses = 0;
let mainError = null;
let cleanupError = null;

const fixtures = Array.from({ length: count }, (_, index) => {
  const suffix = String(index + 1).padStart(4, "0");
  const deviceId = `load-http-device-${marker}-${suffix}`;
  const email = `load-http-${marker}-${suffix}${TEST_EMAIL_SUFFIX}`;
  const subject = `Test charge HTTP ${marker} ${suffix}`;
  const description = `Demande ENT fictive ${marker} ${suffix}, sans donnée réelle.`;
  const idempotencyKey = `load-http-idempotency-${marker}-${suffix}`;
  const deviceRateHash = personalHash(hashSecret, `support-device:${deviceId}`);
  const contactRateHash = personalHash(hashSecret, `support-contact:${email}`);
  const fingerprint = sha256(JSON.stringify([
    "ent",
    subject.toLocaleLowerCase("fr-FR").replace(/\s+/g, " ").trim(),
    description.toLocaleLowerCase("fr-FR").replace(/\s+/g, " ").trim(),
  ]));
  const behaviorRateHash = personalHash(
    hashSecret,
    `support-repeat:${deviceRateHash}:${fingerprint}`
  );
  return {
    idempotencyKey,
    idempotencyHash: sha256(idempotencyKey),
    deviceId,
    deviceRateHash,
    contactRateHash,
    behaviorRateHash,
    payload: {
      requesterType: "parent",
      requesterFirstName: "Test",
      requesterLastName: `Charge${suffix}`,
      beneficiaryType: "eleve",
      beneficiaryFirstName: "Eleve",
      beneficiaryLastName: `Fictif${suffix}`,
      category: "ent",
      subject,
      description,
      preferredChannel: "email",
      fallbackAllowed: false,
      email,
    },
  };
});

const idempotencyHashes = fixtures.map((fixture) => fixture.idempotencyHash);
const knownRatePairs = fixtures.flatMap((fixture) => [
  ["request_device_burst", fixture.deviceRateHash],
  ["request_device_daily", fixture.deviceRateHash],
  ["request_contact_burst", fixture.contactRateHash],
  ["request_contact_daily", fixture.contactRateHash],
  ["request_behavior_repeat", fixture.behaviorRateHash],
]);
const knownRateHashes = [...new Set(knownRatePairs.map(([, keyHash]) => keyHash))];

async function ownRequestIds() {
  if (!institutionId) return [];
  const rows = await sql`
    select id::text
    from public.support_requests
    where institution_id = ${institutionId}
      and idempotency_key_hash = any(${idempotencyHashes}::text[])
  `;
  return rows.map((row) => row.id);
}

async function stateCounts() {
  const [row] = await sql`
    with selected as (
      select id
      from public.support_requests
      where institution_id = ${institutionId}
        and idempotency_key_hash = any(${idempotencyHashes}::text[])
    ), notification_jobs as (
      select message ->> 'request_id' as request_id, message ->> 'job_id' as job_id
      from pgmq.q_support_jobs
      where message ->> 'request_id' in (select id::text from selected)
      union
      select message ->> 'request_id', message ->> 'job_id'
      from pgmq.a_support_jobs
      where message ->> 'request_id' in (select id::text from selected)
      union
      select request_id::text, job_id::text
      from public.support_job_runs
      where request_id in (select id from selected)
      union
      select request_id::text, job_id::text
      from public.support_failed_jobs
      where request_id in (select id from selected)
    ), jobs_per_request as (
      select request_id, count(distinct job_id)::int as job_count
      from notification_jobs
      group by request_id
    )
    select
      (select count(*)::int from selected) as requests,
      (select count(*)::int from public.support_contacts
        where request_id in (select id from selected)) as contacts,
      (select count(*)::int from public.support_messages
        where request_id in (select id from selected)) as messages,
      (select count(*)::int from public.support_magic_tokens
        where request_id in (select id from selected)) as magic_tokens,
      (select count(*)::int from public.support_session_requests
        where request_id in (select id from selected)) as session_links,
      (select count(distinct session_id)::int from public.support_session_requests
        where request_id in (select id from selected)) as sessions,
      (select count(distinct job_id)::int from notification_jobs) as notification_jobs,
      coalesce((select min(job_count)::int from jobs_per_request), 0) as min_jobs_per_request,
      coalesce((select max(job_count)::int from jobs_per_request), 0) as max_jobs_per_request,
      (select count(*)::int from public.support_job_runs
        where request_id in (select id from selected)
          and status = 'success'
          and provider_reference <> 'skipped:test_address') as external_provider_successes
  `;
  return row;
}

function assertExpectedState(state) {
  invariant(state.requests === count, `Expected ${count} requests, received ${state.requests}`);
  invariant(state.contacts === count, "Contact count is incorrect");
  invariant(state.messages === count, "Message count is incorrect");
  invariant(state.magic_tokens === count, "Magic-token count is incorrect");
  invariant(state.session_links === count, "Session-link count is incorrect");
  invariant(state.sessions === count, "Device-session count is incorrect");
  invariant(state.notification_jobs === count * 2, "Notification jobs are missing or duplicated");
  invariant(
    state.min_jobs_per_request === 2 && state.max_jobs_per_request === 2,
    "Each request must own exactly two notification jobs"
  );
  invariant(
    state.external_provider_successes === 0,
    "A fictitious request reached an external email provider"
  );
}

async function postFixture(fixture, cookies, expectedDuplicate, expectedCode = null) {
  const startedAt = performance.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      cookie: cookieHeader(cookies),
      "idempotency-key": fixture.idempotencyKey,
      "x-support-device": fixture.deviceId,
    },
    body: JSON.stringify(fixture.payload),
  });
  completedPostResponses += 1;
  const latencyMs = performance.now() - startedAt;
  const payload = await readJsonResponse(response);
  invariant(
    response.status === (expectedDuplicate ? 200 : 201),
    `Unexpected creation HTTP ${response.status}: ${String(payload?.error ?? "unknown error")}`
  );
  const publicCode = validateCreationPayload(payload, expectedDuplicate, expectedCode);
  const setCookies = responseCookies(response);
  const supportSession = setCookies.find(([name]) => name === SUPPORT_COOKIE)?.[1] ?? null;
  for (const [name, value] of setCookies) {
    if (name !== SUPPORT_COOKIE) cookies.set(name, value);
  }
  if (!expectedDuplicate) invariant(supportSession, "Creation response did not issue a support session");
  return { publicCode, supportSession, latencyMs };
}

async function restoreNetworkRateLimits() {
  const after = networkSnapshot(await sql`
    select key_hash, window_started_at::text, request_count::int, expires_at::text
    from public.support_rate_limits
    where scope = 'request_network'
  `);
  const newKeys = [...after.keys()].filter((keyHash) => !initialNetworkRows.has(keyHash));
  if (newKeys.length > 0) {
    await sql`
      delete from public.support_rate_limits
      where scope = 'request_network' and key_hash = any(${newKeys}::text[])
    `;
  }
  const changedExisting = [...after.values()].filter((row) => {
    const before = initialNetworkRows.get(row.keyHash);
    return before && !sameNetworkRow(before, row);
  });
  for (const row of changedExisting) {
    const before = initialNetworkRows.get(row.keyHash);
    const activeIncrement = before.expiresAt > new Date(runStartedAt).toISOString()
      && row.windowStartedAt === before.windowStartedAt
      && row.expiresAt === before.expiresAt
      && row.requestCount - before.requestCount === completedPostResponses;
    const expiredReset = before.expiresAt <= new Date(runStartedAt).toISOString()
      && row.requestCount === completedPostResponses;
    invariant(
      activeIncrement || expiredReset,
      "A pre-existing network limit changed outside the isolated load-test contract"
    );
    await sql`
      update public.support_rate_limits
      set window_started_at = ${before.windowStartedAt}::timestamptz,
          request_count = ${before.requestCount},
          expires_at = ${before.expiresAt}::timestamptz
      where scope = 'request_network' and key_hash = ${before.keyHash}
    `;
  }
}

async function cleanupOwnData() {
  const requestIds = await ownRequestIds();
  let sessionIds = [];
  if (requestIds.length > 0) {
    const sessions = await sql`
      select distinct session_id::text as id
      from public.support_session_requests
      where request_id = any(${requestIds}::uuid[])
    `;
    sessionIds = sessions.map((row) => row.id);
    await sql`
      delete from pgmq.q_support_jobs
      where message ->> 'request_id' = any(${requestIds}::text[])
    `;
    await sql`
      delete from pgmq.a_support_jobs
      where message ->> 'request_id' = any(${requestIds}::text[])
    `;
    await sql`
      delete from public.support_requests
      where institution_id = ${institutionId} and id = any(${requestIds}::uuid[])
    `;
  }
  if (sessionIds.length > 0) {
    await sql`
      delete from public.support_device_sessions
      where id = any(${sessionIds}::uuid[])
    `;
  }
  await sql`
    delete from public.support_rate_limits
    where key_hash = any(${knownRateHashes}::text[])
      and scope in (
        'request_device_burst', 'request_device_daily',
        'request_contact_burst', 'request_contact_daily', 'request_behavior_repeat'
      )
  `;
  await restoreNetworkRateLimits();

  const remainingIds = await ownRequestIds();
  const remainingSessions = sessionIds.length === 0 ? [] : await sql`
    select id from public.support_device_sessions where id = any(${sessionIds}::uuid[])
  `;
  const [remainingRates] = await sql`
    select count(*)::int as count
    from public.support_rate_limits
    where key_hash = any(${knownRateHashes}::text[])
  `;
  const finalNetworkRows = networkSnapshot(await sql`
    select key_hash, window_started_at::text, request_count::int, expires_at::text
    from public.support_rate_limits
    where scope = 'request_network'
  `);
  invariant(remainingIds.length === 0, "Synthetic support requests remain after cleanup");
  invariant(remainingSessions.length === 0, "Synthetic support sessions remain after cleanup");
  invariant(remainingRates.count === 0, "Synthetic rate-limit keys remain after cleanup");
  invariant(
    finalNetworkRows.size === initialNetworkRows.size
      && [...initialNetworkRows.entries()].every(([keyHash, row]) => {
        const finalRow = finalNetworkRows.get(keyHash);
        return finalRow && sameNetworkRow(row, finalRow);
      }),
    "Network rate limits were not restored to their initial state"
  );
}

try {
  const [institution] = await sql`
    select id
    from public.institutions
    where slug = ${institutionSlug} and status in ('pilot', 'active')
    limit 1
  `;
  invariant(institution, "The preview institution is unavailable");
  institutionId = institution.id;
  const unexpectedRateRows = await sql`
    select scope, key_hash
    from public.support_rate_limits
    where key_hash = any(${knownRateHashes}::text[])
  `;
  invariant(unexpectedRateRows.length === 0, "Synthetic rate-limit keys already exist");
  initialNetworkRows = networkSnapshot(await sql`
    select key_hash, window_started_at::text, request_count::int, expires_at::text
    from public.support_rate_limits
    where scope = 'request_network'
  `);

  const previewCookies = await bootstrapPreviewCookies(shareUrl);
  const warmup = await fetch(endpoint, {
    headers: { accept: "application/json", cookie: cookieHeader(previewCookies) },
  });
  invariant(warmup.ok, `Preview API warmup failed with HTTP ${warmup.status}`);
  await readJsonResponse(warmup);

  const creations = await mapConcurrent(fixtures, concurrency, (fixture) =>
    postFixture(fixture, new Map(previewCookies), false));
  const creationState = await stateCounts();
  assertExpectedState(creationState);

  const replays = await mapConcurrent(fixtures, concurrency, (fixture, index) => {
    const cookies = new Map(previewCookies);
    cookies.set(SUPPORT_COOKIE, creations[index].supportSession);
    return postFixture(fixture, cookies, true, creations[index].publicCode);
  });
  const replayState = await stateCounts();
  assertExpectedState(replayState);

  const creationLatencies = creations.map((result) => result.latencyMs);
  const replayLatencies = replays.map((result) => result.latencyMs);
  const metrics = {
    count,
    concurrency,
    httpResponses: completedPostResponses,
    creation: {
      p50Ms: percentile(creationLatencies, 50),
      p95Ms: percentile(creationLatencies, 95),
      p99Ms: percentile(creationLatencies, 99),
      maxMs: Math.round(Math.max(...creationLatencies)),
    },
    replay: {
      p50Ms: percentile(replayLatencies, 50),
      p95Ms: percentile(replayLatencies, 95),
      p99Ms: percentile(replayLatencies, 99),
      maxMs: Math.round(Math.max(...replayLatencies)),
    },
    persistence: replayState,
    p95TargetMs,
    externalEmailsSent: 0,
  };
  invariant(
    metrics.creation.p95Ms <= p95TargetMs,
    `Creation p95 ${metrics.creation.p95Ms} ms exceeds target ${p95TargetMs} ms`
  );
  console.log(JSON.stringify(metrics));
} catch (error) {
  mainError = error;
} finally {
  try {
    await cleanupOwnData();
  } catch (error) {
    cleanupError = error;
  }
  await sql.end({ timeout: 5 });
}

if (cleanupError) {
  throw new Error(`HTTP load-test cleanup failed: ${cleanupError.message}`, {
    cause: mainError ?? cleanupError,
  });
}
if (mainError) throw mainError;
