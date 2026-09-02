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

test("les vues publiques conservent des textes secondaires lisibles", () => {
  assert.match(css, /\.lycee-trust-lead \.lycee-eyebrow,[^\n]+color:\s*#a9dfd3/);
  assert.match(css, /\.lycee-conversation small\s*\{[^}]*color:\s*#43566d;[^}]*font-size:\s*10px/);
  assert.match(css, /\.lycee-programs-grid article > small\s*\{[^}]*color:\s*#52677d;[^}]*font-size:\s*10px/);
  assert.match(css, /\.lycee-school-life-grid small\s*\{[^}]*color:\s*#52677d;[^}]*font-size:\s*10px/);
  assert.match(css, /\.lycee-publication-note small\s*\{[^}]*color:\s*#365f57;[^}]*font-size:\s*10px/);
});

test("les conversations nommées utilisent un rôle journal valide", () => {
  assert.equal((page.match(/className="lycee-conversation" role="log" aria-label=/g) ?? []).length, 2);
});

test("l'assistant public reste visible avant les outils secondaires", () => {
  const heroHelp = page.indexOf('className="lycee-hero-help"');
  const assistant = page.indexOf('className="lycee-assistant"');
  const coreTools = page.indexOf('className="lycee-core-tools"');

  assert.ok(heroHelp >= 0, "le raccourci d'aide du héros doit rester présent");
  assert.ok(assistant > heroHelp, "l'assistant doit suivre le héros");
  assert.ok(coreTools > assistant, "les autres outils doivent suivre l'assistant");
});

test("l'assistant public conserve une saisie libre et une alternative formulaire", () => {
  assert.match(page, /<section className="lycee-assistant" aria-labelledby="lycee-assistant-title">/);
  assert.match(page, /<h2 id="lycee-assistant-title">Posez votre question à l’assistant du lycée<\/h2>/);
  assert.match(page, /aria-label="Écrivez votre question ou votre problème"/);
  assert.match(page, /disabled=\{!message\.trim\(\)\}/);
  assert.match(page, /onClick=\{\(\) => startHelp\("", "form"\)\}/);
  assert.match(page, /Je préfère remplir un formulaire/);
});
