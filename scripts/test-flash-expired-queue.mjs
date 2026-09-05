// LOT 5 — Preuves de composition pour le compteur consultable des
// propositions flash expirées sans validation (api/flash/validation/expired.ts,
// T071D : « rendre le compte de ces échecs consultable »).
//
// Même réserve que scripts/test-flash-expiry-cron.mjs : aucune pile
// PostgreSQL locale disponible ce soir, donc aucune preuve HTTP bout en
// bout. Vérifie par lecture du fichier source que la route réutilise bien
// l'accès de file déjà écrit au LOT 3, jamais un contrôle réécrit sur place.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync(new URL("../api/flash/validation/expired.ts", import.meta.url), "utf8");

test("preuve de wiring : même accès que la file de validation (LOT 3), pas un contrôle réécrit", () => {
  assert.match(routeSource, /assertFlashValidationQueueAccess\(actor\)/);
  assert.match(
    routeSource,
    /import \{ assertFlashValidationQueueAccess, requireFlashActor \} from "\.\.\/\.\.\/_shared\/flash-access\.js";/
  );
});

test("preuve de wiring : filtre exact sur les propositions expirées sans validation, cloisonné par établissement", () => {
  assert.match(routeSource, /eq\(flashInfoVersions\.status, "expiree_sans_validation"\)/);
  assert.match(routeSource, /eq\(flashInfos\.institutionId, actor\.institutionId\)/);
});

test("preuve de wiring : chaque version répondue repasse par le contrat strict de LOT 1", () => {
  assert.match(routeSource, /items:\s*rows\.map\(toFlashVersionPayload\)/);
});

test("preuve de wiring : une file trop longue est refusée plutôt qu'affichée partiellement", () => {
  assert.match(routeSource, /FLASH_EXPIRED_LIST_LIMIT/);
  assert.match(routeSource, /rows\.length > FLASH_EXPIRED_LIST_LIMIT/);
});

test("preuve de wiring : seul GET est accepté", () => {
  assert.match(routeSource, /req\.method !== "GET"/);
  assert.doesNotMatch(routeSource, /req\.method === "POST"/);
});
