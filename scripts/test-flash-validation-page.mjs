// Verifications statiques de l'ecran de validation des informations flash
// (LOT 6 : branchement sur /api/flash/validation/queue,
// /api/flash/validation/expired et /api/flash/proposals/[id]/decision). Pas
// de rendu reel dans un navigateur : ce script relit le code source et
// verifie l'appel reel via `apiFetch`, la verification stricte des contrats
// de reponse (LOT 1) avant affichage, l'autorisation par service remontee
// jusqu'a l'ecran (T071E, `access.allowed`/`access.reason`) plutot que
// recalculee par role cote client, le message factuel T071D, et la
// disposition mobile-first.
//
// La correction apres publication (LOT 4) et la modification du texte avant
// validation (LOT 3, decision avec `content`) restent hors de cet ecran :
// aucune route ne renvoie la version precedente ni l'audience necessaires a
// cet affichage (voir le compte rendu du LOT 6, "Ce qui reste a brancher").
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  new URL("../src/pages/admin/FlashValidationPage.tsx", import.meta.url),
  "utf8"
);

test("lit la file et les expirations via apiFetch, jamais un appel direct au reseau ou a supabase", () => {
  assert.match(page, /import \{ apiFetch \} from "\.\.\/\.\.\/lib\/api"/);
  assert.match(page, /apiFetch<unknown>\("flash\/validation\/queue"\)/);
  assert.match(page, /apiFetch<unknown>\("flash\/validation\/expired"\)/);
  assert.doesNotMatch(page, /(?<!api)[Ff]etch\(/);
  assert.doesNotMatch(page, /supabase/i);
  assert.doesNotMatch(page, /axios/i);
  assert.doesNotMatch(page, /XMLHttpRequest/);
});

test("decide via POST /api/flash/proposals/[id]/decision, sans recalculer la transition cote client", () => {
  assert.match(page, /apiFetch<unknown>\(`flash\/proposals\/\$\{flashInfoId\}\/decision`/);
  assert.match(page, /method: "POST"/);
  assert.match(page, /decision: target, content: null/);
});

test("verifie les contrats de reponse stricts (LOT 1) avant d'afficher la file, les expirations ou une decision", () => {
  assert.match(page, /isValidFlashInfoVersionPayload/);
  assert.match(page, /isValidFlashValidationAccessPayload/);
  assert.match(page, /isFlashValidationQueuePayload/);
  assert.match(page, /isFlashExpiredListPayload/);
  assert.match(page, /isFlashDecisionConfirmationPayload/);
});

test("l'autorisation de decider vient de l'access renvoye par le serveur (T071E), pas d'un role recalcule a l'ecran", () => {
  assert.match(page, /access\.allowed/);
  assert.match(page, /access\.selfValidated/);
  assert.match(page, /ACCESS_REASON_LABEL/);
  assert.doesNotMatch(page, /user\.role\s*===/);
  assert.doesNotMatch(page, /decideFlashValidationAccess/);
});

test("previent factuellement l'auteur d'une proposition expiree sans validation, sans mettre en cause un valideur", () => {
  assert.match(page, /cette proposition n'a pas été publiée, faute de/);
  assert.match(page, /personne n'a été informé/);
  assert.doesNotMatch(page, /la faute (du|de la|d'un|d'une)/i);
  assert.match(page, /Échecs comptés et consultables/);
});

test("signale explicitement que la modification avant validation et la correction apres publication ne sont pas branchees", () => {
  assert.match(page, /modification du texte avant\s*\n?\s*validation et la correction après publication ne sont pas branchées/);
});

test("reste mobile-first : pas de largeur fixe superieure a 320 px qui casserait l'ecran le plus etroit", () => {
  assert.doesNotMatch(page, /min-w-\[(3[3-9]\d|[4-9]\d{2}|\d{4,})px\]/);
  assert.doesNotMatch(page, /<table/);
});

test("garde des cibles tactiles d'au moins 40 pixels sur les actions", () => {
  assert.match(page, /min-h-\[40px\]/);
});
