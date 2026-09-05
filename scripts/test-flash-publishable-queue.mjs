// LOT 3 du plan de publication flash — Preuves de composition pour la file
// des versions validées en attente de publication
// (api/flash/validation/publishable.ts). Même réserve que les files jumelles
// (queue.ts, expired.ts, expired-after-validation.ts) : aucune pile
// PostgreSQL locale disponible ce soir (Docker Desktop indisponible), donc
// aucune preuve HTTP bout en bout. Vérifie par lecture du fichier source que
// la route réutilise le même accès et le même calcul d'autorisation que la
// file de validation, jamais un contrôle réécrit sur place.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync(new URL("../api/flash/validation/publishable.ts", import.meta.url), "utf8");

test("preuve de wiring : même accès de file que la validation (LOT 3 persistance), pas un contrôle réécrit", () => {
  assert.match(routeSource, /assertFlashValidationQueueAccess\(actor\)/);
  assert.match(
    routeSource,
    /import \{ assertFlashValidationQueueAccess, requireFlashActor \} from "\.\.\/\.\.\/_shared\/flash-access\.js";/
  );
});

test("preuve de wiring : l'autorisation de publier vient du même calcul que celle de valider", () => {
  assert.match(routeSource, /decideFlashValidationAccess\(\{/);
  assert.match(
    routeSource,
    /import \{ decideFlashValidationAccess \} from "\.\.\/\.\.\/\.\.\/shared\/flash-validation-access\.js";/
  );
});

test("preuve de wiring : filtre exact sur les versions validées, cloisonné par établissement", () => {
  assert.match(routeSource, /eq\(flashInfoVersions\.status, "validee"\)/);
  assert.match(routeSource, /eq\(flashInfos\.institutionId, actor\.institutionId\)/);
});

test("preuve de wiring : chaque version répondue repasse par le contrat strict de LOT 1, le nom de l'auteur par son propre contrat", () => {
  assert.match(routeSource, /toFlashVersionPayload\(row\)/);
  assert.match(routeSource, /toFlashAuthorNamePayload\(/);
  assert.match(routeSource, /resolveFlashAuthorNames\(/);
});

test("preuve de wiring : une file trop longue est refusée plutôt qu'affichée partiellement", () => {
  assert.match(routeSource, /FLASH_PUBLISHABLE_QUEUE_LIMIT/);
  assert.match(routeSource, /rows\.length > FLASH_PUBLISHABLE_QUEUE_LIMIT/);
});

test("preuve de wiring : seul GET est accepté", () => {
  assert.match(routeSource, /req\.method !== "GET"/);
  assert.doesNotMatch(routeSource, /req\.method === "POST"/);
});
