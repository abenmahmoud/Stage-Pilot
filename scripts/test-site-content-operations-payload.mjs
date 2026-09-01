import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
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
