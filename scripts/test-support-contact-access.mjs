import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { drizzle } from "drizzle-orm/postgres-js";
import * as realOrm from "drizzle-orm";
import * as pgCore from "drizzle-orm/pg-core";
import { supportAccessCodeFromToken, supportAccessCodeMatches, supportAccessCodeSecret } from "../shared/support-access-code.mjs";
import { parseSupportAccessCodeInput } from "../shared/support-access-code-payload-policy.ts";
import { isSupportMagicAccessPayload } from "../shared/support-magic-access-payload-policy.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const token = "a".repeat(43);
const secret = "fictional-access-code-secret-".repeat(3);
const names = ["supportRequests", "supportContacts", "supportMagicTokens", "supportDeviceSessions",
  "supportSessionRequests", "supportEvents", "supportMessages", "supportAttachments"];
const schema = Object.fromEntries(names.map((name) => [name, new Proxy({ name }, {
  get: (target, property) => property === "name" ? target.name : { table: target.name, column: property },
})]));
const resolve = (value, tuple) => value?.table ? tuple[value.table]?.[value.column] : value;
const compare = (operation) => (a, b) => (tuple) => operation(resolve(a, tuple), resolve(b, tuple));
const orm = {
  and: (...conditions) => (tuple) => conditions.every((condition) => condition(tuple)),
  eq: compare((a, b) => a === b), ne: compare((a, b) => a !== b),
  gt: compare((a, b) => a > b), lt: compare((a, b) => a < b),
  isNull: (a) => (tuple) => resolve(a, tuple) === null,
  isNotNull: (a) => (tuple) => resolve(a, tuple) != null,
  desc: (column) => ({ column, descending: true }),
  sql: (strings, ...values) => ({ strings, values }),
};
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function load(path, imports, extra = {}, exposed = []) {
  const source = read(path);
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output + exposed.map((name) => `\nexports.${name} = ${name};`).join(""), {
    exports, Date, process: { env: { SUPPORT_ACCESS_CODE_SECRET: secret } },
    require: (name) => {
      assert.ok(Object.hasOwn(imports, name), `Unstubbed import: ${name}`);
      return imports[name];
    }, ...extra,
  });
  return exports;
}

