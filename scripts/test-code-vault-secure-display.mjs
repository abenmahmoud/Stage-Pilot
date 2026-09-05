// Verifications statiques du composant securise d'affichage du coffre de
// codes (LOT 4, docs/operations/PLAN_COFFRE_CODES_2026-09-05.md). Comme les
// autres tests d'ecran de ce depot (`test-flash-proposal-page.mjs`), ce
// script relit le code source et verifie par expressions regulieres les
// garanties exigees par le plan : rien dans le titre de la page ni une URL,
// aucun telechargement, copie sans presse-papier persistant, disparition a
// l'expiration, disposition sans largeur fixe qui casserait a 320 px. Pas de
// rendu reel dans un navigateur : ce depot n'a pas de moteur DOM de test.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(
  new URL("../src/components/CodeVaultSecureDisplay.tsx", import.meta.url),
  "utf8"
);

test("reutilise le contrat de visibilite du LOT 3, ne reimplemente pas l'expiration", () => {
  assert.match(
    component,
    /import \{\s*VAULT_DISPLAY_VISIBILITY_SECONDS,\s*isVaultDisplayStillVisible,/
  );
  assert.match(component, /from "\.\.\/\.\.\/shared\/code-vault-policy"/);
  assert.match(component, /isVaultDisplayStillVisible\(revealedAt, now\)/);
});

test("ne touche jamais le titre de la page ni une URL", () => {
  assert.doesNotMatch(component, /document\.title/);
  assert.doesNotMatch(component, /window\.location/);
  assert.doesNotMatch(component, /useSearchParams/);
  assert.doesNotMatch(component, /history\.(push|replace)State/);
});

test("n'est jamais telechargeable : aucun lien ni attribut download", () => {
  assert.doesNotMatch(component, /download=/);
  assert.doesNotMatch(component, /<a\s/);
  assert.doesNotMatch(component, /createObjectURL/);
});

test("n'affiche jamais la valeur dans un champ editable ni ne la journalise", () => {
  assert.doesNotMatch(component, /<input/);
  assert.doesNotMatch(component, /console\.(log|debug|info|warn|error)/);
  assert.match(component, /<code[\s\S]*?\{value\}/);
});

test("copie via l'API presse-papier, jamais par selection d'un champ, et efface la copie apres un delai", () => {
  assert.match(component, /navigator\.clipboard\.writeText\(value\)/);
  assert.match(component, /CLIPBOARD_CLEAR_DELAY_MS = 30_000/);
  assert.match(component, /navigator\.clipboard\.writeText\(""\)/);
  assert.match(component, /clearTimeout\(clipboardClearTimeoutRef\.current\)/);
});

test("disparait de lui-meme a l'expiration, sans action de l'utilisateur", () => {
  assert.match(component, /if \(!stillVisible\)/);
  assert.match(component, /n'est plus affiché/);
  assert.match(component, /onExpire\?\.\(\)/);
  assert.match(component, /hasFiredExpireRef/, "l'expiration ne doit se declencher qu'une seule fois");
});

test("affiche un compte a rebours visible", () => {
  assert.match(component, /role="timer"/);
  assert.match(component, /formatRemaining\(remainingSeconds\)/);
  assert.match(component, /setInterval\(\(\) => setNow\(new Date\(\)\), TICK_INTERVAL_MS\)/);
});

test("reste mobile-first : pas de largeur fixe superieure a 320 px, pas de tableau", () => {
  assert.doesNotMatch(component, /min-w-\[(3[3-9]\d|[4-9]\d{2}|\d{4,})px\]/);
  assert.doesNotMatch(component, /\bw-\[(3[3-9]\d|[4-9]\d{2}|\d{4,})px\]/);
  assert.doesNotMatch(component, /<table/);
  assert.match(component, /w-full/);
});

test("garde une cible tactile d'au moins 40 pixels pour le bouton de copie", () => {
  assert.match(component, /min-h-\[40px\]/);
});
