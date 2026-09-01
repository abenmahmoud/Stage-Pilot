import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import {
  SUPPORT_IDENTITY_VERIFICATION_MESSAGE,
  normalizeSupportReplyText,
  supportTranslationTargetLanguage,
  supportReplyNeedsIdentityCheck,
  supportReplyRequiresSchoolIdentity,
} from "../shared/support-reply-policy.ts";
import { routeSupportRequest } from "../shared/support-routing.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const creationSource = read("api/support/requests/index.ts");
const hash = (value) => createHash("sha256").update(value).digest("hex");

function loadIsolatedRoute(source, imports) {
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports,
    process: { env: {} },
    require: (name) => {
      assert.ok(Object.hasOwn(imports, name), `Unstubbed import: ${name}`);
      return imports[name];
    },
  });
  return exports.default;
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Run the actual handler against a transactional relational double. No network,
// credentials or real database are involved; SQL/RLS still need a preview recipe.
async function replayFixture({ cookie = "owner", expired = false, revoked = false, grant = "owner" } = {}) {
  const key = "fictional-shared-idempotency-key";
  const names = ["supportRequests", "supportDeviceSessions", "supportSessionRequests", "supportContacts",
    "supportCallbackTasks", "supportEvents", "supportMessages", "supportAssistantRoutingReviews"];
  const schema = Object.fromEntries(names.map((name) => [name, new Proxy({ name }, {
    get: (target, property) => property === "name" ? target.name : { table: target.name, column: property },
  })]));
  let rows = {
    supportDeviceSessions: ["owner", "stranger"].map((id) => ({
      id, sessionHash: hash(id),
      expiresAt: new Date(Date.now() + (expired ? -60_000 : 60_000)),
      revokedAt: revoked ? new Date() : null,
    })),
    supportRequests: [
      { id: "request-a", institutionId: "school-a", idempotencyKeyHash: hash(key),
        publicCode: "BC-2026-000001", status: "nouveau", createdAt: new Date() },
      { id: "request-b", institutionId: "school-b", idempotencyKeyHash: hash(key),
        publicCode: "BC-2026-000002", status: "nouveau", createdAt: new Date() },
    ],
    supportSessionRequests: [{ sessionId: grant, requestId: "request-a" }, { sessionId: "stranger", requestId: "request-b" }],
  };
  const original = structuredClone(rows);
  const resolve = (value, tuple) => value?.table ? tuple[value.table]?.[value.column] : value;
  const eq = (a, b) => (tuple) => resolve(a, tuple) === resolve(b, tuple);
  const and = (...conditions) => (tuple) => conditions.every((condition) => condition(tuple));
  const select = (draft, fields) => {
    let tuples = [];
    const query = {
      from(table) { tuples = (draft[table.name] ?? []).map((row) => ({ [table.name]: row })); return query; },
      innerJoin(table, on) {
        tuples = tuples.flatMap((tuple) => (draft[table.name] ?? []).map((row) => ({ ...tuple, [table.name]: row }))).filter(on);
        return query;
      },
      where(predicate) { tuples = tuples.filter(predicate); return query; },
      orderBy() { return query; },
      async limit(count) {
        return tuples.slice(0, count).map((tuple) => Object.fromEntries(
          Object.entries(fields).map(([name, column]) => [name, resolve(column, tuple)])
        ));
      },
    };
    return query;
  };
  const db = {
    async transaction(callback) {
      const draft = structuredClone(rows);
      const tx = {
        select: (fields) => select(draft, fields),
        insert(table) {
          let value;
          const query = {
            values(input) { value = input; return query; },
            onConflictDoNothing() { return query; },
            async returning() {
              if (table.name === "supportRequests") {
                assert.ok(draft.supportRequests.some((row) => row.institutionId === value.institutionId
                  && row.idempotencyKeyHash === value.idempotencyKeyHash));
                return [];
              }
              assert.equal(table.name, "supportDeviceSessions", "Replay must not create grants, messages or notifications");
              const row = { id: "new-session", ...value, revokedAt: null };
              draft.supportDeviceSessions.push(row);
              return [{ id: row.id }];
            },
            then() { assert.fail("Unexpected replay write"); },
          };
          return query;
        },
        execute() { assert.fail("Replay must not queue jobs or write events"); },
      };
      const result = await callback(tx);
      rows = draft;
      return result;
    },
  };
  let status = 200;
  let cookieWritten = false;
  const response = { status(value) { status = value; return response; } };
  const handler = loadIsolatedRoute(creationSource, {
    "node:crypto": { randomUUID: () => "fictional-correlation" },
    "drizzle-orm": { and, eq, desc: (v) => v, gt: (a, b) => (tuple) => resolve(a, tuple) > resolve(b, tuple),
      isNull: (a) => (tuple) => resolve(a, tuple) === null, ne: (a, b) => (tuple) => !eq(a, b)(tuple),
      inArray: (a, values) => (tuple) => values.includes(resolve(a, tuple)), sql() { assert.fail("Unexpected SQL"); } },
    "../../../db/index.js": { db },
    "../../../db/schema.js": schema,
    "../../../shared/support-routing.js": { initialSupportStatus: () => "nouveau" },
    "../../../shared/support-duplicate-policy.js": {},
    "../../../shared/support-request-confirmation.js": { createSupportRequestPersistenceConfirmation: (value) => value },
    "../../../shared/support-assistant-routing-receipt.js": {
      supportAgentCreateRequestActionEnabled: () => false, supportAssistantRoutingReviewEnabled: () => false,
    },
    "../../_shared/support-create-request-action.js": {},
    "../../_shared/auth.js": { HttpError },
    "../../_shared/response.js": { handleApi: async (_res, callback) => {
      try { return await callback(); } catch (error) {
        if (!(error instanceof HttpError)) throw error;
        status = error.status;
        return { error: error.message };
      }
    } },
    "../../_shared/support.js": {
      readSupportSessionToken: () => cookie, sha256: hash, opaqueToken: () => "new-token",
      idempotencyKey: () => key, SUPPORT_SESSION_DAYS: 30, SUPPORT_MAGIC_TOKEN_MINUTES: 30,
      parseSupportRequest: () => ({ routing: { service: "secretariat", confidence: "medium", priority: "p3" } }),
      setSupportSessionCookie: () => { cookieWritten = true; },
    },
    "../../_shared/support-rate-limits.js": {
      supportDeviceRateKey: () => "fictional-device", enforceSupportRequestNetworkGuard: async () => {},
      enforceSupportRequestCreationLimits: async () => {},
    },
    "../../_shared/institution-context.js": { requireConfiguredInstitution: async () => ({ id: "school-a" }) },
    "../../../shared/support-public-list-payload-policy.js": {},
  });
  const body = await handler({ method: "POST", body: {} }, response);
  return { status, body, rows, original, cookieWritten };
}

