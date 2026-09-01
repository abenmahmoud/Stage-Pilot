import assert from "node:assert/strict";
import test from "node:test";

import { buildCommunicationWorkflow } from "../shared/communication-workflow.ts";

function states(status, visibility = "public", publicationEnabled = false) {
  return buildCommunicationWorkflow(status, visibility, publicationEnabled).map((step) => step.state);
}

test("moves the current step from deposit to review and publication", () => {
  assert.deepEqual(states("draft"), ["current", "pending", "pending"]);
  assert.deepEqual(states("review"), ["complete", "current", "pending"]);
  assert.deepEqual(states("approved"), ["complete", "complete", "current"]);
});

test("never claims that publishing also delivered a message", () => {
  const published = buildCommunicationWorkflow("published", "public", true);
  assert.equal(published[2].state, "current");
  assert.equal(published[2].description, "Page publiée · diffusion fermée");
  assert.doesNotMatch(published[2].description, /envoyé|livré|destinataire/i);
});

test("keeps an approved internal message closed to publication and delivery", () => {
  const approved = buildCommunicationWorkflow("approved", "internal", true);
  assert.equal(approved[2].state, "current");
  assert.equal(approved[2].description, "Version interne validée · diffusion fermée");
});

test("keeps targeted messages closed without promising a site publication", () => {
  const approved = buildCommunicationWorkflow("approved", "targeted", true);
  const review = buildCommunicationWorkflow("review", "targeted", true);
  assert.equal(approved[2].description, "Version ciblée validée · diffusion fermée");
  assert.equal(review[2].description, "Diffusion ciblée non activée");
  assert.doesNotMatch(`${approved[2].description} ${review[2].description}`, /prête à publier|envoyé|livré/i);
});

test("does not promise activation for an internal draft or review", () => {
  for (const status of ["draft", "review"]) {
    const step = buildCommunicationWorkflow(status, "internal", true)[2];
    assert.equal(step.description, "Parcours interne · diffusion fermée");
    assert.doesNotMatch(step.description, /activation|publier|envoyé|livré/i);
  }
});

test("shows environment activation without inventing a completed action", () => {
  const closed = buildCommunicationWorkflow("approved", "public", false);
  const open = buildCommunicationWorkflow("approved", "public", true);
  assert.equal(closed[2].description, "Validation terminée · activation requise");
  assert.equal(open[2].description, "Prête à publier");
  assert.equal(closed[2].state, "current");
  assert.equal(open[2].state, "current");
});

test("does not expose a false current step for terminal records", () => {
  for (const status of ["archived", "cancelled"]) {
    const steps = buildCommunicationWorkflow(status, "public", true);
    assert.ok(steps.every((step) => step.state === "stopped"));
    assert.equal(steps.some((step) => step.state === "current"), false);
  }
});

test("returns one stable ordered and named three-step journey", () => {
  const steps = buildCommunicationWorkflow("draft", "targeted", false);
  assert.deepEqual(steps.map((step) => step.id), ["deposit", "review", "publish"]);
  assert.deepEqual(steps.map((step) => step.number), [1, 2, 3]);
  assert.deepEqual(steps.map((step) => step.title), ["Déposer", "Vérifier", "Publier et informer"]);
});
