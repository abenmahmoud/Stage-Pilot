import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const api = await readFile(
  new URL("../api/support/agent/operations/index.ts", import.meta.url),
  "utf8"
);
const page = await readFile(
  new URL("../src/pages/admin/SupportOperationsPage.tsx", import.meta.url),
  "utf8"
);

test("scopes every resolution aggregate to the agent institution", () => {
  assert.match(api, /requireSupportOperationsManager\(req\)/);
  const occurrences = api.match(/eq\(supportRequests\.institutionId, context\.institutionId\)/g) ?? [];
  assert.ok(occurrences.length >= 7);
  assert.match(api, /gte\(supportRequests\.createdAt, activitySince\)/);
});

test("returns only bounded categories and numeric aggregates", () => {
  assert.match(api, /\.groupBy\(supportRequests\.category\)/);
  assert.match(api, /\.limit\(5\)/);
  assert.match(api, /averageResolutionHours/);
  assert.match(api, /p90ResolutionHours/);
  assert.match(api, /resolutionRate/);
  assert.doesNotMatch(api, /activity30d:[\s\S]*supportRequests\.(subject|description|requesterFirstName)/);
});

test("labels the activity as aggregate and handles an empty period", () => {
  assert.match(page, /Indicateurs agrégés, sans identité ni contenu de dossier/);
  assert.match(page, /Aucune demande sur cette période/);
  assert.match(page, /CATEGORY_LABELS/);
  assert.match(page, /durationLabel/);
  assert.match(page, /resolved > 0[\s\S]*Aucune résolution/);
});
