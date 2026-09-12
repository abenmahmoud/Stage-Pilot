// Verifications statiques de l'ecran de validation des informations flash.
// Pas de rendu reel dans un navigateur : ce script relit le code source et
// verifie l'appel reel via `apiFetch`, la verification stricte des contrats
// de reponse (LOT 1) avant affichage, l'autorisation par service remontee
// jusqu'a l'ecran (T071E, `access.allowed`/`access.reason`) plutot que
// recalculee par role cote client, le message factuel T071D, et la
// disposition mobile-first.
//
// LOT 3 du plan de publication
// (docs/operations/PLAN_FLASH_PUBLICATION_2026-09-05.md) : la publication
// (POST .../publication) et la correction apres publication
// (POST .../correction, ecrite au LOT 4 du plan de persistance mais jamais
// appelee jusqu'ici) sont desormais branchees sur cet ecran, via les files
// /api/flash/validation/publishable et /api/flash/validation/published. La
// modification du texte avant validation (decision avec `content`) reste
// hors de cet ecran : ce n'est pas dans le perimetre du LOT 3.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  new URL("../src/pages/admin/FlashValidationPage.tsx", import.meta.url),
  "utf8"
);

test("lit les quatre files via apiFetch, jamais un appel direct au reseau ou a supabase", () => {
  assert.match(page, /import \{ apiFetch \} from "\.\.\/\.\.\/lib\/api"/);
  assert.match(page, /apiFetch<unknown>\("flash\/validation\/queue"\)/);
  assert.match(page, /apiFetch<unknown>\("flash\/validation\/expired"\)/);
  assert.match(page, /apiFetch<unknown>\("flash\/validation\/publishable"\)/);
  assert.match(page, /apiFetch<unknown>\("flash\/validation\/published"\)/);
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

test("publie via POST /api/flash/proposals/[id]/publication, sans corps ni recalcul cote client", () => {
  assert.match(
    page,
    /apiFetch<unknown>\(`flash\/proposals\/\$\{flashInfoId\}\/publication\?version=\$\{version\}&notify=\$\{Boolean\(notifyCorrection\[flashInfoId\]\)\}`,\s*\{\s*\n\s*method: "POST",\s*\n\s*\}\);/
  );
});

test("corrige via POST /api/flash/proposals/[id]/correction, en repassant par le contrat de traitement d'audience", () => {
  assert.match(page, /apiFetch<unknown>\(`flash\/proposals\/\$\{correctingId\}\/correction`/);
  assert.match(page, /isValidFlashAudienceTreatmentPayload/);
});

test("verifie les contrats de reponse stricts (LOT 1) avant d'afficher une file, une expiration, une decision, une publication ou une correction", () => {
  assert.match(page, /isValidFlashInfoVersionPayload/);
  assert.match(page, /isValidFlashValidationAccessPayload/);
  assert.match(page, /isFlashValidationQueuePayload/);
  assert.match(page, /isFlashExpiredListPayload/);
  assert.match(page, /isFlashDecisionConfirmationPayload/);
  assert.match(page, /isFlashPublishableQueuePayload/);
  assert.match(page, /isFlashPublicationResultPayload/);
  assert.match(page, /isFlashPublishedListPayload/);
  assert.match(page, /isFlashCorrectionResultPayload/);
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

test("signale explicitement que la modification avant validation reste hors de cet ecran, sans laisser croire que la publication ou la correction le sont aussi", () => {
  assert.match(page, /La modification du texte avant\s*\n?\s*validation n'est pas branchée dans cet écran\./);
  assert.doesNotMatch(page, /la correction après publication ne sont pas branchées/);
  assert.doesNotMatch(page, /la publication n'est pas encore branchée/);
});

test("reste mobile-first : pas de largeur fixe superieure a 320 px qui casserait l'ecran le plus etroit", () => {
  assert.doesNotMatch(page, /min-w-\[(3[3-9]\d|[4-9]\d{2}|\d{4,})px\]/);
  assert.doesNotMatch(page, /<table/);
});

test("garde des cibles tactiles d'au moins 40 pixels sur les actions", () => {
  assert.match(page, /min-h-\[40px\]/);
});

// LOT 2 du plan de correction visible
// (docs/operations/PLAN_FLASH_CORRECTION_VISIBLE_2026-09-05.md) : a la
// confirmation d'une correction, l'ecran doit rappeler qu'elle n'est pas
// encore visible, dire quelle ancienne version le public voit toujours, et
// offrir un bouton de publication immediatement accessible depuis ce rappel.

test("capture le titre et le texte de la version encore publiee AVANT toute frappe dans le formulaire de correction", () => {
  assert.match(
    page,
    /setCorrectionBeforeVersion\(\{ title: item\.version\.title, bodyMarkdown: item\.version\.bodyMarkdown \}\)/
  );
  // Capturee dans openCorrection, pas relue depuis les champs modifiables
  // (correctionTitle/correctionBody), sans quoi le rappel afficherait le
  // nouveau texte au lieu de l'ancien.
  assert.doesNotMatch(page, /previousVersion: \{ title: correctionTitle/);
});

test("le rappel de non-visibilite nomme explicitement l'ancienne version encore servie", () => {
  assert.match(page, /pas visible : il faut la publier pour qu'elle/);
  assert.match(
    page,
    /le public voit toujours l'ancienne\s*\n?\s*version : « \{correctionResult\.previousVersion\.title\} »/
  );
});

test("le bouton de publication du rappel appelle la meme fonction publish(), sans nouvelle route ni recalcul", () => {
  assert.match(page, /onClick=\{\(\) => void publish\(correctionResult\.version\.flashInfoId, correctionResult\.version\.version\)\}/);
  assert.match(page, /Publier la correction maintenant/);
});

test("le rappel disparait une fois cette meme information reellement republiee, jamais avant", () => {
  assert.match(
    page,
    /previous && previous\.version\.flashInfoId === flashInfoId \? null : previous/
  );
});
