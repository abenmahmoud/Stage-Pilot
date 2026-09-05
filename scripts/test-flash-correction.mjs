// LOT 4 — Preuves de composition pour la correction d'une information flash
// déjà publiée (api/flash/proposals/[id]/correction.ts).
//
// La route n'est pas exercée ici (aucune pile PostgreSQL locale disponible
// dans ce shell, cf. docs/operations/night-logs/PERSIST-LOT4.md) : ce script
// ne prouve donc PAS un comportement HTTP bout en bout. Il rejoue, avec les
// MÊMES fonctions pures réellement importées par la route (jamais une
// réimplémentation parallèle), la composition exacte qu'elle exécute, et
// vérifie par lecture du fichier source que cette composition est bien celle
// utilisée en production (même méthode que scripts/test-flash-recette-adverse.mjs
// pour les écrans).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { analyzeFlashVersionGap } from "../shared/flash-version-diff.ts";
import { resolveFlashAudienceTreatment } from "../shared/flash-audience-correction.ts";
import { assertLegalFlashVersionTransition, FlashTransitionError } from "../shared/flash-transitions.ts";

const routeSource = readFileSync(
  new URL("../api/flash/proposals/[id]/correction.ts", import.meta.url),
  "utf8"
);

test("preuve de wiring : la route importe les modules purs réels, ne les réimplémente pas", () => {
  assert.match(routeSource, /import \{ analyzeFlashVersionGap,? ?.*\} from "\.\.\/\.\.\/\.\.\/\.\.\/shared\/flash-version-diff\.js";/);
  assert.match(
    routeSource,
    /import \{ resolveFlashAudienceTreatment,? ?.*\} from "\.\.\/\.\.\/\.\.\/\.\.\/shared\/flash-audience-correction\.js";/
  );
  assert.match(
    routeSource,
    /import \{ assertLegalFlashVersionTransition, FlashTransitionError \} from "\.\.\/\.\.\/\.\.\/\.\.\/shared\/flash-transitions\.js";/
  );
});

test("preuve de wiring : le calcul des trois ensembles vient de la trace réelle des envois (status = 'sent'), jamais de l'importance déclarée", () => {
  assert.match(routeSource, /eq\(flashNotificationDispatches\.status, "sent"\)/);
  assert.doesNotMatch(routeSource, /previousNotifiedChannels:\s*current\.importance/);
  assert.match(
    routeSource,
    /previousNotifiedChannels:\s*previousChannelRows\.map\(\(row\)\s*=>\s*row\.channel\)/
  );
});

test("preuve de wiring : aucun envoi — la route n'écrit jamais dans flash_notification_dispatches", () => {
  assert.doesNotMatch(routeSource, /insert\(flashNotificationDispatches\)/);
  assert.doesNotMatch(routeSource, /fetch\(/);
  assert.doesNotMatch(routeSource, /axios/i);
  assert.doesNotMatch(routeSource, /sendMail|sendGrid|twilio|nodemailer/i);
});

test("preuve de wiring : la transition légale est déléguée à flash-transitions.ts, pas réécrite ici", () => {
  assert.match(routeSource, /assertLegalFlashVersionTransition\(current\.status, "modifiee"\)/);
});

// Cas central du plan (LOT 4, "attention au cas corrigé le 5 septembre") :
// une version qui a réellement notifié (canaux issus de la trace, pas de
// l'importance) reste corrigible même si la nouvelle version est ramenée à
// "normale". Rejoué avec la fonction réelle, pas une copie.
test("une version urgente réellement notifiée reste corrigible même ramenée à normale", () => {
  const treatment = resolveFlashAudienceTreatment({
    previousAudience: ["classe:2ndea", "personnel:enseignants"],
    nextAudience: ["classe:2ndea", "personnel:enseignants"],
    previousNotifiedChannels: ["push", "email", "sms"],
    nextImportance: "normale",
  });
  assert.equal(treatment.correctionPossible, true, "la correction reste due malgré le retour à normale");
  assert.deepEqual(treatment.maintained, ["classe:2ndea", "personnel:enseignants"]);
  assert.deepEqual(treatment.removed, []);
  assert.deepEqual(treatment.added, [], "aucun ajouté : une version normale ne notifie jamais un public neuf");
  assert.deepEqual(treatment.eligibleChannels, ["email", "push", "sms"]);
});

// Cas symétrique : rien n'a jamais notifié et la nouvelle version reste
// normale -> rien à corriger (seul le site change), et la route doit quand
// même pouvoir transiter publiee -> modifiee (texte corrigé sur le site).
test("aucune notification réelle et nouvelle version normale : rien à corriger, mais le texte du site reste corrigible", () => {
  const treatment = resolveFlashAudienceTreatment({
    previousAudience: ["parents:cantine"],
    nextAudience: ["parents:cantine"],
    previousNotifiedChannels: [],
    nextImportance: "normale",
  });
  assert.equal(treatment.correctionPossible, false);
  assert.deepEqual(treatment.maintained, []);
  assert.deepEqual(treatment.removed, []);
  assert.deepEqual(treatment.added, []);
});

// L'écart (décisif/forme) est calculé par la même fonction que les autres
// lots, jamais réécrit : une reformulation sans changement de sens reste
// "forme" même sur une flash publiée.
test("écart de forme sur une flash publiée : gapKind = 'forme'", () => {
  const gap = analyzeFlashVersionGap(
    { title: "Portes ouvertes du lycée", bodyMarkdown: "Accueil à partir de 9h00.", importance: "importante" },
    { title: "Portes ouvertes du lycée.", bodyMarkdown: "accueil à partir de 9h00", importance: "importante" }
  );
  assert.equal(gap.kind, "forme");
});

test("écart décisif sur une flash publiée : changement d'heure détecté", () => {
  const gap = analyzeFlashVersionGap(
    { title: "Portes ouvertes du lycée", bodyMarkdown: "Accueil à partir de 9h00.", importance: "importante" },
    { title: "Portes ouvertes du lycée", bodyMarkdown: "Accueil à partir de 10h30.", importance: "importante" }
  );
  assert.equal(gap.kind, "decisif");
});

test("transition illégale refusée : impossible de corriger une version déjà 'modifiee' (état terminal)", () => {
  assert.throws(
    () => assertLegalFlashVersionTransition("modifiee", "modifiee"),
    (error) => error instanceof FlashTransitionError && error.reason === "not_a_transition"
  );
  assert.throws(
    () => assertLegalFlashVersionTransition("proposee", "modifiee"),
    (error) => error instanceof FlashTransitionError && error.reason === "transition_illegal",
    "une proposition non publiée ne peut pas être 'corrigée après publication'"
  );
});

test("seule transition légale possible depuis 'publiee' : 'modifiee'", () => {
  assert.equal(assertLegalFlashVersionTransition("publiee", "modifiee"), "modifiee");
});
