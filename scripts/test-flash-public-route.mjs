// LOT 2 du plan de visibilité publique — Preuves de composition pour
// GET /api/content/flash/public. Comme les files jumelles
// (test-flash-published-queue.mjs), aucune pile PostgreSQL locale disponible
// dans cette session : preuve de wiring par lecture de la source, pas de
// preuve HTTP bout en bout. À rejouer en base réelle au LOT 6.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync(new URL("../api/content/flash/public.ts", import.meta.url), "utf8");

test("preuve de wiring : seul GET est accepté, route anonyme (aucun actor requis)", () => {
  assert.match(routeSource, /req\.method !== "GET"/);
  assert.doesNotMatch(routeSource, /requireFlashActor/);
  assert.doesNotMatch(routeSource, /assertFlashValidationQueueAccess/);
});

test("preuve de wiring : filtre exact sur les versions publiées non expirées", () => {
  assert.match(routeSource, /eq\(flashInfoVersions\.status, "publiee"\)/);
  assert.match(routeSource, /gt\(flashInfoVersions\.expiresAt, now\)/);
});

test("preuve de wiring : jointure à plat sur l'audience publique, jamais de sous-requête corrélée", () => {
  assert.match(routeSource, /eq\(flashInfoAudiences\.groupRef, FLASH_PUBLIC_AUDIENCE_GROUP_REF\)/);
  assert.doesNotMatch(routeSource, /sql`/);
});

test("preuve de wiring : la visibilité définitive repasse par le module pur de LOT 1, pas réimplémentée ici", () => {
  assert.match(routeSource, /import \{ FLASH_PUBLIC_AUDIENCE_GROUP_REF, selectVisibleFlashVersions \} from "\.\.\/\.\.\/\.\.\/shared\/flash-visibility\.js";/);
  assert.match(routeSource, /selectVisibleFlashVersions\(candidates, \{ now, viewerGroupRefs: null \}\)/);
});

test("preuve de wiring : tri et bornage viennent du module pur dédié, pas d'un ORDER BY improvisé sur l'importance", () => {
  assert.match(routeSource, /import \{ selectFlashPublicFeedPage \} from "\.\.\/\.\.\/\.\.\/shared\/flash-public-feed\.js";/);
  assert.match(routeSource, /selectFlashPublicFeedPage\(/);
});

test("preuve de wiring : chaque élément repasse par le contrat de charge strict avant de partir", () => {
  assert.match(routeSource, /toPublicFlashItemPayload\(\{/);
});

test("preuve de wiring : aucun champ interne (auteur, valideur, audience brute, id de proposition) n'est jamais lu depuis les lignes", () => {
  assert.doesNotMatch(routeSource, /proposedBy/);
  assert.doesNotMatch(routeSource, /validatedBy/);
  assert.doesNotMatch(routeSource, /publishedBy/);
  assert.doesNotMatch(routeSource, /flashInfoId: flashInfoVersions\.flashInfoId/);
});
