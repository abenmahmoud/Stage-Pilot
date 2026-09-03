import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";

import {
  assertDiffusableNominativeValue,
  classifyNominativeValueFunction,
  NominativeValueError,
  parseNominativeValueRecord,
  parseNominativeValueText,
  parseSchoolYear,
} from "../shared/nominative-value-policy.ts";
import {
  mergeNominativeMessage,
  NominativeMergeError,
  parseNominativeBeneficiaryContext,
  parseNominativeTemplate,
} from "../shared/nominative-merge.ts";
import {
  compareNominativeBatch,
  freezeNominativeBatch,
  NominativeBatchError,
  prepareNominativeDeliveryRows,
} from "../shared/nominative-batch.ts";

const sha256 = () => createHash("sha256");
const hmac = (secret) => createHmac("sha256", secret);
const SECRET = "x".repeat(48);
const INSTITUTION = "11111111-1111-4111-8111-111111111111";
const COMMUNICATION = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";
const SOURCE = "import:cantine:2026-fictif";
const YEAR = "2026-2027";

function record(beneficiaryRef, value) {
  return parseNominativeValueRecord(
    {
      beneficiaryRef,
      valueFunction: "cantine_information",
      value,
      schoolYear: YEAR,
      sourceRef: SOURCE,
    },
    sha256
  );
}

function beneficiary(beneficiaryRef, firstName) {
  return parseNominativeBeneficiaryContext({
    beneficiaryRef,
    firstName,
    lastName: "Exemple",
    classLabel: "2nde 4",
  });
}

const TEMPLATE = parseNominativeTemplate({
  templateRef: "modele:cantine:v1",
  subject: "Cantine — {{beneficiaire_prenom}} {{beneficiaire_nom}}",
  preheader: "Information de cantine pour {{annee_scolaire}}",
  bodyText: "Bonjour,\n\nInformation de cantine de {{beneficiaire_prenom}} ({{beneficiaire_classe}}) : {{valeur}}\n\nLe lycée.",
});

test("la classification suit la fonction déclarée, pas le titre de colonne", () => {
  assert.equal(classifyNominativeValueFunction("cantine_information"), "private_value");
  assert.equal(classifyNominativeValueFunction("badge_number"), "private_value");
  assert.equal(classifyNominativeValueFunction("access_secret"), "access_secret");
  assert.equal(classifyNominativeValueFunction("activation_secret"), "access_secret");
  assert.throws(() => classifyNominativeValueFunction("code"), NominativeValueError);
});

test("le circuit de diffusion refuse une valeur qui ouvre un accès", () => {
  assert.throws(
    () => assertDiffusableNominativeValue("activation_secret"),
    (error) => error instanceof NominativeValueError && error.reason === "secret_not_diffusable"
  );
  assert.throws(
    () =>
      parseNominativeValueRecord(
        { beneficiaryRef: "eleve:0001abcd", valueFunction: "access_secret", value: "AB12", schoolYear: YEAR, sourceRef: SOURCE },
        sha256
      ),
    (error) => error.reason === "secret_not_diffusable"
  );
});

test("les zéros initiaux appartiennent à la valeur", () => {
  assert.equal(parseNominativeValueText("0042"), "0042");
  assert.equal(parseNominativeValueText("  0042  "), "0042");
  const zero = record("eleve:0001abcd", "0042");
  const sans = record("eleve:0001abcd", "42");
  assert.notEqual(zero.valueVersion, sans.valueVersion);
  const merged = mergeNominativeMessage({
    template: TEMPLATE,
    beneficiary: beneficiary("eleve:0001abcd", "Alice"),
    record: zero,
  });
  assert.match(merged.bodyText, /: 0042$|: 0042\n/m);
  assert.ok(!merged.bodyText.includes(": 42\n"));
});

test("l'année scolaire doit être consécutive", () => {
  assert.equal(parseSchoolYear("2026-2027"), "2026-2027");
  assert.throws(() => parseSchoolYear("2026-2028"), NominativeValueError);
  assert.throws(() => parseSchoolYear("2026"), NominativeValueError);
});

test("un modèle sans la valeur personnelle n'est pas nominatif", () => {
  assert.throws(
    () =>
      parseNominativeTemplate({
        templateRef: "modele:cantine:v1",
        subject: "Cantine",
        preheader: "Information",
        bodyText: "Bonjour {{beneficiaire_prenom}}.",
      }),
    (error) => error instanceof NominativeMergeError && error.reason === "variable_required_missing"
  );
});

test("une variable inconnue est refusée avant toute mise en file", () => {
  assert.throws(
    () =>
      parseNominativeTemplate({
        templateRef: "modele:cantine:v1",
        subject: "Cantine",
        preheader: "Information",
        bodyText: "Valeur {{valeur}} et {{code_ent}}.",
      }),
    (error) => error.reason === "variable_unknown"
  );
});

