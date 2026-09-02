import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSupportPersonName } from "../shared/support-contact-input.ts";

process.env.DATABASE_URL ??= "postgres://fixture:fixture@127.0.0.1:1/fixture";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://fixture.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "fixture-service-role-key";
const { parseSupportRequest } = await import("../api/_shared/support.ts");

const baseRequest = {
  requesterType: "parent",
  requesterFirstName: "Nadia",
  requesterLastName: "Ben Salem",
  beneficiaryType: "eleve",
  beneficiaryFirstName: "Yanis",
  beneficiaryLastName: "Ben Salem",
  category: "affectation_classe",
  subject: "Classe ou emploi du temps",
  description: "Je souhaite connaître l’emploi du temps de mon enfant.",
  preferredChannel: "email",
  email: "parent.fixture@example.invalid",
  conversation: [{ role: "requester", content: "Je souhaite connaître l’emploi du temps de mon enfant." }],
};

test("accepts legitimate French and international person names", () => {
  for (const name of ["Anne-Marie", "D’Angelo", "Élodie", "João", "عبد الله", "Ng"]) {
    assert.equal(normalizeSupportPersonName(name), name);
  }
  assert.equal(normalizeSupportPersonName("  Ben   Salem  "), "Ben Salem");
});

test("rejects punctuation, digits and meaningless identity fields", () => {
  for (const name of ["k:vkbjn", "kjb;jhb:k", "12345", "A", "---", "Nom_Utilisateur", "Jean!"]) {
    assert.equal(normalizeSupportPersonName(name), null, name);
  }
});

test("rejects the exact invalid requester identity at the API boundary", () => {
  assert.throws(
    () => parseSupportRequest({
      ...baseRequest,
      requesterFirstName: "k:vkbjn",
      requesterLastName: "kjb;jhb:k",
    }),
    /Prénom semble invalide/
  );
});

test("validates the beneficiary identity at the same API boundary", () => {
  assert.throws(
    () => parseSupportRequest({ ...baseRequest, beneficiaryFirstName: "0000" }),
    /Prénom du bénéficiaire semble invalide/
  );
  const parsed = parseSupportRequest(baseRequest);
  assert.equal(parsed.requesterFirstName, "Nadia");
  assert.equal(parsed.beneficiaryFirstName, "Yanis");
});