test("same-session retry returns the existing request without additional writes", async () => {
  const result = await replayFixture();
  assert.equal(result.status, 200);
  assert.equal(result.body.duplicate, true);
  assert.equal(result.body.request.publicCode, "BC-2026-000001");
  assert.deepEqual(result.rows, result.original);
  assert.equal(result.cookieWritten, false);
});

for (const [name, options] of [
  ["other session, even with a grant in another institution", { cookie: "stranger" }],
  ["no cookie", { cookie: null }],
  ["unknown cookie", { cookie: "unknown" }],
  ["expired session", { expired: true }],
  ["revoked session", { revoked: true }],
  ["valid session without a grant", { grant: "nobody" }],
]) {
  test(`replay denies ${name} without disclosure or committed writes`, async () => {
    const result = await replayFixture(options);
    assert.equal(result.status, 409);
    assert.doesNotMatch(JSON.stringify(result.body), /BC-2026|request-a|request-b|nouveau/);
    assert.deepEqual(result.rows, result.original);
    assert.equal(result.cookieWritten, false);
  });
}

const identityRequest = (category, subjectContext, description = "Demande de suivi") => ({ category, subjectContext, description });

test("server I3 protection follows sensitivity, not only the declared category", () => {
  for (const category of ["ent", "email_academique", "vie_scolaire", "affectation_classe", "autre"]) {
    for (const identityStatus of [undefined, "non_verifiee", "contact_verifie", "visitor"]) {
      assert.equal(supportReplyNeedsIdentityCheck(identityRequest(category, { requiredIdentity: "I3", identityStatus })), true);
    }
    assert.equal(supportReplyNeedsIdentityCheck(identityRequest(category, {
      requiredIdentity: "I3", identityStatus: "identite_confirmee",
    })), false);
  }
});