// Evaluate actual route predicates and transactional writes; no network or real DB.
// Row-lock requests are observed, not a substitute for concurrent PostgreSQL tests.
function database(initial) {
  let rows = structuredClone(initial);
  const trace = [];
  function client(state) {
    return {
      select(fields) {
        let table, predicates = [], joins = [], count = Infinity, order;
        const query = {
          from(value) { table = value; return query; },
          innerJoin(value, on) { joins.push([value, on]); return query; },
          where(value) { predicates.push(value); return query; },
          orderBy(value) { order = value; return query; },
          limit(value) { count = value; return query; },
          for(strength, config) { trace.push({ kind: "lock", table: table.name, strength, of: config?.of?.name }); return query; },
          then(success, failure) {
            return Promise.resolve().then(() => {
              let tuples = state[table.name].map((row) => ({ [table.name]: row }));
              for (const [joined, on] of joins) {
                tuples = tuples.flatMap((tuple) => state[joined.name].map((row) => ({ ...tuple, [joined.name]: row }))).filter(on);
              }
              tuples = tuples.filter((tuple) => predicates.every((predicate) => predicate(tuple)));
              if (order) tuples.sort((a, b) => Number(resolve(order.column, b)) - Number(resolve(order.column, a)));
              if (fields.count?.strings) return [{ count: tuples.length }];
              return tuples.slice(0, count).map((tuple) => Object.fromEntries(
                Object.entries(fields).map(([key, value]) => [key, resolve(value, tuple)])
              ));
            }).then(success, failure);
          },
        };
        return query;
      },
      insert(table) {
        let values, fields, ignoreConflict = false;
        const query = {
          values(value) { values = Array.isArray(value) ? value : [value]; return query; },
          returning(value) { fields = value; return query; },
          onConflictDoNothing() { ignoreConflict = true; return query; },
          then(success, failure) {
            return Promise.resolve().then(() => values.flatMap((value) => {
              if (ignoreConflict && table.name === "supportSessionRequests" && state[table.name].some(
                (row) => row.sessionId === value.sessionId && row.requestId === value.requestId
              )) return [];
              trace.push({ kind: "insert", table: table.name });
              const row = { id: `new-${state[table.name].length}`, revokedAt: null, ...value };
              state[table.name].push(row);
              return fields ? [Object.fromEntries(Object.entries(fields).map(([key, column]) => [key, row[column.column]]))] : [];
            })).then(success, failure);
          },
        };
        return query;
      },
      update(table) {
        let values, predicate, fields;
        const query = {
          set(value) { values = value; return query; },
          where(value) { predicate = value; return query; },
          returning(value) { fields = value; return query; },
          then(success, failure) {
            return Promise.resolve().then(() => state[table.name].filter((row) => predicate({ [table.name]: row })).map((row) => {
              for (const [key, value] of Object.entries(values)) {
                if (value?.strings) {
                  assert.match(value.strings.join("?"), /\+ 1$/);
                  row[key] = row[value.values[0].column] + 1;
                } else row[key] = value;
              }
              return fields ? Object.fromEntries(Object.entries(fields).map(([key, column]) => [key, row[column.column]])) : {};
            })).then(success, failure);
          },
        };
        return query;
      },
    };
  }
  return {
    get rows() { return rows; }, trace,
    db: {
      select: (...args) => client(rows).select(...args),
      update: (...args) => client(rows).update(...args),
      async transaction(callback) {
        const draft = structuredClone(rows);
        const result = await callback(client(draft));
        rows = draft;
        return result;
      },
    },
  };
}
function fixture() {
  const rows = Object.fromEntries(names.map((name) => [name, []]));
  rows.supportRequests = [
    { id: "request-a", publicCode: "BC-2026-000001", institutionId: "school-a" },
    { id: "request-b", publicCode: "BC-2026-000002", institutionId: "school-a" },
    { id: "request-c", publicCode: "BC-2026-000003", institutionId: "school-b" },
  ];
  rows.supportContacts = [{ id: "contact-a", requestId: "request-a", channel: "email", usageScope: "support",
    disabledAt: null, isVerified: false, value: "fictitious@example.org" }];
  rows.supportMagicTokens = [{ id: "magic-a", requestId: "request-a", contactId: "contact-a", tokenHash: hash(token),
    purpose: "support_access", attemptCount: 0, usedAt: null, createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000) }];
  rows.supportDeviceSessions = [{ id: "old-session", sessionHash: hash("old-token"), revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000) }];
  rows.supportSessionRequests = ["request-b", "request-c"].map((requestId) => ({ sessionId: "old-session", requestId }));
  return rows;
}
async function exchange(mode, mutate = () => {}, options = {}) {
  const rows = fixture(); mutate(rows);
  const original = structuredClone(rows);
  const storage = database(rows);
  let cookie = null;
  const support = { sha256: hash, SUPPORT_SESSION_DAYS: 30, opaqueToken: () => "new-token",
    readSupportSessionToken: () => options.oldToken === undefined ? "old-token" : options.oldToken,
    setSupportSessionCookie: (_res, value) => { cookie = value; } };
  const common = {
    "node:crypto": { randomUUID: () => "fictitious-event" }, "drizzle-orm": orm,
    "../../db/index.js": { db: storage.db }, "../../db/schema.js": schema,
    "./support.js": support, "./auth.js": { HttpError },
  };
  const { openSupportAccessSession } = load("api/_shared/support-access-session.ts", common);
  const prefix = mode === "link" ? "../../" : "../";
  const root = mode === "link" ? "../../../" : "../../";
  const imports = {
    "drizzle-orm": orm, [`${root}db/index.js`]: { db: storage.db }, [`${root}db/schema.js`]: schema,
    [`${prefix}_shared/auth.js`]: { HttpError },
    [`${prefix}_shared/response.js`]: { handleApi: (_res, callback) => callback() },
    [`${prefix}_shared/support.js`]: support,
    [`${prefix}_shared/support-access-session.js`]: { openSupportAccessSession },
    [`${prefix}_shared/support-rate-limits.js`]: { enforceMagicTokenNetworkGuard: async () => {} },
    [`${prefix}_shared/institution-context.js`]: { requireConfiguredInstitution: async () => ({ id: "school-a" }) },
    [`${root}shared/support-magic-access-payload-policy.js`]: { isSupportMagicAccessPayload },
    [`${root}shared/support-access-code.mjs`]: { supportAccessCodeMatches, supportAccessCodeSecret },
    [`${root}shared/support-access-code-payload-policy.js`]: { parseSupportAccessCodeInput },
  };
  const handler = load(mode === "link" ? "api/support/access/[token].ts" : "api/support/access-code.ts", imports).default;
  let status = 200, body;
  try {
    body = await handler({ method: "POST", query: { token }, body: {
      publicCode: "BC-2026-000001", code: options.code ?? supportAccessCodeFromToken({ token, secret }),
    } }, {});
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
    status = error.status; body = { error: error.message };
  }
  return { storage, original, status, body, cookie };
}

