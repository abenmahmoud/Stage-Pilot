import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/pages/prototype/lycee-connect.css", import.meta.url), "utf8");

test("announces queue refreshes without replacing the current rows", () => {
  assert.match(page, /className="lycee-agent-list" aria-busy=\{queueLoading\}/);
  assert.match(page, /queueLoading \? <div className="lycee-agent-list-loading" role="status" aria-live="polite"/);
  assert.match(page, /!queueLoading && requests\.length === 0/);
  assert.match(css, /\.lycee-agent-list-loading \{ position: sticky;/);
});

test("only the latest queue request can end the loading state", () => {
  assert.match(page, /finally \{\s*if \(loadId === queueLoadIdRef\.current\) setQueueLoading\(false\);\s*\}/);
});

test("clears an old detail while announcing the selected dossier load", () => {
  assert.match(page, /const code = selectedCode;\s*setDetail\(null\);\s*setDetailLoading\(true\);/);
  assert.match(page, /className="lycee-agent-detail" aria-busy=\{detailLoading\}/);
  assert.match(page, /detailLoading \? <div className="lycee-loading-state" role="status" aria-live="polite"/);
  assert.match(page, /if \(selectedCodeRef\.current === code\) setDetailLoading\(false\)/);
});
