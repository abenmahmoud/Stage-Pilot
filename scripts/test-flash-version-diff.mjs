import assert from "node:assert/strict";
import test from "node:test";

import { analyzeFlashVersionGap, FlashVersionDiffError } from "../shared/flash-version-diff.ts";

const BASE = {
  title: "Sortie pedagogique 2nde 4",
  bodyMarkdown: "La sortie a lieu le 12 mars a 9h, rendez-vous devant le lycee.",
  importance: "importante",
};

test("correction de forme seule (orthographe/ponctuation) est classee forme", () => {
  const reformulated = {
    ...BASE,
    bodyMarkdown: "La sortie a lieu le 12 mars a 9h, rendez-vous devant le lycee !",
  };
  const analysis = analyzeFlashVersionGap(BASE, reformulated);
  assert.equal(analysis.kind, "forme");
  assert.equal(analysis.importanceChanged, false);
  assert.equal(analysis.normalizedTextChanged, false);
});

test("un simple changement de casse ou d'espace est classe forme", () => {
  const respaced = {
    ...BASE,
    title: "  Sortie   pedagogique 2nde 4  ",
    bodyMarkdown: BASE.bodyMarkdown.toUpperCase(),
  };
  const analysis = analyzeFlashVersionGap(BASE, respaced);
  assert.equal(analysis.kind, "forme");
});

test("changement d'heure seul est classe decisif", () => {
  const rescheduled = {
    ...BASE,
    bodyMarkdown: "La sortie a lieu le 12 mars a 14h, rendez-vous devant le lycee.",
  };
  const analysis = analyzeFlashVersionGap(BASE, rescheduled);
  assert.equal(analysis.kind, "decisif");
  assert.equal(analysis.importanceChanged, false);
  assert.equal(analysis.normalizedTextChanged, true);
});

test("un changement d'importance seul est toujours decisif, meme texte identique", () => {
  const escalated = { ...BASE, importance: "urgente" };
  const analysis = analyzeFlashVersionGap(BASE, escalated);
  assert.equal(analysis.kind, "decisif");
  assert.equal(analysis.importanceChanged, true);
  assert.equal(analysis.normalizedTextChanged, false);
});

test("passage normale -> urgente est decisif meme sans toucher au texte", () => {
  const normale = { ...BASE, importance: "normale" };
  const urgente = { ...BASE, importance: "urgente" };
  const analysis = analyzeFlashVersionGap(normale, urgente);
  assert.equal(analysis.kind, "decisif");
  assert.equal(analysis.importanceChanged, true);
});

test("une annulation ecrite dans le texte est decisive (changement de texte reel)", () => {
  const cancelled = { ...BASE, bodyMarkdown: "La sortie du 12 mars est annulee." };
  const analysis = analyzeFlashVersionGap(BASE, cancelled);
  assert.equal(analysis.kind, "decisif");
});

test("un champ inconnu ou un contenu invalide est refuse", () => {
  assert.throws(
    () => analyzeFlashVersionGap({ ...BASE, extra: true }, BASE),
    (error) => error instanceof FlashVersionDiffError && error.reason === "unknown_field"
  );
  assert.throws(
    () => analyzeFlashVersionGap({ ...BASE, importance: "critique" }, BASE),
    (error) => error instanceof FlashVersionDiffError
  );
});