test("manual school identity never satisfies I4", () => {
  const request = identityRequest("autre", { requiredIdentity: "I4", identityStatus: "identite_confirmee" });
  assert.equal(supportReplyNeedsIdentityCheck(request), true);
  assert.equal(supportReplyRequiresSchoolIdentity(request), true);
});

test("urgent wording cannot weaken the existing access-code category protection", () => {
  for (const category of ["ent", "email_academique"]) {
    for (const level of ["I0", "I1", "I2"]) {
      assert.equal(supportReplyNeedsIdentityCheck(identityRequest(category, { requiredIdentity: level }, "Danger")), true);
    }
  }
});

test("legacy or malformed context uses server routing, including timetable sensitivity", () => {
  for (const context of [null, [], { requiredIdentity: "invalid" }, {}]) {
    assert.equal(supportReplyNeedsIdentityCheck(identityRequest("ent", context)), true);
    assert.equal(supportReplyNeedsIdentityCheck(identityRequest("autre", context, "Mon emploi du temps")), true);
    assert.equal(supportReplyNeedsIdentityCheck(identityRequest("orientation_formation", context)), false);
  }
});

test("urgent I0 safety replies stay possible without school identity", () => {
  const request = identityRequest("vie_scolaire", {}, "Je suis en danger");
  const route = routeSupportRequest(request);
  assert.equal(route.requiredIdentity, "I0");
  assert.equal(supportReplyNeedsIdentityCheck({ ...request, subjectContext: { requiredIdentity: route.requiredIdentity } }), false);
  assert.equal(supportReplyNeedsIdentityCheck(request), false);
});

test("ordinary requests and I2 administrative intake are not upgraded to I3", () => {
  for (const level of ["I0", "I1", "I2"]) {
    const request = identityRequest("documents_scolarite", { requiredIdentity: level });
    assert.equal(supportReplyRequiresSchoolIdentity(request), false);
    assert.equal(supportReplyNeedsIdentityCheck(request), false);
  }
});