for (const mode of ["link", "code"]) {
  for (const [label, mutate] of [
    ["disabled address", (rows) => { rows.supportContacts[0].disabledAt = new Date(); }],
    ["missing address", (rows) => { rows.supportContacts = []; }],
    ["contact of another request", (rows) => { rows.supportContacts[0].requestId = "request-b"; }],
    ["non-support contact", (rows) => { rows.supportContacts[0].usageScope = "communications"; }],
    ["non-email contact", (rows) => { rows.supportContacts[0].channel = "phone"; }],
    ["legacy unbound token", (rows) => { rows.supportMagicTokens[0].contactId = null; }],
    ["another institution", (rows) => { rows.supportRequests[0].institutionId = "school-b"; }],
  ]) {
    test(`${mode}: ${label} grants nothing and rolls back token/session writes`, async () => {
      const result = await exchange(mode, mutate);
      assert.equal(result.status, mode === "link" ? 410 : 401);
      assert.equal(result.cookie, null);
      assert.deepEqual(result.storage.rows, result.original);
      assert.doesNotMatch(JSON.stringify(result.body), /contact-a|request-a|school-a|example|BC-2026/);
    });
  }
  test(`${mode}: active bound contact grants I2 only and rotates same-school grants`, async () => {
    const result = await exchange(mode);
    assert.equal(result.status, 200);
    assert.equal(result.cookie, "new-token");
    const rows = result.storage.rows;
    assert.ok(rows.supportMagicTokens[0].usedAt);
    assert.ok(rows.supportDeviceSessions[0].revokedAt);
    assert.equal(rows.supportContacts[0].isVerified, true);
    assert.equal(rows.supportEvents[0].toValue.identityStatus, "contact_verifie");
    const id = rows.supportDeviceSessions[1].id;
    assert.deepEqual(rows.supportSessionRequests.filter((grant) => grant.sessionId === id).map((grant) => grant.requestId).sort(), ["request-a", "request-b"]);
    const locks = result.storage.trace.filter((entry) => entry.kind === "lock");
    assert.deepEqual(locks.map((entry) => [entry.table, entry.strength]), [["supportContacts", "update"], ["supportDeviceSessions", "update"]]);
    assert.equal(result.storage.trace[0].table, "supportContacts");
  });
  test(`${mode}: already verified contact keeps its proof without another event`, async () => {
    const result = await exchange(mode, (rows) => { rows.supportContacts[0].isVerified = true; });
    assert.equal(result.status, 200);
    assert.equal(result.storage.rows.supportEvents.length, 0);
  });
  for (const state of ["absent", "expired", "revoked"]) {
    test(`${mode}: ${state} previous session cannot contribute old grants`, async () => {
      const result = await exchange(mode, (rows) => {
        if (state === "expired") rows.supportDeviceSessions[0].expiresAt = new Date(0);
        if (state === "revoked") rows.supportDeviceSessions[0].revokedAt = new Date();
      }, state === "absent" ? { oldToken: null } : {});
      assert.equal(result.status, 200);
      const rows = result.storage.rows;
      assert.deepEqual(rows.supportSessionRequests.filter((grant) => grant.sessionId === rows.supportDeviceSessions[1].id).map((grant) => grant.requestId), ["request-a"]);
    });
  }
}
test("wrong code still commits a failed attempt without opening a session", async () => {
  const correct = supportAccessCodeFromToken({ token, secret });
  const result = await exchange("code", () => {}, { code: correct === "000000" ? "111111" : "000000" });
  assert.equal(result.status, 401);
  assert.equal(result.storage.rows.supportMagicTokens[0].attemptCount, 1);
  assert.equal(result.storage.rows.supportMagicTokens[0].usedAt, null);
  assert.equal(result.cookie, null);
  assert.equal(result.storage.rows.supportDeviceSessions.length, 1);
});

