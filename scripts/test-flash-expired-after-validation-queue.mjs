// LOT 2 (plan de publication flash) — Preuves de composition pour le
// compteur consultable des propositions flash expirées APRÈS validation mais
// jamais publiées (api/flash/validation/expired-after-validation.ts, T071F).
//
// Même réserve que scripts/test-flash-expired-queue.mjs (route jumelle,
// T071D) : aucune pile PostgreSQL locale disponible ce soir (Docker Desktop
// non démarré), donc aucune preuve HTTP bout en bout. Vérifie par lecture du
// fichier source que la route réutilise le même accès de file que sa jumelle,
// jamais un contrôle réécrit sur place, et qu'elle filtre sur un statut
// distinct de celui de T071D.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync(new URL("../api/flash/validation/expired-after-validation.ts", import.meta.url), "utf8");
const twinRouteSource = readFileSync(new URL("../api/flash/validation/expired.ts", import.meta.url), "utf8");

test("preuve de wiring : même accès que la file de validation (LOT 3), pas un contrôle réécrit", () => {
  assert.match(routeSource, /assertFlashValidationQueueAccess\(actor\)/);
  assert.match(
    routeSource,
    /import \{ assertFlashValidationQueueAccess, requireFlashActor \} from "\.\.\/\.\.\/_shared\/flash-access\.js";/
  );
});

test("preuve de wiring : filtre exact sur les propositions expirées APRÈS validation, cloisonné par établissement", () => {
  assert.match(routeSource, /eq\(flashInfoVersions\.status, "expiree_sans_publication"\)/);
  assert.match(routeSource, /eq\(flashInfos\.institutionId, actor\.institutionId\)/);
});

test("preuve de séparation : cette route et sa jumelle T071D ne filtrent jamais sur le même statut", () => {
  assert.match(twinRouteSource, /eq\(flashInfoVersions\.status, "expiree_sans_validation"\)/);
  assert.doesNotMatch(routeSource, /eq\(flashInfoVersions\.status, "expiree_sans_validation"\)/);
  assert.doesNotMatch(twinRouteSource, /eq\(flashInfoVersions\.status, "expiree_sans_publication"\)/);
});

test("preuve de wiring : chaque version répondue repasse par le contrat strict de LOT 1", () => {
  assert.match(routeSource, /items:\s*rows\.map\(toFlashVersionPayload\)/);
});

test("preuve de wiring : une file trop longue est refusée plutôt qu'affichée partiellement", () => {
  assert.match(routeSource, /FLASH_EXPIRED_AFTER_VALIDATION_LIST_LIMIT/);
  assert.match(routeSource, /rows\.length > FLASH_EXPIRED_AFTER_VALIDATION_LIST_LIMIT/);
});

test("preuve de wiring : seul GET est accepté", () => {
  assert.match(routeSource, /req\.method !== "GET"/);
  assert.doesNotMatch(routeSource, /req\.method === "POST"/);
});
