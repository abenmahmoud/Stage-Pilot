import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  authorizeNominativeSend,
  buildNominativePreview,
  buildNominativeSampleMessage,
  isNominativeRetryAllowed,
  nominativeDeliveryState,
  NominativeSendError,
} from "../shared/nominative-send-mode.ts";
import { parseNominativeBeneficiaryContext, parseNominativeTemplate } from "../shared/nominative-merge.ts";
import { parseNominativeValueRecord } from "../shared/nominative-value-policy.ts";
import { freezeNominativeBatch } from "../shared/nominative-batch.ts";

const sha256 = () => createHash("sha256");
const INSTITUTION = "11111111-1111-4111-8111-111111111111";
const SOURCE = "import:cantine:fictif01";
const YEAR = "2026-2027";

const TEMPLATE = parseNominativeTemplate({
  templateRef: "modele:cantine:v1",
  subject: "Cantine — {{beneficiaire_prenom}} {{beneficiaire_nom}}",
  preheader: "Information de cantine pour {{annee_scolaire}}",
  bodyText: "Bonjour,\n\nInformation de cantine de {{beneficiaire_prenom}} ({{beneficiaire_classe}}) : {{valeur}}\n\nLe lycée.",
});

const CLOSED = { moduleEnabled: false, sendingEnabled: false, sampleRecipientChosen: false };
const OPEN = { moduleEnabled: true, sendingEnabled: true, sampleRecipientChosen: true };

function record(ref, value) {
  return parseNominativeValueRecord(
    { beneficiaryRef: ref, valueFunction: "cantine_information", value, schoolYear: YEAR, sourceRef: SOURCE },
    sha256
  );
}

function context(ref, firstName) {
  return parseNominativeBeneficiaryContext({ beneficiaryRef: ref, firstName, lastName: "Martin", classLabel: "2nde 4" });
}

const ALICE = record("eleve:fictif01", "0042");
const BRUNO = record("eleve:fictif02", "0043");

const BATCH = freezeNominativeBatch(
  {
    institutionId: INSTITUTION,
    sourceRef: SOURCE,
    schoolYear: YEAR,
    templateRef: "modele:cantine:v1",
    templateHash: "a".repeat(64),
    lines: [
      { beneficiaryRef: "eleve:fictif01", contactRef: "contact:parent0001", valueVersion: ALICE.valueVersion },
      { beneficiaryRef: "eleve:fictif02", contactRef: "contact:parent0001", valueVersion: BRUNO.valueVersion },
    ],
    exclusions: [],
  },
  sha256
);

const BENEFICIARIES = new Map([
  ["eleve:fictif01", context("eleve:fictif01", "Alice")],
  ["eleve:fictif02", context("eleve:fictif02", "Bruno")],
]);
const RECORDS = new Map([
  ["eleve:fictif01", ALICE],
  ["eleve:fictif02", BRUNO],
]);

test("la simulation est toujours permise, drapeaux fermés compris", () => {
  const authorization = authorizeNominativeSend("simulation", CLOSED);
  assert.equal(authorization.providerCallAllowed, false);
  assert.equal(authorization.maxRealRecipients, 0);
});

test("l'envoi du lot est refusé tant que les drapeaux sont fermés", () => {
  assert.throws(
    () => authorizeNominativeSend("batch", CLOSED),
    (error) => error instanceof NominativeSendError && error.reason === "module_disabled"
  );
  assert.throws(
    () => authorizeNominativeSend("batch", { ...OPEN, sendingEnabled: false }),
    (error) => error.reason === "sending_disabled"
  );
});

test("l'exemplaire exige une adresse de test explicitement choisie", () => {
  assert.throws(
    () => authorizeNominativeSend("sample", { ...OPEN, sampleRecipientChosen: false }),
    (error) => error.reason === "sample_recipient_missing"
  );
  assert.equal(authorizeNominativeSend("sample", OPEN).maxRealRecipients, 1);
});

test("la simulation ne planifie aucun appel fournisseur", () => {
  const preview = buildNominativePreview({
    mode: "simulation",
    batch: BATCH,
    template: TEMPLATE,
    beneficiaries: BENEFICIARIES,
    records: RECORDS,
  });
  assert.equal(preview.providerCallsPlanned, 0);
  assert.equal(preview.items.length, 2);
});

