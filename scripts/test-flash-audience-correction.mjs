import assert from "node:assert/strict";
import test from "node:test";

import {
  FlashAudienceError,
  parseFlashGroupRef,
  resolveFlashAudienceTreatment,
} from "../shared/flash-audience-correction.ts";

const CLASSE_A = "classe:2nde4";
const CLASSE_B = "classe:2nde5";
const CLASSE_C = "classe:1ere2";

test("groupRef refuse un format invalide (email, trop court, caractere interdit)", () => {
  assert.throws(() => parseFlashGroupRef("a@b"), (error) => error instanceof FlashAudienceError);
  assert.throws(() => parseFlashGroupRef("ab"), (error) => error instanceof FlashAudienceError);
  assert.equal(parseFlashGroupRef(CLASSE_A), CLASSE_A);
});

test("audience reduite : un retire recoit la ligne, aucun ajoute", () => {
  const treatment = resolveFlashAudienceTreatment({
    previousAudience: [CLASSE_A, CLASSE_B],
    nextAudience: [CLASSE_A],
    previousNotifiedChannels: ["push"],
    nextImportance: "importante",
  });
  assert.deepEqual(treatment.maintained, [CLASSE_A]);
  assert.deepEqual(treatment.removed, [CLASSE_B]);
  assert.deepEqual(treatment.added, []);
  assert.equal(treatment.correctionPossible, true);
  assert.deepEqual(treatment.eligibleChannels, ["push"]);
});

test("audience elargie : l'ajoute recoit une information neuve, pas une correction pour lui", () => {
  const treatment = resolveFlashAudienceTreatment({
    previousAudience: [CLASSE_A],
    nextAudience: [CLASSE_A, CLASSE_B],
    previousNotifiedChannels: ["push", "email"],
    nextImportance: "urgente",
  });
  assert.deepEqual(treatment.maintained, [CLASSE_A]);
  assert.deepEqual(treatment.removed, []);
  assert.deepEqual(treatment.added, [CLASSE_B]);
  assert.equal(treatment.correctionPossible, true);
});

test("audience remplacee entierement : tout est retire d'un cote, tout est ajoute de l'autre", () => {
  const treatment = resolveFlashAudienceTreatment({
    previousAudience: [CLASSE_A, CLASSE_B],
    nextAudience: [CLASSE_C],
    previousNotifiedChannels: ["push"],
    nextImportance: "importante",
  });
  assert.deepEqual(treatment.maintained, []);
  assert.deepEqual(treatment.removed, [CLASSE_A, CLASSE_B]);
  assert.deepEqual(treatment.added, [CLASSE_C]);
  assert.equal(treatment.correctionPossible, true);
});

test("flash normale modifiee : aucune correction possible, les trois ensembles sont vides", () => {
  const treatment = resolveFlashAudienceTreatment({
    previousAudience: [CLASSE_A],
    nextAudience: [CLASSE_A, CLASSE_B],
    previousNotifiedChannels: [],
    nextImportance: "normale",
  });
  assert.deepEqual(treatment.maintained, []);
  assert.deepEqual(treatment.removed, []);
  assert.deepEqual(treatment.added, []);
  assert.deepEqual(treatment.eligibleChannels, []);
  assert.equal(treatment.correctionPossible, false);
});

test("passage normale -> urgente : tout le public passe en ajoutes, ce n'est pas une correction", () => {
  const treatment = resolveFlashAudienceTreatment({
    previousAudience: [CLASSE_A, CLASSE_B],
    nextAudience: [CLASSE_A, CLASSE_B],
    previousNotifiedChannels: [], // une flash normale ne notifie jamais reellement
    nextImportance: "urgente",
  });
  assert.deepEqual(treatment.maintained, []);
  assert.deepEqual(treatment.removed, []);
  assert.deepEqual(treatment.added, [CLASSE_A, CLASSE_B]);
  assert.equal(treatment.correctionPossible, false);
});

test("les canaux eligibles sont dedupliques et tries, jamais lus depuis l'importance declaree", () => {
  const treatment = resolveFlashAudienceTreatment({
    previousAudience: [CLASSE_A],
    nextAudience: [CLASSE_A],
    previousNotifiedChannels: ["email", "push", "push"],
    nextImportance: "importante",
  });
  assert.deepEqual(treatment.eligibleChannels, ["email", "push"]);
});

test("un canal inconnu dans previousNotifiedChannels est refuse", () => {
  assert.throws(
    () =>
      resolveFlashAudienceTreatment({
        previousAudience: [CLASSE_A],
        nextAudience: [CLASSE_A],
        previousNotifiedChannels: ["fax"],
        nextImportance: "importante",
      }),
    (error) => error instanceof FlashAudienceError
  );
});
