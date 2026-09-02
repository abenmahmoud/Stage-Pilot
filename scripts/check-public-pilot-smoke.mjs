import assert from "node:assert/strict";

const MAX_RESPONSE_BYTES = 512 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const ALLOWED_HOST = "lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function exactFields(value, fields, label) {
  invariant(value && typeof value === "object" && !Array.isArray(value), `${label}_invalid`);
  const keys = Object.keys(value);
  invariant(
    keys.length === fields.length && keys.every((key) => fields.includes(key)),
    `${label}_unexpected_fields`
  );
}

async function readBounded(response, expectedType) {
  const declaredLength = Number.parseInt(response.headers.get("content-length") ?? "0", 10);
  invariant(
    !Number.isFinite(declaredLength) || declaredLength <= MAX_RESPONSE_BYTES,
    "response_too_large"
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  invariant(bytes.byteLength <= MAX_RESPONSE_BYTES, "response_too_large");
  const contentType = response.headers.get("content-type") ?? "";
  invariant(contentType.toLowerCase().includes(expectedType), "response_content_type_invalid");
  return new TextDecoder().decode(bytes);
}

async function request(base, path, expectedStatus, expectedType) {
  const startedAt = performance.now();
  const response = await fetch(new URL(path, base), {
    method: "GET",
    redirect: "manual",
    headers: {
      accept: expectedType === "application/json" ? "application/json" : "text/html",
      "user-agent": "LyceeGest-Public-Pilot-Smoke/1.0",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  invariant(response.status === expectedStatus, `${path}_http_${response.status}`);
  const body = await readBounded(response, expectedType);
  return {
    body,
    headers: response.headers,
    latencyMs: Math.round(performance.now() - startedAt),
  };
}

function assertBrowserHeaders(headers) {
  assert.equal(headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.equal(headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  const csp = headers.get("content-security-policy") ?? "";
  for (const directive of [
    "default-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ]) invariant(csp.includes(directive), `csp_missing_${directive}`);
}

function parseJson(body, label) {
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${label}_invalid_json`);
  }
}

function assertNoStore(headers) {
  const cacheControl = (headers.get("cache-control") ?? "").toLowerCase();
  invariant(cacheControl.includes("no-store"), "api_cache_no_store_missing");
  invariant(cacheControl.includes("max-age=0"), "api_cache_max_age_invalid");
  invariant(!cacheControl.includes("public"), "api_cache_public_forbidden");
}

if (process.env.PUBLIC_PILOT_SMOKE_CONFIRM !== "preview-only") {
  throw new Error("Set PUBLIC_PILOT_SMOKE_CONFIRM=preview-only after checking the public pilot target");
}

const expectedHost = process.env.PUBLIC_PILOT_SMOKE_EXPECTED_HOST ?? "";
const base = new URL(process.env.PUBLIC_PILOT_SMOKE_URL ?? "https://invalid.local/");
invariant(base.protocol === "https:", "pilot_https_required");
invariant(base.hostname === expectedHost, "pilot_expected_host_mismatch");
invariant(base.hostname === ALLOWED_HOST, "pilot_host_not_allowlisted");
invariant(base.pathname === "/" && !base.search && !base.hash, "pilot_base_url_invalid");
invariant(!base.username && !base.password, "pilot_credentials_forbidden");

const shell = await request(base, "/prototype", 200, "text/html");
assertBrowserHeaders(shell.headers);
invariant(shell.body.includes('<div id="root"></div>'), "pilot_shell_invalid");

const publicContent = await request(base, "/api/content/public", 200, "application/json");
assertNoStore(publicContent.headers);
const contentPayload = parseJson(publicContent.body, "public_content");
exactFields(contentPayload, ["items", "nextCursor", "scope"], "public_content");
invariant(Array.isArray(contentPayload.items), "public_content_items_invalid");
invariant(contentPayload.nextCursor === null || typeof contentPayload.nextCursor === "string", "public_content_cursor_invalid");
invariant(contentPayload.scope === "current", "public_content_scope_invalid");

const publicRequests = await request(base, "/api/support/requests", 200, "application/json");
const requestPayload = parseJson(publicRequests.body, "public_requests");
exactFields(requestPayload, ["requests"], "public_requests");
invariant(Array.isArray(requestPayload.requests), "public_requests_list_invalid");

const privatePaths = [
  "/api/support/agent/requests",
  "/api/content/admin",
  "/api/communications/admin",
];
const privateChecks = [];
for (const path of privatePaths) {
  const result = await request(base, path, 401, "application/json");
  assertNoStore(result.headers);
  const payload = parseJson(result.body, "private_boundary");
  exactFields(payload, ["error"], "private_boundary");
  invariant(typeof payload.error === "string" && payload.error.length <= 120, "private_boundary_error_invalid");
  privateChecks.push({ path, status: 401, latencyMs: result.latencyMs });
}

console.log(JSON.stringify({
  target: base.hostname,
  writes: 0,
  aiCalls: 0,
  checks: {
    shell: { status: 200, latencyMs: shell.latencyMs },
    publicContent: { status: 200, latencyMs: publicContent.latencyMs },
    publicRequests: { status: 200, latencyMs: publicRequests.latencyMs },
    privateBoundaries: privateChecks,
  },
}));
