import assert from "node:assert/strict";
import test from "node:test";
import { evaluateLaptopIntake } from "../shared/laptop-intake.ts";

function conversation(...messages) {
  return messages.map((content) => ({ role: "requester", content }));
}

test("ignores requests unrelated to a school device", () => {
  assert.equal(evaluateLaptopIntake(conversation("Je n'ai pas reçu mon code ENT")), null);
});

test("asks one useful question for a vague laptop problem", () => {
  const result = evaluateLaptopIntake(conversation("Mon ordinateur portable ne marche plus"));
  assert.equal(result?.intent, "diagnostic");
  assert.equal(result?.readyToCreate, false);
  assert.match(result?.reply ?? "", /problème principal/i);
});

test("stops use immediately for a swollen battery", () => {
  const result = evaluateLaptopIntake(conversation("La batterie de mon PC est gonflée et il chauffe"));
  assert.equal(result?.intent, "danger_materiel");
  assert.equal(result?.urgency, "urgente");
  assert.equal(result?.action, "human_transfer");
  assert.equal(result?.readyToCreate, true);
  assert.match(result?.reply ?? "", /n.utilisez plus/i);
});

test("prepares a lost-device report without asking for a secret", () => {
  const result = evaluateLaptopIntake(conversation("J'ai perdu l'ordinateur prêté par le lycée"));
  assert.equal(result?.intent, "perte_vol");
  assert.equal(result?.readyToCreate, true);
  assert.doesNotMatch(result?.reply ?? "", /donnez.*mot de passe/i);
});

test("uses the charger light as the single next diagnostic", () => {
  const first = evaluateLaptopIntake(conversation("Mon ordinateur ne démarre plus"));
  assert.equal(first?.readyToCreate, false);
  assert.match(first?.reply ?? "", /voyant/i);

  const second = evaluateLaptopIntake(
    conversation("Mon ordinateur ne démarre plus", "Il n'y a aucun voyant")
  );
  assert.equal(second?.readyToCreate, true);
  assert.equal(second?.action, "offer_case");
});

test("keeps the light question after the laptop quick-start message", () => {
  const result = evaluateLaptopIntake(
    conversation(
      "J'ai un problème avec l'ordinateur portable prêté par le lycée.",
      "Il ne démarre plus."
    )
  );
  assert.equal(result?.readyToCreate, false);
  assert.match(result?.reply ?? "", /voyant/i);
});

test("locates a network incident before creating the request", () => {
  const result = evaluateLaptopIntake(conversation("Le wifi ne marche pas sur mon ordinateur"));
  assert.equal(result?.intent, "reseau");
  assert.equal(result?.readyToCreate, false);
  assert.match(result?.reply ?? "", /lycée ou à la maison/i);
});
