import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../api/support/agent/requests/index.ts", import.meta.url),
  "utf8"
);

test("serializes agent queue queries for the single serverless connection", () => {
  assert.match(source, /const requests = await requestQuery;/);
  assert.match(source, /const \[totalRow\] = await totalQuery;/);
  assert.match(source, /const \[statsRow\] = await statsQuery;/);
  assert.match(source, /const serviceStats = await serviceStatsQuery;/);
  assert.doesNotMatch(source, /Promise\.all\(\[\s*requestQuery/);
});
