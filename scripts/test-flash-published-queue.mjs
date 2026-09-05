// LOT 3 du plan de publication flash — Preuves de composition pour la file
// des versions publiées (api/flash/validation/published.ts), qui alimente
// enfin l'écran de correction (POST .../correction, jusqu'ici jamais appelé
// par aucun écran). Même réserve que les files jumelles : aucune pile
// PostgreSQL locale disponible ce soir, donc aucune preuve HTTP bout en bout.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync(new URL("../api/flash/validation/published.ts", import.meta.url), "utf8");

test("preuve de wiring : même accès de file que la validation, pas un contrôle réécrit", () => {
  assert.match(routeSource, /assertFlashValidationQueueAccess\(actor\)/);
  assert.match(
    routeSource,
    /import \{ assertFlashValidationQueueAccess, requireFlashActor \} from "\.\.\/\.\.\/_shared\/flash-access\.js";/
  );
});

test("preuve de wiring : filtre exact sur les versions publiées, cloisonné par établissement", () => {
  assert.match(routeSource, /eq\(flashInfoVersions\.status, "publiee"\)/);
  assert.match(routeSource, /eq\(flashInfos\.institutionId, actor\.institutionId\)/);
});

test("preuve de wiring : l'audience vient d'une seconde requête à plat, jamais d'une sous-requête corrélée", () => {
  assert.match(routeSource, /from\(flashInfoAudiences\)/);
  assert.match(routeSource, /inArray\(flashInfoAudiences\.versionId, versionIds\)/);
  assert.match(routeSource, /eq\(flashInfoAudiences\.institutionId, actor\.institutionId\)/);
  assert.doesNotMatch(routeSource, /sql`/);
});

test("preuve de wiring : chaque version, son audience et le nom de l'auteur repassent par leur contrat strict", () => {
  assert.match(routeSource, /toFlashVersionPayload\(row\)/);
  assert.match(routeSource, /toFlashAudiencePayload\(/);
  assert.match(routeSource, /toFlashAuthorNamePayload\(/);
});

test("preuve de wiring : une liste trop longue est refusée plutôt qu'affichée partiellement", () => {
  assert.match(routeSource, /FLASH_PUBLISHED_LIST_LIMIT/);
  assert.match(routeSource, /rows\.length > FLASH_PUBLISHED_LIST_LIMIT/);
});

test("preuve de wiring : seul GET est accepté", () => {
  assert.match(routeSource, /req\.method !== "GET"/);
  assert.doesNotMatch(routeSource, /req\.method === "POST"/);
});
