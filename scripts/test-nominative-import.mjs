import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertMappingComplete,
  buildNominativeImportReport,
  NominativeImportError,
  parseDelimitedFile,
  suggestColumnMapping,
} from "../shared/nominative-import.ts";
import { parseNominativeValueRecord } from "../shared/nominative-value-policy.ts";
import { freezeNominativeBatch, prepareNominativeDeliveryRows } from "../shared/nominative-batch.ts";

const sha256 = () => createHash("sha256");
const hmac = (secret) => createHmac("sha256", secret);
const SECRET = "x".repeat(48);
const INSTITUTION = "11111111-1111-4111-8111-111111111111";
const SOURCE = "import:cantine:fictif01";
const YEAR = "2026-2027";

const csv = await readFile(
  new URL("./fixtures/cantine-fictif/cantine-2026-2027-fictif.csv", import.meta.url),
  "utf8"
);
const directory = JSON.parse(
  await readFile(new URL("./fixtures/cantine-fictif/repertoire-fictif.json", import.meta.url), "utf8")
).beneficiaries;

function report() {
  const parsed = parseDelimitedFile(csv);
  const mapping = suggestColumnMapping(parsed.headers);
  assertMappingComplete(mapping, parsed.headers.length);
  return { parsed, mapping, result: buildNominativeImportReport({ rows: parsed.rows, mapping, directory }) };
}

test("les colonnes certaines sont préremplies, les autres restent à confirmer", () => {
  const parsed = parseDelimitedFile(csv);
  const mapping = suggestColumnMapping(parsed.headers);
  assert.deepEqual(mapping, {
    beneficiary_ref: 0,
    last_name: 1,
    first_name: 2,
    class_label: 3,
    value: 4,
  });
});

test("une colonne de valeur absente bloque l'import", () => {
  const mapping = { last_name: 0, first_name: 1 };
  assert.throws(
    () => assertMappingComplete(mapping, 3),
    (error) => error instanceof NominativeImportError && error.reason === "value_column_missing"
  );
});

test("le bilan distingue chaque situation du fichier fictif", () => {
  const { result } = report();
  assert.equal(result.totalRows, 9);
  assert.deepEqual(result.byOutcome, {
    ready: 2,
    value_missing: 1,
    match_missing: 1,
    match_ambiguous: 2,
    source_duplicate: 1,
    contact_missing: 1,
    contact_revoked: 1,
  });
});

test("deux homonymes de la même classe ne sont pas départagés par le système", () => {
  const { result } = report();
  const ambiguous = result.rows.filter((row) => row.outcome === "match_ambiguous");
  assert.equal(ambiguous.length, 2);
  for (const row of ambiguous) {
    assert.equal(row.beneficiaryRef, null);
    assert.equal(row.value, null);
    assert.deepEqual(row.candidateRefs, ["eleve:fictif03", "eleve:fictif04"]);
  }
});

test("une ligne non prête ne transporte jamais de valeur", () => {
  const { result } = report();
  for (const row of result.rows) {
    if (row.outcome !== "ready") {
      assert.equal(row.value, null, "ligne " + row.rowNumber);
      assert.equal(row.contactRef, null, "ligne " + row.rowNumber);
    }
  }
});

test("le zéro initial traverse tout l'import", () => {
  const { result } = report();
  const ready = result.rows.filter((row) => row.outcome === "ready");
  assert.deepEqual(ready.map((row) => row.value), ["0042", "0043"]);
});

test("un import rejoué à l'identique donne exactement le même bilan", () => {
  assert.deepEqual(report().result, report().result);
});

test("le parent des deux enfants reçoit deux livraisons distinctes", () => {
  const { result } = report();
  const ready = result.rows.filter((row) => row.outcome === "ready");
  assert.equal(new Set(ready.map((row) => row.contactRef)).size, 1);

  const batch = freezeNominativeBatch(
    {
      institutionId: INSTITUTION,
      sourceRef: SOURCE,
      schoolYear: YEAR,
      templateRef: "modele:cantine:v1",
      templateHash: "a".repeat(64),
      lines: ready.map((row) => ({
        beneficiaryRef: row.beneficiaryRef,
        contactRef: row.contactRef,
        valueVersion: parseNominativeValueRecord(
          {
            beneficiaryRef: row.beneficiaryRef,
            valueFunction: "cantine_information",
            value: row.value,
            schoolYear: YEAR,
            sourceRef: SOURCE,
          },
          sha256
        ).valueVersion,
      })),
      // Une ligne en double ne rend pas son bénéficiaire exclu : il est déjà prêt
      // par sa première ligne. L'exclusion porte sur des bénéficiaires, pas sur
      // des lignes de fichier.
      exclusions: result.rows
        .filter((row) => row.outcome !== "ready" && row.beneficiaryRef && row.outcome !== "source_duplicate")
        .map((row) => ({
          beneficiaryRef: row.beneficiaryRef,
          reason:
            row.outcome === "contact_missing"
              ? "contact_absent"
              : row.outcome === "contact_revoked"
                ? "contact_revoque"
                : row.outcome === "value_missing"
                  ? "valeur_manquante"
                  : "hors_perimetre",
        })),
    },
    sha256
  );
  assert.equal(batch.readyCount, 2);

  const rows = prepareNominativeDeliveryRows({
    batch,
    communicationId: "22222222-2222-4222-8222-222222222222",
    versionId: "33333333-3333-4333-8333-333333333333",
    version: 1,
    secret: SECRET,
    hmacFactory: hmac,
  });
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].idempotencyKeyHash, rows[1].idempotencyKeyHash);
});

test("un fichier sans ligne de données est refusé", () => {
  assert.throws(
    () => parseDelimitedFile("Nom;Prenom;Badge\n"),
    (error) => error.reason === "file_empty"
  );
});

test("les guillemets et le séparateur virgule sont lus correctement", () => {
  const parsed = parseDelimitedFile('Nom,Prenom,Badge\n"Martin, Jr",Alice,0042\n');
  assert.deepEqual(parsed.headers, ["Nom", "Prenom", "Badge"]);
  assert.deepEqual(parsed.rows, [["Martin, Jr", "Alice", "0042"]]);
});

test("un en-tête dupliqué est refusé plutôt que silencieusement écrasé", () => {
  assert.throws(
    () => parseDelimitedFile("Badge;badge\n0042;0043\n"),
    (error) => error.reason === "headers_duplicated"
  );
});

test("la copie du jeu d'essai ne diverge pas du fichier d'exemple", async () => {
  const { FICTITIOUS_CANTINE_CSV, FICTITIOUS_CANTINE_DIRECTORY } = await import(
    "../shared/nominative-fictitious-fixture.ts"
  );
  assert.equal(FICTITIOUS_CANTINE_CSV.replace(/\r\n?/g, "\n"), csv.replace(/\r\n?/g, "\n"));
  assert.deepEqual(FICTITIOUS_CANTINE_DIRECTORY, directory);
});
