import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidFlashInfoVersionPayload,
  isValidFlashValidationAccessPayload,
  isValidFlashAudienceTreatmentPayload,
  isValidFlashExpirationCheckPayload,
} from "../shared/flash-payload-policy.ts";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

function validVersionPayload(overrides = {}) {
  return {
    id: UUID_A,
    flashInfoId: UUID_B,
    version: 1,
    status: "proposee",
    title: "Sortie pédagogique reportée",
    bodyMarkdown: "La sortie du 12 est reportée au 19.",
    importance: "importante",
    channels: ["push", "email"],
    expiresAt: "2026-09-06T08:00:00.000Z",
    proposedBy: UUID_A,
    validatedBy: null,
    validatedAt: null,
    publishedAt: null,
    createdAt: "2026-09-05T08:00:00.000Z",
    updatedAt: "2026-09-05T08:00:00.000Z",
    ...overrides,
  };
}

test("accepte une version flash conforme au contrat", () => {
  assert.equal(isValidFlashInfoVersionPayload(validVersionPayload()), true);
});

test("refuse un champ inconnu même bien intentionné", () => {
  assert.equal(
    isValidFlashInfoVersionPayload({ ...validVersionPayload(), debugNote: "ok" }),
    false
  );
});

test("refuse un statut hors du graphe des transitions", () => {
  assert.equal(isValidFlashInfoVersionPayload(validVersionPayload({ status: "brouillon" })), false);
});

test("refuse un canal inconnu ou dupliqué", () => {
  assert.equal(isValidFlashInfoVersionPayload(validVersionPayload({ channels: ["fax"] })), false);
  assert.equal(
    isValidFlashInfoVersionPayload(validVersionPayload({ channels: ["push", "push"] })),
    false
  );
});

test("refuse une date de validation vide chaîne au lieu de null", () => {
  assert.equal(isValidFlashInfoVersionPayload(validVersionPayload({ validatedAt: "" })), false);
});

test("accepte une version déjà validée avec ses dates renseignées", () => {
  assert.equal(
    isValidFlashInfoVersionPayload(
      validVersionPayload({
        status: "validee",
        validatedBy: UUID_B,
        validatedAt: "2026-09-05T09:00:00.000Z",
      })
    ),
    true
  );
});

test("accepte une décision de validation autorisée sans motif résiduel", () => {
  assert.equal(
    isValidFlashValidationAccessPayload({
      allowed: true,
      selfValidated: false,
      grantedByService: "referent_numerique",
      reason: null,
    }),
    true
  );
});

test("accepte un refus avec un motif renseigné", () => {
  assert.equal(
    isValidFlashValidationAccessPayload({
      allowed: false,
      selfValidated: false,
      grantedByService: null,
      reason: "service_not_granted",
    }),
    true
  );
});

test("refuse une autorisation qui porte quand même un motif", () => {
  assert.equal(
    isValidFlashValidationAccessPayload({
      allowed: true,
      selfValidated: false,
      grantedByService: "ddfpt",
      reason: "service_not_granted",
    }),
    false
  );
});

test("refuse un refus sans motif", () => {
  assert.equal(
    isValidFlashValidationAccessPayload({
      allowed: false,
      selfValidated: false,
      grantedByService: null,
      reason: null,
    }),
    false
  );
});

test("refuse un booléen porté par null", () => {
  assert.equal(
    isValidFlashValidationAccessPayload({
      allowed: null,
      selfValidated: false,
      grantedByService: null,
      reason: "service_not_granted",
    }),
    false
  );
});

test("accepte un traitement d'audience sans rien à corriger", () => {
  assert.equal(
    isValidFlashAudienceTreatmentPayload({
      maintained: [],
      removed: [],
      added: [],
      eligibleChannels: [],
      correctionPossible: false,
    }),
    true
  );
});

test("accepte un traitement d'audience avec les trois ensembles peuplés", () => {
  assert.equal(
    isValidFlashAudienceTreatmentPayload({
      maintained: ["classe:1a"],
      removed: ["classe:1b"],
      added: ["classe:1c"],
      eligibleChannels: ["sms", "email"],
      correctionPossible: true,
    }),
    true
  );
});

test("refuse un correctionPossible non booléen", () => {
  assert.equal(
    isValidFlashAudienceTreatmentPayload({
      maintained: [],
      removed: [],
      added: [],
      eligibleChannels: [],
      correctionPossible: "true",
    }),
    false
  );
});

test("accepte un contrôle d'expiration cohérent", () => {
  assert.equal(
    isValidFlashExpirationCheckPayload({
      isExpiredWithoutValidation: true,
      reason: "expired_without_validation",
    }),
    true
  );
  assert.equal(
    isValidFlashExpirationCheckPayload({
      isExpiredWithoutValidation: false,
      reason: "still_pending",
    }),
    true
  );
});

test("refuse un motif d'expiration hors liste", () => {
  assert.equal(
    isValidFlashExpirationCheckPayload({
      isExpiredWithoutValidation: false,
      reason: "annulee",
    }),
    false
  );
});
