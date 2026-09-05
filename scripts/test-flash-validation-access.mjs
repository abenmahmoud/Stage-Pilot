import assert from "node:assert/strict";
import test from "node:test";

import {
  decideFlashValidationAccess,
  FlashValidationAccessError,
  FLASH_SELF_VALIDATION_ALLOWED_BY_DEFAULT,
  FLASH_VALIDATION_SERVICES,
} from "../shared/flash-validation-access.ts";

const ADEL = "11111111-1111-4111-8111-111111111111";
const AUTRE = "22222222-2222-4222-8222-222222222222";

test("la validation est ouverte par le service, jamais par le rôle", () => {
  assert.deepEqual([...FLASH_VALIDATION_SERVICES], ["referent_numerique", "ddfpt"]);

  const referent = decideFlashValidationAccess({
    role: "professeur",
    serviceCodes: ["referent_numerique"],
    proposedBy: AUTRE,
    actorId: ADEL,
  });
  assert.equal(referent.allowed, true);
  assert.equal(referent.grantedByService, "referent_numerique");

  const ddfpt = decideFlashValidationAccess({
    role: "administration",
    serviceCodes: ["ddfpt"],
    proposedBy: AUTRE,
    actorId: ADEL,
  });
  assert.equal(ddfpt.allowed, true);
  assert.equal(ddfpt.grantedByService, "ddfpt");
});

test("un compte administration sans le service ne valide pas", () => {
  // C'est le défaut corrigé : l'écran de la nuit laissait valider toute
  // l'administration, alors que §13 nomme le référent numérique et la DDFPT.
  const decision = decideFlashValidationAccess({
    role: "administration",
    serviceCodes: ["secretariat", "intendance"],
    proposedBy: AUTRE,
    actorId: ADEL,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "service_not_granted");
  assert.equal(decision.grantedByService, null);
});

test("un proviseur sans le service ne valide pas non plus", () => {
  const decision = decideFlashValidationAccess({
    role: "proviseur",
    serviceCodes: [],
    proposedBy: AUTRE,
    actorId: ADEL,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "service_not_granted");
});

test("le superadmin reste autorisé et sa source est tracée comme telle", () => {
  const decision = decideFlashValidationAccess({
    role: "superadmin",
    serviceCodes: [],
    proposedBy: AUTRE,
    actorId: ADEL,
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.grantedByService, "superadmin");
});

test("l'auto-validation est autorisée aujourd'hui, mais jamais silencieuse", () => {
  assert.equal(FLASH_SELF_VALIDATION_ALLOWED_BY_DEFAULT, true);
  const decision = decideFlashValidationAccess({
    role: "professeur",
    serviceCodes: ["referent_numerique"],
    proposedBy: ADEL,
    actorId: ADEL,
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.selfValidated, true, "le journal doit pouvoir le montrer");
});

test("le jour où un second référent existe, un seul drapeau resserre la règle", () => {
  const decision = decideFlashValidationAccess({
    role: "professeur",
    serviceCodes: ["referent_numerique"],
    proposedBy: ADEL,
    actorId: ADEL,
    selfValidationAllowed: false,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "self_validation_forbidden");
  assert.equal(decision.selfValidated, true);
});

test("resserrer la règle ne gêne pas la validation d'une proposition d'autrui", () => {
  const decision = decideFlashValidationAccess({
    role: "professeur",
    serviceCodes: ["referent_numerique"],
    proposedBy: AUTRE,
    actorId: ADEL,
    selfValidationAllowed: false,
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.selfValidated, false);
});

test("un service inconnu ou mal formé ne se faufile pas", () => {
  const decision = decideFlashValidationAccess({
    role: "professeur",
    serviceCodes: ["referent-numerique", "REFERENT_NUMERIQUE", "", null, 42],
    proposedBy: AUTRE,
    actorId: ADEL,
  });
  assert.equal(decision.allowed, false, "aucune de ces valeurs n'est le service attendu");

  assert.throws(
    () => decideFlashValidationAccess({ role: "professeur", serviceCodes: "referent_numerique", proposedBy: AUTRE, actorId: ADEL }),
    (error) => error instanceof FlashValidationAccessError && error.reason === "service_codes_invalid"
  );
  assert.throws(
    () => decideFlashValidationAccess({ role: "professeur", serviceCodes: [], proposedBy: "moi", actorId: ADEL }),
    (error) => error.reason === "proposed_by_invalid"
  );
});