test("chaque livraison porte son propre corps, même vers la même adresse", () => {
  const preview = buildNominativePreview({
    mode: "batch",
    batch: BATCH,
    template: TEMPLATE,
    beneficiaries: BENEFICIARIES,
    records: RECORDS,
  });
  assert.equal(preview.items.length, 2);
  assert.equal(preview.items[0].contactRef, preview.items[1].contactRef);
  assert.notEqual(preview.items[0].bodyText, preview.items[1].bodyText);
  assert.ok(preview.items[0].bodyText.includes("0042"));
  assert.ok(!preview.items[0].bodyText.includes("0043"));
  assert.ok(preview.items[1].bodyText.includes("0043"));
  assert.ok(!preview.items[1].bodyText.includes("0042"));
  assert.equal(preview.providerCallsPlanned, 2);
});

test("une valeur modifiée depuis la validation bloque la ligne au lieu de la remplacer", () => {
  const preview = buildNominativePreview({
    mode: "batch",
    batch: BATCH,
    template: TEMPLATE,
    beneficiaries: BENEFICIARIES,
    records: new Map([
      ["eleve:fictif01", record("eleve:fictif01", "0099")],
      ["eleve:fictif02", BRUNO],
    ]),
  });
  assert.equal(preview.items.length, 1);
  assert.deepEqual(preview.blocked, [
    { beneficiaryRef: "eleve:fictif01", reason: "value_version_changed" },
  ]);
  assert.ok(!JSON.stringify(preview.items).includes("0099"));
});

test("l'exemplaire n'emprunte rien au fichier réel", () => {
  const sample = buildNominativeSampleMessage({
    template: TEMPLATE,
    schoolYear: YEAR,
    sourceRef: SOURCE,
    hasherFactory: sha256,
  });
  assert.ok(sample.bodyText.includes("0000"));
  assert.ok(!sample.bodyText.includes("0042"));
  assert.ok(!sample.bodyText.includes("0043"));
  assert.equal(sample.beneficiaryRef, "eleve:exemple0000");
});

test("une réponse fournisseur incomplète ne devient jamais un succès", () => {
  assert.equal(
    nominativeDeliveryState({
      mode: "batch",
      handedToProvider: true,
      providerMessageRef: null,
      providerConfirmedDelivery: false,
      failureCode: null,
    }),
    "result_uncertain"
  );
  assert.equal(
    nominativeDeliveryState({
      mode: "batch",
      handedToProvider: true,
      providerMessageRef: null,
      providerConfirmedDelivery: true,
      failureCode: null,
    }),
    "result_uncertain"
  );
});

test("le suivi distingue les six états", () => {
  const base = { mode: "batch", handedToProvider: true, providerMessageRef: "brevo:1", providerConfirmedDelivery: false, failureCode: null };
  assert.equal(nominativeDeliveryState({ ...base, mode: "simulation" }), "simulated");
  assert.equal(nominativeDeliveryState({ ...base, handedToProvider: false }), "pending");
  assert.equal(nominativeDeliveryState(base), "handed_to_provider");
  assert.equal(nominativeDeliveryState({ ...base, providerConfirmedDelivery: true }), "delivered");
  assert.equal(nominativeDeliveryState({ ...base, failureCode: "bounce" }), "failed");
  assert.equal(nominativeDeliveryState({ ...base, providerMessageRef: null }), "result_uncertain");
});

test("on ne renvoie que sur un échec avéré, jamais sur un doute", () => {
  assert.equal(isNominativeRetryAllowed("failed"), true);
  assert.equal(isNominativeRetryAllowed("result_uncertain"), false);
  assert.equal(isNominativeRetryAllowed("handed_to_provider"), false);
  assert.equal(isNominativeRetryAllowed("delivered"), false);
});

test("un double clic ne double pas les livraisons planifiées", () => {
  const first = buildNominativePreview({ mode: "batch", batch: BATCH, template: TEMPLATE, beneficiaries: BENEFICIARIES, records: RECORDS });
  const second = buildNominativePreview({ mode: "batch", batch: BATCH, template: TEMPLATE, beneficiaries: BENEFICIARIES, records: RECORDS });
  assert.deepEqual(first, second);
  assert.equal(new Set([...first.items, ...second.items].map((item) => item.beneficiaryRef + item.valueVersion)).size, 2);
});
