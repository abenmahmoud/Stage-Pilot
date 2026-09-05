import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidFlashInfoVersionPayload,
  isValidFlashValidationAccessPayload,
  isValidFlashAudienceTreatmentPayload,
  isValidFlashExpirationCheckPayload,
  isValidFlashAudiencePayload,
  isValidFlashAuthorNamePayload,
  isValidFlashPublicItemPayload,
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
    publishedBy: null,
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

test("accepte une version publiée avec publishedBy renseigné, distinct de validatedBy", () => {
  assert.equal(
    isValidFlashInfoVersionPayload(
      validVersionPayload({
        status: "publiee",
        validatedBy: UUID_A,
        validatedAt: "2026-09-05T09:00:00.000Z",
        publishedAt: "2026-09-05T09:05:00.000Z",
        publishedBy: UUID_B,
      })
    ),
    true
  );
});

test("refuse un publishedBy qui n'est pas un identifiant", () => {
  assert.equal(isValidFlashInfoVersionPayload(validVersionPayload({ publishedBy: "pas-un-uuid" })), false);
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

test("accepte une audience triée sans doublon, y compris vide", () => {
  assert.equal(isValidFlashAudiencePayload([]), true);
  assert.equal(isValidFlashAudiencePayload(["classe:2ndea", "niveau:terminale"]), true);
});

test("refuse une audience avec un doublon ou un élément vide", () => {
  assert.equal(isValidFlashAudiencePayload(["classe:2ndea", "classe:2ndea"]), false);
  assert.equal(isValidFlashAudiencePayload(["classe:2ndea", ""]), false);
  assert.equal(isValidFlashAudiencePayload("classe:2ndea"), false);
});

test("accepte un nom d'auteur résolu ou l'absence explicite (null)", () => {
  assert.equal(isValidFlashAuthorNamePayload("Claire Martin"), true);
  assert.equal(isValidFlashAuthorNamePayload(null), true);
});

test("refuse une chaîne vide à la place de null pour un nom d'auteur non résolu", () => {
  assert.equal(isValidFlashAuthorNamePayload(""), false);
  assert.equal(isValidFlashAuthorNamePayload(undefined), false);
  assert.equal(isValidFlashAuthorNamePayload(42), false);
});

function validPublicItemPayload(overrides = {}) {
  return {
    id: UUID_A,
    title: "Portes ouvertes reportées",
    bodyMarkdown: "Les portes ouvertes sont reportées au 20 septembre.",
    importance: "importante",
    publishedAt: "2026-09-05T08:00:00.000Z",
    expiresAt: "2026-09-06T08:00:00.000Z",
    ...overrides,
  };
}

test("accepte une information publique conforme au contrat étroit", () => {
  assert.equal(isValidFlashPublicItemPayload(validPublicItemPayload()), true);
});

test("refuse un identifiant de proposition (flashInfoId) glissé dans la charge publique", () => {
  assert.equal(
    isValidFlashPublicItemPayload({ ...validPublicItemPayload(), flashInfoId: UUID_B }),
    false
  );
});

test("refuse un champ d'auteur, de valideur ou d'audience brute dans la charge publique", () => {
  assert.equal(
    isValidFlashPublicItemPayload({ ...validPublicItemPayload(), proposedBy: UUID_B }),
    false
  );
  assert.equal(
    isValidFlashPublicItemPayload({ ...validPublicItemPayload(), validatedBy: UUID_B }),
    false
  );
  assert.equal(
    isValidFlashPublicItemPayload({ ...validPublicItemPayload(), audience: ["classe:2ndea"] }),
    false
  );
});

test("refuse une importance hors liste connue", () => {
  assert.equal(isValidFlashPublicItemPayload(validPublicItemPayload({ importance: "critique" })), false);
});

test("refuse une date de publication ou d'expiration invalide", () => {
  assert.equal(isValidFlashPublicItemPayload(validPublicItemPayload({ publishedAt: "" })), false);
  assert.equal(isValidFlashPublicItemPayload(validPublicItemPayload({ expiresAt: "pas-une-date" })), false);
});
