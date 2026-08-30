import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL(
  "../src/pages/prototype/lycee-connect.css",
  import.meta.url
), "utf8");
const page = readFileSync(new URL(
  "../src/pages/prototype/LyceeConnectPrototype.tsx",
  import.meta.url
), "utf8");

test("keeps the smallest public navigation at 320 pixels without a wide fixed track", () => {
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /\.lycee-core-tools \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.lycee-service-grid > button \{ grid-template-columns: 42px minmax\(0,1fr\) 18px;/);
  assert.doesNotMatch(css, /@media \(max-width: 390px\)[\s\S]*?min-width:\s*(?:[4-9]\d\d|\d{4,})px/);
});

test("gives compact public text actions a stable touch target", () => {
  assert.match(css, /\.lycee-trust-row button \{ min-height: 40px; padding: 8px 0;/);
  assert.match(
    css,
    /\.lycee-section-title > button,[^{]+\{ min-height: 40px;[^}]+padding: 8px 0;/
  );
  assert.match(page, /> Confidentialité et sécurité<\/button>/);
  assert.match(page, />Tout afficher <ChevronRight/);
  assert.match(page, />Ouvrir LyceeGest <ChevronRight/);
});

test("keeps the assistant and its safe alternative visible as semantic controls", () => {
  assert.match(page, /id="lycee-assistant-title"/);
  assert.match(page, /aria-label="Écrivez votre question ou votre problème"/);
  assert.match(page, /Je préfère remplir un formulaire/);
  assert.match(css, /\.lycee-composer button \{ min-height: 46px;/);
  assert.match(css, /\.lycee-form-shortcut \{ min-height: 34px;/);
});