function deliveryFixture(mutate = () => {}, { reservedAddress = false } = {}) {
  const rows = fixture();
  Object.assign(rows.supportRequests[0], { requesterFirstName: "Test", requesterLastName: "Fictif",
    requesterType: "parent", category: "autre", subject: "Question fictive", assignedTeam: "numerique" });
  rows.supportMessages = [{ id: "message-a", requestId: "request-a", direction: "outbound", channel: "email",
    bodyText: "Reponse fictive", deliveryStatus: "queued" }];
  mutate(rows);
  const storage = database(rows), sent = [];
  const { deliver } = load("api/cron/support-worker.ts", {
    "drizzle-orm": orm, "../../db/index.js": { db: storage.db }, "../../db/schema.js": schema,
    "../_shared/brevo.js": { escapeHtml: (value) => value, sendTransactionalEmail: async (value) => {
      sent.push(value); return { messageId: "fictitious-provider-id" };
    } },
    "../_shared/auth.js": {}, "../_shared/response.js": {},
    "../../shared/support-notification-routing.js": { resolveSupportNotificationTarget: () => ({ email: "agent@example.org", name: "Test" }) },
    "../../shared/support-test-address.js": { isReservedTestEmail: (value) => reservedAddress && value === "fictitious@example.org" },
    "../../shared/support-email-job-policy.js": {}, "../_shared/institution-context.js": {},
    "../../shared/support-access-code.mjs": { supportAccessCodeFromToken },
  }, { process: { env: { SUPPORT_FROM_EMAIL: "support@example.org" } } }, ["deliver"]);
  const job = { job_type: "send_requester_reply", job_id: "job-a", request_id: "request-a", institution_id: "school-a",
    contact_id: "contact-a", message_id: "message-a", access_token: token };
  return { storage, sent, deliver, job };
}
for (const [label, mutate, editJob] of [
  ["disabled contact", (rows) => { rows.supportContacts[0].disabledAt = new Date(); }],
  ["missing contact", (rows) => { rows.supportContacts = []; }],
  ["contact from another dossier", (rows) => { rows.supportContacts[0].requestId = "request-b"; }],
  ["wrong contact usage", (rows) => { rows.supportContacts[0].usageScope = "communications"; }],
  ["no contact binding", () => {}, (job) => { delete job.contact_id; }],
]) {
  for (const kind of ["send_requester_reply", "notify_requester_request_created"]) {
    test(`Vercel ${kind}: ${label} never falls back to another address`, async () => {
      const item = deliveryFixture(mutate);
      item.job.job_type = kind; editJob?.(item.job);
      await assert.rejects(item.deliver(item.job, "school-a"), /requester_contact_unavailable/);
      assert.equal(item.sent.length, 0);
      assert.equal(item.storage.rows.supportMessages[0].deliveryStatus, "queued");
    });
  }
}
for (const [label, mutate] of [
  ["another dossier", (rows) => { rows.supportMessages[0].requestId = "request-b"; }],
  ["internal note", (rows) => { rows.supportMessages[0].direction = "internal"; }],
  ["inbound message", (rows) => { rows.supportMessages[0].direction = "inbound"; }],
  ["phone-only reply", (rows) => { rows.supportMessages[0].channel = "phone"; }],
]) {
  test(`Vercel cannot email ${label} as a reply`, async () => {
    const item = deliveryFixture(mutate);
    await assert.rejects(item.deliver(item.job, "school-a"), /reply_message_not_found/);
    assert.equal(item.sent.length, 0);
    assert.equal(item.storage.rows.supportMessages[0].deliveryStatus, "queued");
  });
}
test("Vercel sends a valid reply, counts only its clean outgoing files, marks only its message", async () => {
  const item = deliveryFixture((rows) => {
    rows.supportAttachments = [
      { requestId: "request-a", messageId: "message-a", direction: "agent", scanStatus: "clean" },
      { requestId: "request-b", messageId: "message-a", direction: "agent", scanStatus: "clean" },
      { requestId: "request-a", messageId: "message-a", direction: "agent", scanStatus: "pending" },
    ];
    rows.supportMessages.push({ id: "message-b", requestId: "request-b", deliveryStatus: "queued" });
  });
  assert.equal(await item.deliver(item.job, "school-a"), "fictitious-provider-id");
  assert.equal(item.sent.length, 1);
  assert.equal(item.sent[0].to.email, "fictitious@example.org");
  assert.match(item.sent[0].textContent, /1 document est/);
  assert.equal(item.storage.rows.supportMessages[0].deliveryStatus, "sent");
  assert.equal(item.storage.rows.supportMessages[1].deliveryStatus, "queued");
});
test("Vercel agent notifications still work without a requester email", async () => {
  const item = deliveryFixture((rows) => { rows.supportContacts = []; });
  item.job.job_type = "notify_agent_request_created"; delete item.job.contact_id;
  await item.deliver(item.job, "school-a");
  assert.equal(item.sent.length, 1);
  assert.equal(item.sent[0].to.email, "agent@example.org");
});
test("Vercel sent replies are not sent twice", async () => {
  const item = deliveryFixture((rows) => { rows.supportMessages[0].deliveryStatus = "sent"; });
  assert.equal(await item.deliver(item.job, "school-a"), "skipped:already_sent");
  assert.equal(item.sent.length, 0);
});
test("Vercel still suppresses notifications to agents for reserved test requests without a contact ID", async () => {
  const item = deliveryFixture(() => {}, { reservedAddress: true });
  item.job.job_type = "notify_agent_request_created"; delete item.job.contact_id;
  assert.equal(await item.deliver(item.job, "school-a"), "skipped:test_address");
  assert.equal(item.sent.length, 0);
});

