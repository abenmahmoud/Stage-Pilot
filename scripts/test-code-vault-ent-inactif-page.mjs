// Vérifications statiques du LOT 5
// (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`) : la page
// `src/pages/coffre/CoffreEntInactifPage.tsx` monte réellement
// `CodeVaultSecureDisplay` sur la route du LOT 3 et branche `onExpire` sur
// une nouvelle demande de preuve d'identité (jamais une reprise à
// `verified`), et `src/App.tsx` l'enregistre sur une route protégée. Même
// méthode que `test-flash-validation-route.mjs` : relecture du code source,
// pas de moteur DOM de test dans ce dépôt.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  new URL("../src/pages/coffre/CoffreEntInactifPage.tsx", import.meta.url),
  "utf8"
);
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("appelle la vraie route du LOT 3, jamais une route imaginée", () => {
  assert.match(page, /apiFetch<EntInactifRouteResultLike>\("vault\/ent-inactif"/);
  assert.match(page, /method: "POST"/);
});

test("traduit la réponse par la décision pure du LOT 5, ne recalcule aucune règle ici", () => {
  assert.match(
    page,
    /import \{\s*decideEntInactifScreenState,\s*ENT_INACTIF_PHASE_AFTER_DISPLAY_EXPIRY,/
  );
  assert.match(page, /from "\.\.\/\.\.\/\.\.\/shared\/code-vault-ent-inactif-screen"/);
  assert.match(page, /setScreen\(decideEntInactifScreenState\(result\)\)/);
});

test("monte réellement CodeVaultSecureDisplay quand l'état est revealed et qu'une valeur existe", () => {
  assert.match(page, /import \{ CodeVaultSecureDisplay \} from "\.\.\/\.\.\/components\/CodeVaultSecureDisplay"/);
  assert.match(page, /screen\.kind === "revealed"/);
  assert.match(
    page,
    /<CodeVaultSecureDisplay\s+service="ent"\s+value=\{screen\.value\}\s+revealedAt=\{screen\.revealedAt\}\s+onExpire=\{restartAfterExpiryOrGap\}/
  );
});

test("ne fabrique jamais de valeur de code quand la route n'en renvoie aucune", () => {
  assert.match(page, /screen\.value !== null/);
  assert.match(page, /REVEAL_UNAVAILABLE_MESSAGE\[screen\.reason\]/);
});

test("onExpire relance une nouvelle demande de preuve d'identité, jamais une reprise à verified", () => {
  assert.match(
    page,
    /const restartAfterExpiryOrGap = useCallback\(\(\) => \{[\s\S]{0,200}void requestStep\(ENT_INACTIF_PHASE_AFTER_DISPLAY_EXPIRY, schoolYear, proofChannel\)/
  );
  assert.doesNotMatch(page, /onExpire=\{[^}]*"verified"[^}]*\}/);
});

test("App.tsx monte la page sur une route protégée limitée à élève et professeur", () => {
  assert.match(app, /const CoffreEntInactifPage = lazy\(\(\) => import\("\.\/pages\/coffre\/CoffreEntInactifPage"\)\)/);
  assert.match(
    app,
    /path="coffre\/ent-inactif"[\s\S]{0,160}allowedRoles=\{\["eleve", "professeur"\]\}[\s\S]{0,40}<CoffreEntInactifPage \/>/
  );
});
