import assert from "node:assert/strict";
import test from "node:test";
import { assertMappingComplete, buildNominativeImportReport, parseDelimitedFile } from "../shared/nominative-import.ts";
import { FICTITIOUS_CANTINE_DIRECTORY as directory } from "../shared/nominative-fictitious-fixture.ts";

const mapping = { beneficiary_ref: 0, last_name: 1, first_name: 2, class_label: 3, value: 4 };
const report = (rows, people = directory) => buildNominativeImportReport({ rows, mapping, directory: people });

test("une référence inconnue ne récupère pas la valeur par simple nom", () => {
  const result = report([["eleve:inconnu99", "Martin", "Alice", "2nde 4", "0999"]]);
  assert.equal(result.rows[0].outcome, "match_missing");
  assert.equal(result.rows[0].value, null);
});

test("une référence ambiguë du répertoire ne choisit pas sa dernière occurrence", () => {
  const result = report([["eleve:fictif01", "Martin", "Alice", "2nde 4", "0042"]], [directory[0], { ...directory[0], contactRef: "contact:autre0001" }]);
  assert.equal(result.rows[0].outcome, "match_ambiguous");
  assert.equal(result.readyCount, 0);
});

test("une référence et un nom contradictoires nécessitent une revue", () => {
  const result = report([["eleve:fictif01", "Martin", "Bruno", "2nde 4", "0043"]]);
  assert.equal(result.rows[0].outcome, "match_ambiguous");
  assert.equal(result.rows[0].value, null);
  assert.equal(result.readyCount, 0);
});

test("une colonne facultative peut être retirée sans invalider le mapping", () => {
  assert.doesNotThrow(() => assertMappingComplete({ ...mapping, class_label: undefined }, 5));
  assert.throws(() => assertMappingComplete({ ...mapping, unsuspected: 2 }, 5), (error) => error.reason === "mapping_invalid");
});

test("deux valeurs contradictoires excluent toutes les occurrences, quel que soit l'ordre", () => {
  const rows = [
    ["eleve:fictif01", "Martin", "Alice", "2nde 4", "0042"],
    ["eleve:fictif01", "Martin", "Alice", "2nde 4", "0099"],
  ];
  for (const input of [rows, [...rows].reverse()]) {
    const result = report(input);
    assert.equal(result.readyCount, 0);
    assert.equal(result.byOutcome.source_duplicate, 2);
    assert.ok(result.rows.every((row) => row.value === null && row.contactRef === null));
  }
});

test("un décalage de colonnes est refusé avant le rapprochement", () => {
  assert.throws(() => parseDelimitedFile("Nom;Prenom;Badge\nMartin;Alice;0042;0999\n"), (error) => error.reason === "row_width_invalid");
});

test("la limite de fichier porte sur les octets UTF-8", () => {
  assert.throws(() => parseDelimitedFile("Nom\n" + "é".repeat(2 * 1024 * 1024)), (error) => error.reason === "file_too_large");
});
