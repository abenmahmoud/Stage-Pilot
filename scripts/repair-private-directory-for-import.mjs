import { readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import * as XLSX from "xlsx";
import { parseIdentityDirectoryBytes } from "../workers/identity-directory-parser.mjs";
import { verifyIdentityDirectoryReport } from "../workers/identity-directory-verification-report.mjs";

const inputPath = resolve(process.argv[2] ?? "");
if (!process.argv[2] || extname(inputPath).toLowerCase() !== ".csv") {
  throw new Error("Usage: node scripts/repair-private-directory-for-import.mjs <annuaire.csv> [dossier-sortie]");
}
const outputDirectory = resolve(process.argv[3] ?? dirname(inputPath));
const outputPath = join(outputDirectory, "annuaire_import_valide.csv");
const reportPath = join(outputDirectory, "rapport_verification_valide.txt");
const localPepper = "local-validation-only-not-a-production-key-2026";

function normalizedHeader(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function requiredColumn(headers, aliases, label) {
  const index = headers.findIndex((header) => aliases.includes(normalizedHeader(header)));
  if (index < 0) throw new Error(`Colonne ${label} introuvable`);
  return index;
}

const inputBytes = await readFile(inputPath);
const initial = parseIdentityDirectoryBytes({
  bytes: inputBytes,
  fileName: inputPath,
  contactPepper: localPepper,
});
const workbook = XLSX.read(inputBytes, { type: "buffer", raw: false, cellFormula: true });
if (workbook.SheetNames.length !== 1) throw new Error("Cette réparation attend un CSV à feuille unique");
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const matrix = XLSX.utils.sheet_to_json(sheet, {
  header: 1,
  defval: "",
  raw: false,
  blankrows: false,
});
if (matrix.length < 2) throw new Error("Le fichier ne contient aucune donnée");

const headers = matrix[0];
const phoneColumn = requiredColumn(headers, ["phone", "telephone"], "téléphone");
const academicEmailColumn = requiredColumn(
  headers,
  ["academic_email", "email_academique"],
  "email académique",
);
const rowsToRemove = new Set();
const seenDuplicateRelationships = new Set();
let clearedInvalidPhones = 0;
let clearedAmbiguousAcademicEmails = 0;
let removedDuplicateRelationships = 0;

for (const row of initial.rows) {
  const errorCodes = new Set(
    row.issues.filter((issue) => issue.severity === "error").map((issue) => issue.code),
  );
  const matrixRow = matrix[row.rowNumber - 1];
  if (!matrixRow) throw new Error("Numéro de ligne incohérent");
  if (errorCodes.has("invalid_phone")) {
    matrixRow[phoneColumn] = "";
    clearedInvalidPhones += 1;
  }
  if (errorCodes.has("duplicate_academic_email")) {
    matrixRow[academicEmailColumn] = "";
    clearedAmbiguousAcademicEmails += 1;
  }
  if (errorCodes.has("duplicate_relationship")) {
    const relationshipKey = [
      row.subjectPersonRef,
      row.relationshipType,
      row.objectRef,
      row.validFrom,
    ].join("|");
    if (seenDuplicateRelationships.has(relationshipKey)) {
      rowsToRemove.add(row.rowNumber - 1);
      removedDuplicateRelationships += 1;
    } else {
      seenDuplicateRelationships.add(relationshipKey);
    }
  }
}

const correctedMatrix = matrix.filter((_, index) => !rowsToRemove.has(index));
const correctedSheet = XLSX.utils.aoa_to_sheet(correctedMatrix);
const correctedCsv = XLSX.utils.sheet_to_csv(correctedSheet, { FS: ",", RS: "\n" });
const correctedBytes = Buffer.from(correctedCsv, "utf8");
const parsed = parseIdentityDirectoryBytes({
  bytes: correctedBytes,
  fileName: outputPath,
  contactPepper: localPepper,
});
if (!parsed.summary.readyForApproval || parsed.summary.rejectedRowCount !== 0) {
  throw new Error("La copie corrigée contient encore des lignes refusées");
}

const summary = parsed.summary;
const reportText = [
  "Rapport de vérification local du répertoire privé",
  "",
  `lignes_total: ${summary.rowCount}`,
  `personnes: ${summary.personCount}`,
  `relations: ${summary.relationshipCount}`,
  `references_orphelines: ${summary.orphanReferenceCount}`,
  `doublons_reference_personne: ${summary.duplicatePersonReferenceCount}`,
  `classes_distinctes: ${summary.classRefCount}`,
  `colonnes_interdites: ${summary.forbiddenColumnCount}`,
  `codes_detectes: ${summary.detectedCodeCount}`,
  "",
  `Liste des classes: ${summary.classRefs.join(", ")}`,
  `Lignes refusées après correction: ${summary.rejectedRowCount}`,
  `Lignes avec avertissement: ${summary.warningRowCount}`,
  "",
  "Corrections prudentes appliquées:",
  `- téléphones invalides laissés vides: ${clearedInvalidPhones}`,
  `- emails académiques ambigus laissés vides: ${clearedAmbiguousAcademicEmails}`,
  `- relations strictement dupliquées retirées: ${removedDuplicateRelationships}`,
  "",
  "Aucune donnée de connexion, aucun mot de passe et aucun secret ne sont inclus.",
].join("\n");
const reportBytes = Buffer.from(reportText, "utf8");
const verification = verifyIdentityDirectoryReport({ bytes: reportBytes, parsed });
if (!verification.matches) {
  throw new Error(`Le rapport généré ne correspond pas au fichier: ${verification.mismatchCodes.join(", ")}`);
}

await writeFile(outputPath, correctedBytes, { flag: "w" });
await writeFile(reportPath, reportBytes, { flag: "w" });
console.log(JSON.stringify({
  outputPath,
  reportPath,
  rowCount: summary.rowCount,
  personCount: summary.personCount,
  relationshipCount: summary.relationshipCount,
  warningRowCount: summary.warningRowCount,
  rejectedRowCount: summary.rejectedRowCount,
  readyForApproval: summary.readyForApproval,
  corrections: {
    clearedInvalidPhones,
    clearedAmbiguousAcademicEmails,
    removedDuplicateRelationships,
  },
}));
