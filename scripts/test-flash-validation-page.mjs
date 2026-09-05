// Verifications statiques de l'ecran de validation/modification des
// informations flash (LOT 4). Pas de rendu reel dans un navigateur : ce
// script relit le code source et verifie par expressions regulieres
// l'absence de tout appel serveur, la presence des garanties exigees par le
// plan de nuit (correction affichee seulement si decisive, trois ensembles
// avec confirmation ensemble par ensemble, message factuel T071D, refus de
// transition illegale) et la disposition mobile-first.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseFlashGroupRef, FlashAudienceError } from "../shared/flash-audience-correction.ts";

const page = readFileSync(
  new URL("../src/pages/admin/FlashValidationPage.tsx", import.meta.url),
  "utf8"
);

test("n'effectue aucun appel reseau ni ecriture serveur", () => {
  assert.doesNotMatch(page, /fetch\(/);
  assert.doesNotMatch(page, /supabase/i);
  assert.doesNotMatch(page, /axios/i);
  assert.doesNotMatch(page, /XMLHttpRequest/);
  assert.doesNotMatch(page, /\.insert\(/);
  assert.doesNotMatch(page, /\.from\(/);
});

test("reutilise les modules purs du LOT 2 plutot que de reinventer les regles", () => {
  assert.match(page, /analyzeFlashVersionGap/);
  assert.match(page, /resolveFlashAudienceTreatment/);
  assert.match(page, /assertLegalFlashVersionTransition/);
  assert.match(page, /checkFlashProposalExpiration/);
});

test("n'affiche la proposition de correction que lorsque l'ecart est decisif (ou demande quand meme)", () => {
  assert.match(page, /analysis\.isDecisive \|\| forcedCorrection/);
  assert.match(page, /Correction de forme : aucune proposition de correction par défaut\./);
  assert.match(page, /Demander quand même une correction/);
  assert.match(page, /Refuser la correction/);
});

test("affiche les trois ensembles avec confirmation ensemble par ensemble", () => {
  assert.match(page, /"maintained", "removed", "added"/);
  assert.match(page, /Maintenus/);
  assert.match(page, /Retirés/);
  assert.match(page, /Ajoutés/);
  assert.match(page, /Cette information ne vous concerne plus\./);
  assert.match(page, /Confirmer/);
});

test("previent factuellement l'auteur d'une proposition expiree sans validation, sans mettre en cause un valideur", () => {
  assert.match(page, /cette proposition n'a pas été publiée, faute de/);
  assert.match(page, /personne n'a été informé/);
  assert.doesNotMatch(page, /la faute (du|de la|d'un|d'une)/i);
  assert.match(page, /Échecs comptés et consultables/);
});

test("aucun envoi : les boutons ne font que preparer et afficher un apercu local", () => {
  assert.match(page, /Préparer la notification de correction \(simulation\)/);
  assert.match(page, /rien n'a été envoyé/);
  assert.match(page, /Mode simulation/);
});

test("respecte le graphe de transitions du LOT 2 (proposee -> validee\\|refusee), refuse le reste", () => {
  assert.match(page, /FlashTransitionError/);
  assert.match(page, /Transition refusée : \{transitionError\}/);
});

test("reste mobile-first : pas de largeur fixe superieure a 320 px qui casserait l'ecran le plus etroit", () => {
  assert.doesNotMatch(page, /min-w-\[(3[3-9]\d|[4-9]\d{2}|\d{4,})px\]/);
  assert.doesNotMatch(page, /<table/);
  assert.match(page, /grid-cols-1 gap-3 sm:grid-cols-2/);
});

test("garde des cibles tactiles d'au moins 40 pixels sur les actions", () => {
  assert.match(page, /min-h-\[40px\]/);
});

test("les references de groupes fictifs respectent le meme filtre que la base (group_ref, LOT 1/LOT 2)", () => {
  const refs = [...page.matchAll(/ref: "([a-z0-9:_-]+)"/g)].map((match) => match[1]);
  assert.ok(refs.length >= 6, "au moins les groupes fictifs attendus");
  for (const ref of refs) {
    assert.doesNotThrow(() => parseFlashGroupRef(ref), `${ref} devrait rester un group_ref valide`);
  }
  assert.throws(() => parseFlashGroupRef("nom@exemple.invalid"), FlashAudienceError);
});
