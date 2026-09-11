import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pg-proxy";
import { siteContentAssets } from "../db/schema.ts";
import {
  parseSiteContentOperationsPayload,
  projectSiteContentOperationsPayload,
} from "../shared/site-content-operations-payload.ts";

const payload = {
  generatedAt: "2026-09-01T08:00:00.000Z",
  summary: {
    total: 12,
    pending: 1,
    quarantine: 2,
    quarantineOver15m: 1,
    ready: 6,
    blocked: 1,
    scanError: 1,
    archived: 1,
    legacyReadyWithoutScan: 4,
    oldestQuarantineAt: "2026-09-01T07:30:00.000Z",
    lastScanAt: "2026-09-01T07:45:00.000Z",
  },
};

// Exercise the actual route and Drizzle codecs at the driver boundary. PostgreSQL
// returns timestamp aggregates as wire strings, not JavaScript Date instances.
async function routeFixture({ rows, denied = false, checkParameter = true } = {}) {
  let reads = 0;
  const db = drizzle(async (query, params) => {
    reads++;
    assert.match(query, /^select /);
    if (checkParameter) {
      assert.equal(params.length, 1);
      assert.equal(typeof params[0], "string", "the SQL driver cannot bind a raw Date");
      assert.equal(new Date(params[0]).toISOString(), "2026-09-01T07:45:00.000Z");
    }
    return { rows: rows ?? [["12", "1", "2", "1", "6", "1", "1", "1", "4", "2026-09-01 09:30:00+02", "2026-09-01 07:45:00+00"]] };
  });
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [payload.generatedAt])); }
    static now() { return Date.parse(payload.generatedAt); }
  }
  const dependencies = {
    "drizzle-orm": { sql },
    "../../../db/index.js": { db },
    "../../../db/schema.js": { siteContentAssets },
    "../../../shared/site-content-operations-payload.js": { projectSiteContentOperationsPayload },
    "../../_shared/site-content.js": { requireSiteEditor: async () => { if (denied) throw new Error("denied"); } },
    "../../_shared/response.js": {
      handleApi: async (res, fn) => { res.body = await fn(); },
      methodNotAllowed: res => { res.code = 405; },
    },
  };
  const source = await readFile(new URL("../api/content/admin/operations.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date: FixedDate, require: name => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  } });
  return { get reads() { return reads; }, run: async (method = "GET") => {
    const res = { code: 200 };
    await exports.default({ method }, res);
    return res;
  } };
}

test("binds the quarantine deadline as a driver-compatible UTC timestamp", async () => {
  const fixture = await routeFixture();
  assert.deepEqual((await fixture.run()).body, payload);
  assert.equal(fixture.reads, 1);
});

test("decodes PostgreSQL timestamp aggregates before projecting the strict client payload", async () => {
  const fixture = await routeFixture({ checkParameter: false });
  assert.deepEqual((await fixture.run()).body, payload);
});

test("an empty file inventory preserves null scan dates and zero counts", async () => {
  const fixture = await routeFixture({ rows: [["0", "0", "0", "0", "0", "0", "0", "0", "0", null, null]] });
  const result = (await fixture.run()).body;
  assert.ok(parseSiteContentOperationsPayload(result));
  assert.equal(result.summary.total, 0);
  assert.equal(result.summary.oldestQuarantineAt, null);
  assert.equal(result.summary.lastScanAt, null);
});

test("unauthorized access and unsupported methods never query the file inventory", async () => {
  const fixture = await routeFixture({ denied: true });
  await assert.rejects(fixture.run(), /denied/);
  assert.equal((await fixture.run("POST")).code, 405);
  assert.equal(fixture.reads, 0);
});

test("accepts and projects one bounded aggregate health payload", () => {
  assert.deepEqual(parseSiteContentOperationsPayload(payload), payload);
  assert.deepEqual(projectSiteContentOperationsPayload({
    generatedAt: new Date(payload.generatedAt),
    summary: {
      ...payload.summary,
      oldestQuarantineAt: new Date(payload.summary.oldestQuarantineAt),
      lastScanAt: new Date(payload.summary.lastScanAt),
    },
  }), payload);
});

test("rejects private, malformed and internally contradictory health data", () => {
  const invalid = [
    null,
    { ...payload, originalName: "secret.pdf" },
    { ...payload, generatedAt: "today" },
    { ...payload, summary: { ...payload.summary, scanError: -1 } },
    { ...payload, summary: { ...payload.summary, total: 13 } },
    { ...payload, summary: { ...payload.summary, quarantineOver15m: 3 } },
    { ...payload, summary: { ...payload.summary, legacyReadyWithoutScan: 7 } },
    { ...payload, summary: { ...payload.summary, quarantine: 0 } },
    { ...payload, summary: { ...payload.summary, oldestQuarantineAt: null } },
    { ...payload, summary: { ...payload.summary, lastScanAt: "invalid" } },
  ];
  for (const candidate of invalid) {
    assert.equal(parseSiteContentOperationsPayload(candidate), null);
  }
});

test("keeps the route read-only, aggregate and protected by the editor role", async () => {
  const route = await readFile(
    new URL("../api/content/admin/operations.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /req\.method !== "GET"/);
  assert.match(route, /await requireSiteEditor\(req\)/);
  assert.match(route, /count\(\*\) filter/);
  assert.match(route, /legacyReadyWithoutScan/);
  assert.doesNotMatch(route, /originalName|storagePath|createdBy|sourceUrl/);
});

test("validates the health response before replacing the protected view", async () => {
  const page = await readFile(
    new URL("../src/pages/admin/ContentManagerPage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /apiFetch<unknown>\("content\/admin\/operations"\)/);
  const validation = page.indexOf("parseSiteContentOperationsPayload(response)");
  const state = page.indexOf("setFileHealth(data)");
  assert.ok(validation >= 0 && validation < state);
  assert.match(page, /Aucun nouveau fichier en attente/);
  assert.match(page, /L’état des contrôles n’a pas pu être confirmé/);
  const unavailable = page.indexOf("!fileHealth");
  const empty = page.indexOf('"Aucun fichier en attente."');
  assert.ok(unavailable >= 0 && unavailable < empty);
  assert.match(page, /Le fonds repris de l’ancien site n’a pas encore été rescanné/);
});
