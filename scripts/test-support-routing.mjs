import assert from "node:assert/strict";
import test from "node:test";
import { routeSupportRequest } from "../shared/support-routing.ts";

test("routes digital access and equipment to the digital lead", () => {
  const ent = routeSupportRequest({
    category: "ent",
    description: "Je n'ai plus mon code EduConnect",
  });
  assert.equal(ent.service, "referent_numerique");
  assert.equal(ent.requiredIdentity, "school_identity");
  assert.equal(ent.confidence, "high");

  const laptop = routeSupportRequest({
    category: "ordinateur",
    description: "Le PC portable fourni par le lycée ne démarre plus",
  });
  assert.equal(laptop.service, "referent_numerique");
});

test("routes school administration to the secretariat", () => {
  const route = routeSupportRequest({
    category: "documents_scolarite",
    description: "Il manque une pièce dans le dossier d'inscription",
  });
  assert.equal(route.service, "secretariat");
  assert.equal(route.requiredIdentity, "verified_contact");
});

test("routes absences and student life to the CPE queue", () => {
  const route = routeSupportRequest({
    category: "affectation_classe",
    description: "Mon professeur est absent, est-ce que mon cours est annulé ?",
  });
  assert.equal(route.service, "vie_scolaire");
  assert.equal(route.requiredIdentity, "school_identity");

  const room = routeSupportRequest({
    category: "autre",
    description: "Dans quelle salle est mon prochain cours ?",
  });
  assert.equal(room.service, "vie_scolaire");
  assert.equal(room.requiredIdentity, "school_identity");
});

test("accepts urgent safeguarding intake without delaying it for identity", () => {
  const route = routeSupportRequest({
    category: "autre",
    description: "Je suis en danger et on me menace au lycée",
  });
  assert.equal(route.service, "vie_scolaire");
  assert.equal(route.requiredIdentity, "none");
  assert.equal(route.confidence, "high");
});

test("routes catering and grants to stewardship", () => {
  const route = routeSupportRequest({
    category: "restauration_bourse",
    description: "J'ai une question sur la cantine et la bourse",
  });
  assert.equal(route.service, "intendance");
  assert.equal(route.confidence, "high");
});

test("keeps unknown requests in a human qualification queue", () => {
  const route = routeSupportRequest({
    category: "autre",
    description: "J'ai un problème difficile à expliquer",
  });
  assert.equal(route.service, "administration");
  assert.equal(route.confidence, "low");
  assert.equal(route.reason, "qualification_humaine_requise");
});
