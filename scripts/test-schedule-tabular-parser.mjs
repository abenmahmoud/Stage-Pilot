// Recette statique du LOT 3 (`docs/operations/PLAN_IMPORT_UTILISABLE_2026-09-07.md`) :
// prouve que `workers/schedule-tabular-parser.mjs` lit réellement des octets
// CSV et Excel construits en mémoire (jamais de fichier réel), rend les
// en-têtes exactement tels quels (aucune devinette), et rejette les fichiers
// dangereux ou mal formés — même niveau de rigueur que
// `scripts/test-identity-directory-parser.mjs`.
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  ScheduleTabularParseError,
  parseScheduleTabularBytes,
} from "../workers/schedule-tabular-parser.mjs";

function expectCode(run, code) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof ScheduleTabularParseError, "expected ScheduleTabularParseError");
    assert.equal(error.code, code);
    return true;
  });
}

function csvBytes(text) {
  return Buffer.from(text, "utf8");
}

function xlsxBytes(rows) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Feuil1");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

// 1. CSV réel avec séparateur point-virgule (export français courant),
// en-têtes rendus exactement tels quels, sans normalisation forcée
// contrairement à l'annuaire d'identités.
{
  const csv = [
    "Classe;Prof;Matiere;Salle;Date;Debut;Fin",
    "2NDE-01;Mme Dupont;Mathematiques;B12;2026-09-07;08:00;09:00",
    "2NDE-01;M. Martin;Francais;A03;2026-09-07;09:00;10:00",
  ].join("\r\n");
  const result = parseScheduleTabularBytes({ bytes: csvBytes(csv), fileName: "edt.csv" });
  assert.deepEqual(result.headers, ["Classe", "Prof", "Matiere", "Salle", "Date", "Debut", "Fin"]);
  assert.equal(result.rowCount, 2);
}

// 2. CSV avec virgules (format standard) : colonnes bien séparées.
{
  const csv = [
    "Classe,Professeur,Matiere,Salle,Date,Debut,Fin",
    "2NDE-01,Mme Dupont,Mathematiques,B12,2026-09-07,08:00,09:00",
    "2NDE-01,M. Martin,Francais,A03,2026-09-07,09:00,10:00",
    "1ERE-03,M. Martin,Francais,A03,2026-09-08,10:00,11:00",
  ].join("\r\n");
  const result = parseScheduleTabularBytes({ bytes: csvBytes(csv), fileName: "edt.csv" });
  assert.deepEqual(result.headers, ["Classe", "Professeur", "Matiere", "Salle", "Date", "Debut", "Fin"]);
  assert.equal(result.rowCount, 3);
  assert.deepEqual(result.rows[0], ["2NDE-01", "Mme Dupont", "Mathematiques", "B12", "2026-09-07", "08:00", "09:00"]);
  assert.equal(typeof result.checksum, "string");
  assert.equal(result.checksum.length, 64);
}

// 3. Excel réel (bytes construits par la même bibliothèque `xlsx`, jamais
// deviné) : mêmes garanties que le CSV.
{
  const rows = [
    ["Classe", "Professeur", "Matiere", "Salle", "Date", "Debut", "Fin"],
    ["2NDE-01", "Mme Dupont", "Mathematiques", "B12", "2026-09-07", "08:00", "09:00"],
  ];
  const result = parseScheduleTabularBytes({ bytes: xlsxBytes(rows), fileName: "edt.xlsx" });
  assert.deepEqual(result.headers, rows[0]);
  assert.equal(result.rowCount, 1);
}

// 4. Extension non supportée.
expectCode(
  () => parseScheduleTabularBytes({ bytes: csvBytes("a,b\n1,2"), fileName: "edt.txt" }),
  "unsupported_format"
);

// 5. Signature Excel invalide (extension .xlsx mais octets arbitraires).
expectCode(
  () => parseScheduleTabularBytes({ bytes: Buffer.from("not-a-zip"), fileName: "edt.xlsx" }),
  "invalid_signature"
);

// 6. Signature CSV invalide (octet NUL).
expectCode(
  () => parseScheduleTabularBytes({ bytes: Buffer.from([0x61, 0x00, 0x62]), fileName: "edt.csv" }),
  "invalid_signature"
);

// 7. Fichier vide.
expectCode(() => parseScheduleTabularBytes({ bytes: Buffer.alloc(0), fileName: "edt.csv" }), "invalid_size");

// 8. Fichier trop volumineux (déclaré au-delà de la borne).
expectCode(
  () => parseScheduleTabularBytes({ bytes: Buffer.alloc(21 * 1024 * 1024, 0x61), fileName: "edt.csv" }),
  "invalid_size"
);

// 9. Aucune ligne de données (uniquement l'en-tête).
expectCode(
  () => parseScheduleTabularBytes({ bytes: csvBytes("Classe,Professeur"), fileName: "edt.csv" }),
  "no_data_rows"
);

// 10. Colonnes dupliquées.
expectCode(
  () => parseScheduleTabularBytes({ bytes: csvBytes("Classe,Classe\n2NDE-01,2NDE-01"), fileName: "edt.csv" }),
  "duplicate_column"
);

// 11. En-tête vide.
expectCode(
  () => parseScheduleTabularBytes({ bytes: csvBytes("Classe,\n2NDE-01,x"), fileName: "edt.csv" }),
  "empty_header"
);

// 12. Trop de colonnes.
{
  const headers = Array.from({ length: 41 }, (_, index) => `col${index}`).join(",");
  const values = Array.from({ length: 41 }, (_, index) => `v${index}`).join(",");
  expectCode(
    () => parseScheduleTabularBytes({ bytes: csvBytes(`${headers}\n${values}`), fileName: "edt.csv" }),
    "too_many_columns"
  );
}

// 13. Formule interdite dans un fichier Excel.
{
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Classe", "Professeur"],
    ["2NDE-01", "Mme Dupont"],
  ]);
  sheet["B2"] = { t: "n", v: 1, f: "SUM(A1:A2)" };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Feuil1");
  const bytes = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  expectCode(() => parseScheduleTabularBytes({ bytes, fileName: "edt.xlsx" }), "formula_not_allowed");
}

// 14. Seule la première feuille est lue (comportement documenté, pas une
// fusion multi-feuilles comme l'annuaire d'identités).
{
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["Classe"], ["2NDE-01"]]),
    "Premiere"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["Autre"], ["ignore-moi"]]),
    "Seconde"
  );
  const bytes = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  const result = parseScheduleTabularBytes({ bytes, fileName: "edt.xlsx" });
  assert.deepEqual(result.headers, ["Classe"]);
  assert.equal(result.rowCount, 1);
}

console.log("schedule-tabular-parser: 14/14 tests passed");