test("aucun message ne part avec un marqueur non remplacé", () => {
  const merged = mergeNominativeMessage({
    template: TEMPLATE,
    beneficiary: beneficiary("eleve:0001abcd", "Alice"),
    record: record("eleve:0001abcd", "0042"),
  });
  assert.ok(!merged.bodyText.includes("{{"));
  assert.ok(!merged.subject.includes("{{"));
  assert.ok(!merged.preheader.includes("{{"));
});

test("la valeur d'un bénéficiaire ne peut pas être fusionnée pour un autre", () => {
  assert.throws(
    () =>
      mergeNominativeMessage({
        template: TEMPLATE,
        beneficiary: beneficiary("eleve:0002abcd", "Bob"),
        record: record("eleve:0001abcd", "0042"),
      }),
    (error) => error instanceof NominativeMergeError && error.reason === "value_beneficiary_mismatch"
  );
});

test("deux enfants qui partagent l'adresse du parent gardent deux livraisons distinctes", () => {
  const batch = freezeNominativeBatch(
    {
      institutionId: INSTITUTION,
      sourceRef: SOURCE,
      schoolYear: YEAR,
      templateRef: "modele:cantine:v1",
      templateHash: "a".repeat(64),
      lines: [
        { beneficiaryRef: "eleve:0001abcd", contactRef: "contact:parent0001", valueVersion: record("eleve:0001abcd", "0042").valueVersion },
        { beneficiaryRef: "eleve:0002abcd", contactRef: "contact:parent0001", valueVersion: record("eleve:0002abcd", "0043").valueVersion },
      ],
      exclusions: [],
    },
    sha256
  );
  assert.equal(batch.readyCount, 2);

  const rows = prepareNominativeDeliveryRows({
    batch,
    communicationId: COMMUNICATION,
    versionId: VERSION_ID,
    version: 1,
    secret: SECRET,
    hmacFactory: hmac,
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].contactRef, rows[1].contactRef);
  assert.notEqual(rows[0].idempotencyKeyHash, rows[1].idempotencyKeyHash);
  assert.notEqual(rows[0].beneficiaryRef, rows[1].beneficiaryRef);
});

test("un import rejoué à l'identique produit exactement les mêmes clés", () => {
  const build = () =>
    prepareNominativeDeliveryRows({
      batch: freezeNominativeBatch(
        {
          institutionId: INSTITUTION,
          sourceRef: SOURCE,
          schoolYear: YEAR,
          templateRef: "modele:cantine:v1",
          templateHash: "a".repeat(64),
          lines: [
            { beneficiaryRef: "eleve:0001abcd", contactRef: "contact:parent0001", valueVersion: record("eleve:0001abcd", "0042").valueVersion },
          ],
          exclusions: [],
        },
        sha256
      ),
      communicationId: COMMUNICATION,
      versionId: VERSION_ID,
      version: 1,
      secret: SECRET,
      hmacFactory: hmac,
    });
  assert.deepEqual(build(), build());
});

test("l'empreinte du lot ne dépend pas de l'ordre d'arrivée des lignes", () => {
  const lines = [
    { beneficiaryRef: "eleve:0002abcd", contactRef: "contact:parent0001", valueVersion: record("eleve:0002abcd", "0043").valueVersion },
    { beneficiaryRef: "eleve:0001abcd", contactRef: "contact:parent0001", valueVersion: record("eleve:0001abcd", "0042").valueVersion },
  ];
  const base = { institutionId: INSTITUTION, sourceRef: SOURCE, schoolYear: YEAR, templateRef: "modele:cantine:v1", templateHash: "a".repeat(64), exclusions: [] };
  const left = freezeNominativeBatch({ ...base, lines }, sha256);
  const right = freezeNominativeBatch({ ...base, lines: [...lines].reverse() }, sha256);
  assert.equal(left.scopeHash, right.scopeHash);
});

test("un bénéficiaire ne peut pas être à la fois prêt et exclu", () => {
  assert.throws(
    () =>
      freezeNominativeBatch(
        {
          institutionId: INSTITUTION,
          sourceRef: SOURCE,
          schoolYear: YEAR,
          templateRef: "modele:cantine:v1",
          templateHash: "a".repeat(64),
          lines: [{ beneficiaryRef: "eleve:0001abcd", contactRef: "contact:parent0001", valueVersion: "b".repeat(64) }],
          exclusions: [{ beneficiaryRef: "eleve:0001abcd", reason: "contact_absent" }],
        },
        sha256
      ),
    (error) => error instanceof NominativeBatchError && error.reason === "beneficiary_ready_and_excluded"
  );
});

