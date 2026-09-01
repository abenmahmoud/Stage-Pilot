import { performance } from "node:perf_hooks";

const SUPPORT_COOKIE = "bc_support_session";
const TEST_EMAIL_SUFFIX = "@test.invalid";
const MAX_RESPONSE_BYTES = 256 * 1024;

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
  const bytes = new Uint8Array(await response.arrayBuffer());
  invariant(bytes.byteLength <= MAX_RESPONSE_BYTES, "HTTP response is larger than the test contract");
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
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
  invariant(payload.confirmation.status === "persisted", "Persistence was not confirmed");
  invariant(
    payload.confirmation.publicCode === payload.request.publicCode
      && payload.confirmation.confirmationRef === `support:${payload.request.publicCode}`,
    "Persistence confirmation references another request"
  );
  invariant(
    payload.confirmation.confirmedAt === new Date(payload.confirmation.confirmedAt).toISOString(),
    "Persistence confirmation date is not canonical"
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

function percentile(values, percentage) {
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil((percentage / 100) * ordered.length) - 1);
  return Math.round(ordered[index]);
}

invariant(
  process.env.LOAD_TEST_HTTP_EXTERNAL_CONFIRM === "supabase-mcp-preview",
  "The client-only recipe requires an active Supabase preview supervisor"
);
const marker = process.env.LOAD_TEST_HTTP_RUN_MARKER ?? "";
invariant(/^[a-f0-9]{16}$/.test(marker), "LOAD_TEST_HTTP_RUN_MARKER must contain 16 lowercase hex characters");
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

const count = integerSetting("LOAD_TEST_HTTP_COUNT", 200, 1, 500);
const concurrency = integerSetting("LOAD_TEST_HTTP_CONCURRENCY", 20, 1, 25);
const p95TargetMs = integerSetting("LOAD_TEST_HTTP_P95_TARGET_MS", 1500, 500, 5000);
const endpoint = new URL("/api/support/requests", shareUrl.origin);
const fixtures = Array.from({ length: count }, (_, index) => {
  const suffix = String(index + 1).padStart(4, "0");
  return {
    idempotencyKey: `load-http-idempotency-${marker}-${suffix}`,
    deviceId: `load-http-device-${marker}-${suffix}`,
    payload: {
      requesterType: "parent",
      requesterFirstName: "Test",
      requesterLastName: `Charge${suffix}`,
      beneficiaryType: "eleve",
      beneficiaryFirstName: "Eleve",
      beneficiaryLastName: `Fictif${suffix}`,
      category: "ent",
      subject: `Test charge HTTP ${marker} ${suffix}`,
      description: `Demande ENT fictive ${marker} ${suffix}, sans donnée réelle.`,
      preferredChannel: "email",
      fallbackAllowed: false,
      email: `load-http-${marker}-${suffix}${TEST_EMAIL_SUFFIX}`,
    },
  };
});

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
  const latencyMs = performance.now() - startedAt;
  const payload = await readJsonResponse(response);
  invariant(
    response.status === (expectedDuplicate ? 200 : 201),
    `Unexpected creation HTTP ${response.status}: ${String(payload?.error ?? "unknown error")}`
  );
  const publicCode = validateCreationPayload(payload, expectedDuplicate, expectedCode);
  const supportSession = responseCookies(response)
    .find(([name]) => name === SUPPORT_COOKIE)?.[1] ?? null;
  if (!expectedDuplicate) invariant(supportSession, "Creation response did not issue a support session");
  return { publicCode, supportSession, latencyMs };
}

const startedAt = new Date().toISOString();
const previewCookies = await bootstrapPreviewCookies(shareUrl);
const warmup = await fetch(endpoint, {
  headers: { accept: "application/json", cookie: cookieHeader(previewCookies) },
});
invariant(warmup.ok, `Preview API warmup failed with HTTP ${warmup.status}`);
await readJsonResponse(warmup);

const creations = await mapConcurrent(fixtures, concurrency, (fixture) =>
  postFixture(fixture, new Map(previewCookies), false));
invariant(new Set(creations.map((result) => result.publicCode)).size === count,
  "Creation returned duplicate public codes");

const replays = await mapConcurrent(fixtures, concurrency, (fixture, index) => {
  const cookies = new Map(previewCookies);
  cookies.set(SUPPORT_COOKIE, creations[index].supportSession);
  return postFixture(fixture, cookies, true, creations[index].publicCode);
});

const creationLatencies = creations.map((result) => result.latencyMs);
const replayLatencies = replays.map((result) => result.latencyMs);
const metrics = {
  marker,
  startedAt,
  finishedAt: new Date().toISOString(),
  count,
  concurrency,
  httpResponses: count * 2,
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
  p95TargetMs,
  externalSupervisor: "supabase-mcp-preview",
};
console.log(JSON.stringify(metrics));
invariant(
  metrics.creation.p95Ms <= p95TargetMs,
  `Creation p95 ${metrics.creation.p95Ms} ms exceeds target ${p95TargetMs} ms`
);
