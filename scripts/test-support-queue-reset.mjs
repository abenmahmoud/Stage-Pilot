import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/pages/prototype/lycee-connect.css", import.meta.url), "utf8");

test("resets search, queue, service and pagination together", () => {
  assert.match(page, /function resetQueueFilters\(\) \{[\s\S]*setQuery\(""\);[\s\S]*setQueueMode\("all"\);[\s\S]*setServiceFilter\(""\);[\s\S]*setPage\(1\);[\s\S]*\}/);
});

test("disables the reset button when the default view is already active", () => {
  assert.match(page, /const hasQueueFilters = query\.trim\(\)\.length > 0 \|\| queueMode !== "all" \|\| serviceFilter !== ""/);
  assert.match(page, /aria-label="Réinitialiser les filtres"[\s\S]*disabled=\{!hasQueueFilters\}[\s\S]*onClick=\{resetQueueFilters\}/);
});

test("keeps the compact toolbar within stable columns", () => {
  assert.match(css, /grid-template-columns: minmax\(0,1fr\) 40px 40px/);
  assert.match(css, /\.lycee-agent-toolbar > button:disabled/);
});
