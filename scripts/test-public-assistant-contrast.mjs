import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("../src/pages/prototype/lycee-connect.css", import.meta.url),
  "utf8"
);
const page = readFileSync(
  new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
  "utf8"
);

test("le sous-état d'analyse reste lisible", () => {
  const rule = css.match(/\.lycee-live-analysis small\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(rule, /color:\s*#355c54/);
  assert.match(rule, /font-size:\s*10px/);
  assert.doesNotMatch(rule, /font-size:\s*[0-8]px/);
});

test("la liste des parcours du héros expose une sémantique valide", () => {
  assert.match(page, /className="lycee-hero-tracks" role="list" aria-label="Parcours proposés"/);
  assert.equal((page.match(/<span role="listitem">/g) ?? []).length >= 4, true);
});