// Extract declarations only: never execute the VPS entry point, read its env,
// connect to PostgreSQL or call Brevo. Inspect the SQL emitted by real functions.
function vpsDelivery({ contactAvailable = true, messageAvailable = true, reservedAddress = false } = {}) {
  const source = read("workers/support-email-worker.mjs");
  const ast = ts.createSourceFile("worker.mjs", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const declarations = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && node.name.text !== "sendEmail");
  const sent = [], queries = [];
  const sql = async (strings, ...values) => {
    const query = strings.join("?").replace(/\s+/g, " ").trim(); queries.push({ query, values });
    if (query.includes("from public.support_requests")) {
      assert.deepEqual(values, ["request-a", "school-a"]);
      return [{ id: "request-a", public_code: "BC-2026-000001", requester_first_name: "Test", requester_last_name: "Fictif",
        requester_type: "parent", category: "autre", subject: "Demande fictive" }];
    }
    if (query.includes("from public.support_contacts")) {
      assert.match(query, /request_id = \?.*channel = 'email'.*usage_scope = 'support'.*disabled_at is null.*\(\?::uuid is null or id = \?::uuid\)/);
      assert.deepEqual(values, values[1] === null ? ["request-a", null, null] : ["request-a", "contact-a", "contact-a"]);
      return contactAvailable ? [{ value: "fictitious@example.org" }] : [];
    }
    if (query.includes("from public.support_messages")) {
      assert.match(query, /where id = \? and request_id = \?.*direction = 'outbound'.*channel = 'email'/);
      assert.deepEqual(values, ["message-a", "request-a"]);
      return messageAvailable ? [{ body_text: "Fictif", delivery_status: "queued" }] : [];
    }
    if (query.includes("from public.support_attachments")) {
      assert.match(query, /message_id = \?.*request_id = \?.*direction = 'agent'.*scan_status = 'clean'/);
      assert.deepEqual(values, ["message-a", "request-a"]); return [{ count: 0 }];
    }
    if (query.startsWith("update public.support_messages")) {
      assert.match(query, /where id = \? and request_id = \?/);
      assert.deepEqual(values, ["fictitious-provider-id", "message-a", "request-a"]); return [];
    }
    assert.fail(`Unexpected SQL: ${query}`);
  };
  const context = {
    sql, process: { env: {} }, senderName: "Test", senderEmail: "support@example.org",
    publicUrl: "https://example.org/prototype", agentUrl: "https://example.org/prototype", agentEmail: "agent@example.org",
    sendEmail: async (value) => { sent.push(value); return "fictitious-provider-id"; },
    exports: {}, reservedAddress,
  };
  vm.runInNewContext(declarations.map((node) => node.getText(ast)).join("\n")
    + "\nisTestAddress = (value) => reservedAddress && value === 'fictitious@example.org'; exports.deliver = deliver;", context);
  return { sent, queries, deliver: context.exports.deliver,
    job: { job_type: "send_requester_reply", job_id: "job-a", request_id: "request-a", institution_id: "school-a",
      contact_id: "contact-a", message_id: "message-a", access_token: token } };
}
test("VPS real functions emit contact-bound SQL and a scoped outgoing reply", async () => {
  const item = vpsDelivery();
  await item.deliver(item.job, "school-a");
  assert.equal(item.sent.length, 1);
  assert.equal(item.queries.length, 5);
});
for (const kind of ["notify_requester_request_created", "send_requester_reply"]) {
  test(`VPS ${kind}: unavailable bound contact leaves the job unsent`, async () => {
    const item = vpsDelivery({ contactAvailable: false }); item.job.job_type = kind;
    await assert.rejects(item.deliver(item.job, "school-a"), /requester_contact_unavailable/);
    assert.equal(item.sent.length, 0);
  });
  test(`VPS ${kind}: unbound job cannot query an arbitrary contact`, async () => {
    const item = vpsDelivery(); item.job.job_type = kind; delete item.job.contact_id;
    await assert.rejects(item.deliver(item.job, "school-a"), /requester_contact_unavailable/);
    assert.equal(item.sent.length, 0);
    assert.equal(item.queries.length, 0);
  });
}
test("VPS rejects a message outside the SQL predicate without sending", async () => {
  const item = vpsDelivery({ messageAvailable: false });
  await assert.rejects(item.deliver(item.job, "school-a"), /reply_message_not_found/);
  assert.equal(item.sent.length, 0);
});
test("VPS internal notification is independent of requester contact availability", async () => {
  const item = vpsDelivery({ contactAvailable: false }); item.job.job_type = "notify_agent_message_received"; delete item.job.contact_id;
  await item.deliver(item.job, "school-a");
  assert.equal(item.sent.length, 1);
  assert.equal(item.sent[0].to.email, "agent@example.org");
  assert.equal(item.queries.length, 2);
});
test("VPS reserved test requests never notify an agent even without a contact ID", async () => {
  const item = vpsDelivery({ reservedAddress: true }); item.job.job_type = "notify_agent_message_received"; delete item.job.contact_id;
  assert.equal(await item.deliver(item.job, "school-a"), "skipped:test_address");
  assert.equal(item.sent.length, 0);
});
test("real Drizzle SQL locks the bound contact and old session before inheriting grants", async () => {
  const realSchema = load("db/schema.ts", { "drizzle-orm": realOrm, "drizzle-orm/pg-core": pgCore });
  const mock = drizzle.mock(), queries = [];
  const responses = [[{ id: "contact-a" }], [{ id: "new-session" }], [{ id: "old-session" }],
    [{ requestId: "request-b" }], [], [], [], [{ id: "contact-a" }], []];
  function wrap(query) {
    return new Proxy(query, { get(target, name) {
      if (name === "then") return (success, failure) => {
        queries.push(target.toSQL());
        assert.ok(responses.length > 0, "unexpected SQL must extend this test");
        return Promise.resolve(responses.shift()).then(success, failure);
      };
      const member = Reflect.get(target, name);
      return typeof member === "function" ? (...args) => wrap(member.apply(target, args)) : member;
    } });
  }
  const tx = Object.fromEntries(["select", "insert", "update"].map((method) => [method, (...args) => wrap(mock[method](...args))]));
  const { openSupportAccessSession } = load("api/_shared/support-access-session.ts", {
    "node:crypto": { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
    "drizzle-orm": realOrm, "../../db/index.js": { db: {} }, "../../db/schema.js": realSchema,
    "./support.js": { sha256: hash, SUPPORT_SESSION_DAYS: 30 }, "./auth.js": { HttpError },
  });
  await openSupportAccessSession({ tx, institutionId: "school-a", requestId: "request-a", contactId: "contact-a",
    existingSessionToken: "old-token", newSessionToken: "new-token", verificationSource: "email_magic_link",
    label: "Test fictif", now: new Date("2026-09-01T12:00:00Z") });
  assert.equal(queries.length, 9); assert.equal(responses.length, 0);
  assert.match(queries[0].sql, /inner join "support_requests".*"disabled_at" is null.*for update of "support_contacts"/);
  assert.deepEqual(Array.from(queries[0].params).slice(0, 5), ["contact-a", "request-a", "school-a", "email", "support"]);
  assert.match(queries[2].sql, /"support_device_sessions".*"revoked_at" is null.*for update$/);
  assert.match(queries[3].sql, /inner join "support_requests".*"institution_id" = \$2/);
  assert.deepEqual(Array.from(queries[3].params), ["old-session", "school-a"]);
});