test("un contact révoqué après validation rend le lot inapplicable", () => {
  const base = {
    institutionId: INSTITUTION,
    sourceRef: SOURCE,
    schoolYear: YEAR,
    templateRef: "modele:cantine:v1",
    templateHash: "a".repeat(64),
    exclusions: [],
  };
  const approved = freezeNominativeBatch(
    { ...base, lines: [{ beneficiaryRef: "eleve:0001abcd", contactRef: "contact:parent0001", valueVersion: "b".repeat(64) }] },
    sha256
  );
  const current = freezeNominativeBatch(
    { ...base, lines: [{ beneficiaryRef: "eleve:0001abcd", contactRef: "contact:parent0009", valueVersion: "b".repeat(64) }] },
    sha256
  );
  const drift = compareNominativeBatch(approved, current);
  assert.equal(drift.applicable, false);
  assert.deepEqual(drift.changedBeneficiaries, ["eleve:0001abcd"]);
});

test("un changement de modèle rend le lot inapplicable", () => {
  const base = {
    institutionId: INSTITUTION,
    sourceRef: SOURCE,
    schoolYear: YEAR,
    templateRef: "modele:cantine:v1",
    lines: [{ beneficiaryRef: "eleve:0001abcd", contactRef: "contact:parent0001", valueVersion: "b".repeat(64) }],
    exclusions: [],
  };
  const approved = freezeNominativeBatch({ ...base, templateHash: "a".repeat(64) }, sha256);
  const current = freezeNominativeBatch({ ...base, templateHash: "c".repeat(64) }, sha256);
  const drift = compareNominativeBatch(approved, current);
  assert.equal(drift.applicable, false);
  assert.equal(drift.templateChanged, true);
});

test("un lot inchangé reste applicable", () => {
  const input = {
    institutionId: INSTITUTION,
    sourceRef: SOURCE,
    schoolYear: YEAR,
    templateRef: "modele:cantine:v1",
    templateHash: "a".repeat(64),
    lines: [{ beneficiaryRef: "eleve:0001abcd", contactRef: "contact:parent0001", valueVersion: "b".repeat(64) }],
    exclusions: [{ beneficiaryRef: "eleve:0003abcd", reason: "contact_absent" }],
  };
  const drift = compareNominativeBatch(freezeNominativeBatch(input, sha256), freezeNominativeBatch(input, sha256));
  assert.equal(drift.applicable, true);
});

test("les exclusions restent visibles et motivées", () => {
  const batch = freezeNominativeBatch(
    {
      institutionId: INSTITUTION,
      sourceRef: SOURCE,
      schoolYear: YEAR,
      templateRef: "modele:cantine:v1",
      templateHash: "a".repeat(64),
      lines: [{ beneficiaryRef: "eleve:0001abcd", contactRef: "contact:parent0001", valueVersion: "b".repeat(64) }],
      exclusions: [
        { beneficiaryRef: "eleve:0005abcd", reason: "contact_absent" },
        { beneficiaryRef: "eleve:0004abcd", reason: "rapprochement_ambigu" },
      ],
    },
    sha256
  );
  assert.equal(batch.excludedCount, 2);
  assert.deepEqual(
    batch.exclusions.map((item) => item.beneficiaryRef),
    ["eleve:0004abcd", "eleve:0005abcd"]
  );
});

test("un homonyme reste deux bénéficiaires distincts", () => {
  const first = record("eleve:0006abcd", "0100");
  const second = record("eleve:0007abcd", "0101");
  assert.notEqual(first.valueVersion, second.valueVersion);
  const left = mergeNominativeMessage({ template: TEMPLATE, beneficiary: beneficiary("eleve:0006abcd", "Camille"), record: first });
  const right = mergeNominativeMessage({ template: TEMPLATE, beneficiary: beneficiary("eleve:0007abcd", "Camille"), record: second });
  assert.ok(left.bodyText.includes("0100"));
  assert.ok(!left.bodyText.includes("0101"));
  assert.ok(right.bodyText.includes("0101"));
  assert.ok(!right.bodyText.includes("0100"));
});

test("preuve du défaut évité : la clé de groupe existante confondrait les deux enfants", async () => {
  const { prepareCommunicationDeliveryRows } = await import(
    "../shared/communication-recipient-resolution.ts"
  );
  const groupRows = prepareCommunicationDeliveryRows(
    {
      v: 1,
      institutionId: INSTITUTION,
      resolutionId: "44444444-4444-4444-8444-444444444444",
      communicationId: COMMUNICATION,
      versionId: VERSION_ID,
      version: 1,
      snapshotHash: "d".repeat(64),
      generatedAt: "2026-09-03T00:00:00.000Z",
      expiresAt: "2026-09-03T00:05:00.000Z",
      pageIndex: 0,
      pageCount: 1,
      groupRefs: ["groupe:cantine"],
      // Le parent apparaît une fois par enfant : c'est la réalité du fichier.
      contacts: [
        { contactRef: "contact:parent0001", eligibility: "active_validated_email" },
        { contactRef: "contact:parent0001", eligibility: "active_validated_email" },
      ],
      resolutionHash: "e".repeat(64),
    },
    SECRET
  );
  // Deux lignes, une seule clé : l'insertion en base n'en garderait qu'une.
  assert.equal(groupRows.length, 2);
  assert.equal(groupRows[0].idempotencyKeyHash, groupRows[1].idempotencyKeyHash);
});
