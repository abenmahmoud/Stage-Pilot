import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/pages/prototype/lycee-connect.css", import.meta.url), "utf8");

test("keeps queue failures separate from other agent errors", () => {
  assert.match(page, /const \[queueLoadError, setQueueLoadError\] = useState<string \| null>\(null\)/);
  assert.match(page, /setQueueLoadError\(loadError instanceof Error \? loadError\.message : "Impossible de charger les demandes"\)/);
  assert.match(page, /setQueueLoadError\(null\)/);
  assert.doesNotMatch(page, /catch \(loadError\) \{[\s\S]{0,180}setError\(loadError instanceof Error/);
});

test("offers retry only for an ordinary queue failure", () => {
  assert.match(page, /needsAgentSecurity \? <a[\s\S]*needsAgentLogin \? <a[\s\S]*queueLoadError \? <button/);
  assert.match(page, /onClick=\{\(\) => void loadQueue\(\)\}/);
  assert.match(page, /disabled=\{queueLoading\}/);
  assert.match(page, /queueLoading \? "Nouvel essai…" : "Réessayer"/);
});

test("keeps the recovery action readable and stable", () => {
  assert.match(css, /\.lycee-form-error > a, \.lycee-form-error > button \{[^}]*min-height: 34px;[^}]*margin-left: auto;/);
  assert.match(css, /\.lycee-form-error > span \{[^}]*overflow-wrap: anywhere;/);
});
