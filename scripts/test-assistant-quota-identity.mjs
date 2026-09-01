import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import test from "node:test";
import { resolveAssistantQuotaCookie } from "../api/_shared/assistant-quota-identity.ts";
import * as policies from "../shared/support-rate-limit-policy.ts";

const institutionId = "10000000-0000-4000-8000-000000000001";
const secret = "fictional-quota-secret-for-tests-only-0001";
const hash = (value) => createHmac("sha256", secret).update(value).digest("hex");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const now = Date.parse("2026-09-01T20:00:00Z");
const cookieInput = { secret, institutionId, production: true, now };
const headerOf = (result) => result.setCookie?.split(";")[0];
const source = readFileSync(new URL("../api/_shared/support-rate-limits.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

function fixture() {
  const state = {
    counters: new Map(), attempts: [], network: "fictitious-network", user: null,
    session: null, dbFailure: false, authFailure: false, checks: 0, institutionId,
  };
  const sessionCols = Object.fromEntries(["id", "sessionHash", "expiresAt", "revokedAt"].map((k) => [k, `session.${k}`]));
  const grantCols = { sessionId: "grant.sessionId", requestId: "grant.requestId" };
  const requestCols = { id: "request.id", institutionId: "request.institutionId" };
  const value = (row, input) => typeof input === "string" && Object.hasOwn(row, input) ? row[input] : input;
  const orm = {
    eq: (a, b) => (row) => value(row, a) === value(row, b),
    gt: (a, b) => (row) => value(row, a) > value(row, b),
    isNull: (a) => (row) => value(row, a) === null,
    and: (...filters) => (row) => filters.every((fn) => fn(row)),
  };
  const db = { select: (projection) => {
    const filters = [];
    const query = {
      from: () => query,
      innerJoin: (_table, condition) => { filters.push(condition); return query; },
      where: (condition) => { filters.push(condition); return query; },
      limit: async (limit) => {
        state.checks++;
        if (state.dbFailure) throw new Error("fictional-db-unavailable");
        const row = state.session;
        return row && filters.every((filter) => filter(row))
          ? [Object.fromEntries(Object.entries(projection).map(([key, col]) => [key, row[col]]))].slice(0, limit)
          : [];
      },
    };
    return query;
  } };
  const enforce = async (attempts) => {
    state.attempts.push(...attempts);
    for (const input of attempts) {
      const key = `${input.scope}:${input.keyHash}`;
      const count = state.counters.get(key) ?? 0;
      if (count >= input.limit) throw new HttpError(429, input.message);
      state.counters.set(key, count + 1);
    }
  };
  const dependencies = {
    "drizzle-orm": orm,
    "../../db/index.js": { db },
    "../../db/schema.js": { supportDeviceSessions: sessionCols, supportSessionRequests: grantCols, supportRequests: requestCols },
    "./auth.js": { HttpError, getUserFromRequest: async () => {
      if (state.authFailure) throw new Error("fictional-auth-private-detail");
      return state.user;
    } },
    "./institution-context.js": { requireConfiguredInstitution: async () => ({ id: state.institutionId }) },
    "./assistant-quota-identity.js": { resolveAssistantQuotaCookie },
    "../../shared/support-rate-limit-policy.js": policies,
    "./support.js": {
      personalHash: hash, sha256,
      requestIpHash: () => state.network ? hash(state.network) : null,
      readSupportSessionToken: (req) => req.headers.cookie?.split(";")
        .map((part) => part.trim()).find((part) => part.startsWith("bc_support_session="))?.slice(19) ?? null,
      enforceSupportRateLimit: (input) => enforce([input]),
      enforceSupportRateLimits: enforce,
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Date, process: { env: { NODE_ENV: "production", SUPPORT_HASH_SECRET: secret } },
    require: (name) => { assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name]; },
  });
  let cookie;
  const headers = new Map();
  const res = { getHeader: (name) => headers.get(name), setHeader: (name, value) => headers.set(name, value) };
  const req = { headers: {} };
  const run = async (device = "fictional-device-000001") => {
    if (cookie) req.headers.cookie = cookie;
    const result = await exports.enforceAssistantRateLimits(req, device, res);
    const setCookies = headers.get("Set-Cookie") ?? [];
    const newCookie = setCookies.findLast((value) => value.startsWith("__Host-bc_assistant_quota="));
    if (newCookie) cookie = newCookie.split(";")[0];
    return result;
  };
  return { state, req, res, headers, exports, run, clearCookie: () => { cookie = undefined; delete req.headers.cookie; headers.clear(); } };
}

test("issues a host-only HTTP-only cookie without person or permission claims", () => {
  const issued = resolveAssistantQuotaCookie(cookieInput);
  assert.match(issued.setCookie, /^__Host-bc_assistant_quota=/);
  assert.match(issued.setCookie, /; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure$/);
  assert.doesNotMatch(issued.setCookie, /Domain=/);
  const payload = headerOf(issued).split("=")[1].split(".")[0];
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  assert.deepEqual(Object.keys(claims).sort(), ["exp", "iat", "id", "institutionId", "v"]);
  const again = resolveAssistantQuotaCookie({ ...cookieInput, cookieHeader: headerOf(issued), now: now + 1000 });
  assert.equal(again.anonymousId, issued.anonymousId);
  assert.equal(again.setCookie, null, "reading a cookie must not extend its expiry");
  const local = resolveAssistantQuotaCookie({ ...cookieInput, production: false });
  assert.match(local.setCookie, /^bc_assistant_quota=/);
  assert.doesNotMatch(local.setCookie, /Secure/);
});

test("forged, duplicate, expired, future and foreign cookies never choose a trusted identifier", () => {
  const issued = resolveAssistantQuotaCookie(cookieInput);
  const header = headerOf(issued);
  const variants = [
    header.replace(/.$/, (char) => char === "A" ? "B" : "A"),
    `${header}; ${header}`, "__Host-bc_assistant_quota=attacker-value", "",
  ];
  for (const cookieHeader of variants) {
    const result = resolveAssistantQuotaCookie({ ...cookieInput, cookieHeader });
    assert.notEqual(result.anonymousId, issued.anonymousId);
    assert.ok(result.setCookie);
  }
  for (const extra of [
    { now: now + 30 * 24 * 3600 * 1000 }, { now: now - 1000 },
    { institutionId: "10000000-0000-4000-8000-000000000002" },
    { secret: `${secret}rotated` },
  ]) assert.notEqual(resolveAssistantQuotaCookie({ ...cookieInput, cookieHeader: header, ...extra }).anonymousId, issued.anonymousId);
  assert.throws(() => resolveAssistantQuotaCookie({ ...cookieInput, secret: "short" }));
  assert.throws(() => resolveAssistantQuotaCookie({ ...cookieInput, cookieHeader: "x".repeat(16_385) }));
  assert.throws(() => resolveAssistantQuotaCookie({ ...cookieInput, institutionId: "invalid" }));
});

test("changing declared conversation and device IDs cannot reset the signed-cookie quota", async () => {
  const f = fixture();
  for (let i = 0; i < 24; i++) {
    const device = `fictional-device-${String(i).padStart(6, "0")}`;
    assert.equal(await f.run(device), hash(`support-device:${device}`), "receipt binding stays compatible");
  }
  await assert.rejects(f.run("fictional-device-never-seen"), { status: 429 });
  assert.equal(f.state.checks, 0, "no tracking session means no session lookup");
});

test("the validated account quota survives fresh anonymous cookies and device IDs", async () => {
  const f = fixture();
  f.state.user = { id: "fictional-verified-user" };
  f.req.headers.authorization = "Bearer test-only-provider-verified-token";
  for (let i = 0; i < 24; i++) { f.clearCookie(); await f.run(`fictional-device-account-${i}`); }
  f.clearCookie();
  await assert.rejects(f.run("fictional-device-account-new"), { status: 429 });
  assert.equal(f.state.counters.get(`assistant_session:${hash(`assistant-account:${institutionId}:fictional-verified-user`)}`), 24);
  f.state.user = null;
  f.clearCookie();
  await assert.rejects(f.run(), { status: 401 });
  f.state.authFailure = true;
  await assert.rejects(f.run(), { status: 503, message: "La vérification de la session est momentanément indisponible." });
});

test("tracking quota requires an unexpired non-revoked session and an institution-scoped grant", async () => {
  const token = "t".repeat(43);
  const valid = {
    "session.id": "session-fixture", "session.sessionHash": sha256(token),
    "session.expiresAt": new Date(Date.now() + 3600_000), "session.revokedAt": null,
    "grant.sessionId": "session-fixture", "grant.requestId": "request-fixture",
    "request.id": "request-fixture", "request.institutionId": institutionId,
  };
  for (const overrides of [null, {},
    { "session.expiresAt": new Date(0) }, { "session.revokedAt": new Date() },
    { "request.institutionId": "foreign-school" }, { "session.sessionHash": "other" },
    { "grant.sessionId": "other" }, { "grant.requestId": "other" },
  ]) {
    const f = fixture();
    f.req.headers.cookie = `bc_support_session=${token}`;
    f.state.session = overrides === null ? null : { ...valid, ...overrides };
    await f.run();
    const key = hash(`assistant-tracking:${institutionId}:session-fixture`);
    assert.equal(f.state.attempts.some((a) => a.keyHash === key), overrides !== null && Object.keys(overrides).length === 0);
    assert.equal(f.state.attempts.some((a) => a.keyHash === hash(`support-session:${token}`)), false);
  }
  const failing = fixture();
  failing.req.headers.cookie = `bc_support_session=${token}`;
  failing.state.dbFailure = true;
  await assert.rejects(failing.run(), { status: 503, message: "La vérification du suivi est momentanément indisponible." });
  const tracked = fixture();
  tracked.state.session = valid;
  for (let index = 0; index < 24; index++) {
    tracked.clearCookie();
    tracked.req.headers.cookie = `bc_support_session=${token}`;
    await tracked.run(`fictional-tracked-device-${index}`);
  }
  tracked.clearCookie();
  tracked.req.headers.cookie = `bc_support_session=${token}`;
  await assert.rejects(tracked.run("fictional-tracked-device-next"), { status: 429 });
});

test("new anonymous visitors and rotating or missing IPs still share the global guard", async () => {
  const f = fixture();
  const globalKey = `assistant_global:${hash(`assistant-global:${institutionId}`)}`;
  f.state.counters.set(globalKey, 19_999);
  await f.run("fictional-first-new-browser");
  f.clearCookie();
  f.state.network = "other-network";
  await assert.rejects(f.run("fictional-second-new-browser"), { status: 429 });
  f.state.network = null;
  await assert.rejects(f.run("fictional-third-new-browser"), { status: 429 });
  assert.equal(f.state.counters.get(globalKey), 20_000);
  assert.equal(policies.SUPPORT_RATE_LIMIT_POLICIES.assistantGlobalGuard.limit,
    policies.SUPPORT_RATE_LIMIT_POLICIES.assistantNetworkGuard.limit);
});

test("preserves other response cookies and keeps quota state out of public payloads", async () => {
  const f = fixture();
  f.headers.set("Set-Cookie", "other_fixture_cookie=value; HttpOnly");
  const result = await f.run();
  assert.equal(typeof result, "string");
  assert.match(result, /^[a-f0-9]{64}$/);
  assert.equal(f.headers.get("Set-Cookie")[0], "other_fixture_cookie=value; HttpOnly");
  assert.equal(f.headers.get("Set-Cookie").length, 2);
  assert.ok(f.state.attempts.every((a) => /^[a-f0-9]{64}$/.test(a.keyHash)));
  const requestRoute = readFileSync(new URL("../api/support/requests/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(requestRoute, /assistantGlobalGuard|enforceAssistantRateLimits|resolveAssistantQuotaCookie/);
});

test("two hundred independent anonymous callers share the same simulated store without a low NAT ceiling", async () => {
  const counters = new Map();
  await Promise.all(Array.from({ length: 200 }, async (_, index) => {
    const f = fixture();
    f.state.counters = counters;
    await f.run(`fictional-concurrent-device-${index}`);
  }));
  assert.equal(counters.get(`assistant_global:${hash(`assistant-global:${institutionId}`)}`), 200);
  assert.equal(counters.get(`assistant_network:${hash("fictitious-network")}`), 200);
});

test("the actual assistant handler stops before analysis when the global guard refuses", async () => {
  const f = fixture();
  const routeSource = readFileSync(new URL("../api/support/assistant.ts", import.meta.url), "utf8");
  const dependencies = Object.fromEntries([...routeSource.matchAll(/^import[\s\S]*?from "([^"]+)";/gm)]
    .map((match) => [match[1], {}]));
  let analyses = 0;
  dependencies["../_shared/auth.js"] = { HttpError };
  dependencies["../_shared/response.js"] = { handleApi: (_res, callback) => callback() };
  dependencies["../../shared/support-assistant-input-policy.js"] = { parseSupportAssistantInput: (body) => body };
  dependencies["../_shared/support.js"] = { assertNoForbiddenSupportSecret: () => {} };
  dependencies["../_shared/support-rate-limits.js"] = f.exports;
  dependencies["../_shared/knowledge-actor.js"] = { resolveKnowledgeActorFromRequest: async () => null };
  dependencies["../_shared/support-agent.js"] = { analyzeSupportConversation: async () => {
    analyses++;
    return { category: "autre", usedAi: false, sourceReferences: [] };
  } };
  dependencies["../../shared/support-routing.js"] = { routeSupportRequest: () => ({ service: "secretariat" }) };
  dependencies["../../shared/support-assistant-payload-policy.js"] = { isValidSupportAssistantPayload: () => true };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(routeSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, process: { env: {} }, require: (name) => {
    assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name];
  } });
  const req = { method: "POST", headers: {}, body: {
    sessionId: "fictional-handler-device", messages: [{ role: "requester", content: "Question fictive" }], attachments: [],
  } };
  f.state.counters.set(`assistant_global:${hash(`assistant-global:${institutionId}`)}`, 20_000);
  await assert.rejects(exports.default(req, f.res), { status: 429 });
  assert.equal(analyses, 0);
  f.state.counters.clear();
  await exports.default(req, f.res);
  assert.equal(analyses, 1);
});