test("reply, translation, closure and UI share the same identity gate", () => {
  for (const route of ["api/support/agent/requests/[code]/reply.ts", "api/support/agent/requests/[code]/translate.ts", "api/support/agent/requests/[code].ts"]) {
    const source = read(route);
    assert.match(source, /supportReplyNeedsIdentityCheck\(/);
    assert.doesNotMatch(source, /SENSITIVE_CATEGORIES|\["ent", "email_academique"\]/);
  }
  const page = read("src/pages/prototype/LyceeConnectPrototype.tsx");
  assert.equal(page.match(/supportReplyNeedsIdentityCheck\(/g)?.length, 3);
  assert.match(page, /supportReplyRequiresSchoolIdentity\(selected\)/);
  assert.match(page, /requiresSafeTemplate \? \[\] : selectedAgentAttachmentIds/);
});

async function checkReplyGate({ context, body = {}, category = "vie_scolaire" }) {
  const source = read("api/support/agent/requests/[code]/reply.ts");
  const importPaths = [...source.matchAll(/^import[\s\S]*?from "([^"]+)";/gm)].map((match) => match[1]);
  const imports = Object.fromEntries(importPaths.map((path) => [path, {}]));
  const request = { id: "fictional-request", category, description: "Mon emploi du temps",
    subject: "Suivi", subjectContext: context, assignedTeam: "vie_scolaire", updatedAt: new Date() };
  let reads = 0;
  const columnProxy = new Proxy({}, { get: () => "column" });
  imports["../../../../../db/schema.js"] = new Proxy({}, { get: () => columnProxy });
  imports["drizzle-orm"] = { and: () => null, eq: () => null };
  imports["../../../../../db/index.js"] = { db: {
    select() {
      reads += 1;
      if (reads > 2) throw new Error("passed-identity-gate");
      const result = reads === 1 ? [request] : [];
      const query = { from: () => query, where: () => query, limit: async () => result };
      return query;
    },
    transaction() { assert.fail("No writes allowed in identity gate test"); },
  } };
  imports["../../../../_shared/auth.js"] = { HttpError };
  imports["../../../../_shared/response.js"] = { handleApi: (_res, callback) => callback() };
  imports["../../../../_shared/support-agent-access.js"] = {
    requireSupportAgent: async () => ({ user: { id: "agent" }, access: {}, institutionId: "school-a" }),
    assertSupportRequestAccess: () => {},
  };
  imports["../../../../_shared/support-rate-limits.js"] = { enforceAgentWriteRateLimit: async () => {} };
  imports["../../../../_shared/support.js"] = {
    assertNoForbiddenSupportSecret: () => {}, idempotencyKey: () => "fictional-reply-key", sha256: hash, opaqueToken: () => "unused",
  };
  imports["../../../../../shared/support-concurrency.js"] = {
    parseSupportRevision: () => request.updatedAt, supportRevisionMatches: () => true,
  };
  imports["../../../../../shared/support-reply-policy.js"] = {
    SUPPORT_IDENTITY_VERIFICATION_MESSAGE, normalizeSupportReplyText, supportTranslationTargetLanguage, supportReplyNeedsIdentityCheck,
  };
  imports["../../../../../shared/support-agent-mutation-input-policy.js"] = {
    isSupportAgentReplyInput: () => true, singleSupportAgentRouteValue: (value) => value,
  };
  const handler = loadIsolatedRoute(source, imports);
  return handler({ method: "POST", query: { code: "BC-2026-000001" }, body: { message: "Message fictif", ...body } }, {});
}

test("real reply handler denies a free-text I3 reply outside the ENT category", async () => {
  await assert.rejects(() => checkReplyGate({ context: { requiredIdentity: "I3", identityStatus: "contact_verifie" } }),
    (error) => error instanceof HttpError && error.status === 409 && /message sécurisé/.test(error.message));
});

test("real reply handler denies attachments even with the safe template", async () => {
  await assert.rejects(() => checkReplyGate({ context: { requiredIdentity: "I3" }, body: {
    safeTemplate: "identity_verification", attachmentIds: ["11111111-1111-4111-8111-111111111111"],
  } }), (error) => error instanceof HttpError && error.status === 409 && /Aucun document/.test(error.message));
});

test("real reply handler allows the safe text, confirmed I3 and emergency I0 to continue", async () => {
  for (const input of [
    { context: { requiredIdentity: "I3" }, body: { safeTemplate: "identity_verification" } },
    { context: { requiredIdentity: "I3", identityStatus: "identite_confirmee" } },
    { context: { requiredIdentity: "I0" } },
  ]) {
    await assert.rejects(() => checkReplyGate(input), /passed-identity-gate/);
  }
});

test("attachment identifiers reject invalid UUID layout before any access lookup", async () => {
  const source = read("api/support/attachments/[id].ts");
  const importPaths = [...source.matchAll(/^import[\s\S]*?from "([^"]+)";/gm)].map((match) => match[1]);
  const imports = Object.fromEntries(importPaths.map((path) => [path, {}]));
  imports["../../_shared/auth.js"] = { HttpError };
  imports["../../_shared/response.js"] = { handleApi: (_res, callback) => callback() };
  imports["../../../shared/support-public-mutation-input-policy.js"] = { singleSupportQueryValue: (v) => v };
  imports["../../_shared/support.js"] = { requireSupportAccess: () => { throw new Error("access-check"); } };
  const handler = loadIsolatedRoute(source, imports);
  for (const id of ["-".repeat(36), "a".repeat(36), "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa-", "g0000000-0000-0000-0000-000000000000"]) {
    await assert.rejects(() => handler({ method: "GET", query: { id, code: "BC-2026-000001" } }, {}),
      (error) => error instanceof HttpError && error.status === 400);
  }
  await assert.rejects(() => handler({ method: "GET", query: {
    id: "11111111-1111-4111-8111-111111111111", code: "BC-2026-000001",
  } }, {}), /access-check/);
});
