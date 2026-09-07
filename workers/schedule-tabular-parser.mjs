// LOT 3 du plan `docs/operations/PLAN_IMPORT_UTILISABLE_2026-09-07.md`.
//
// Lit un fichier CSV/Excel déposé pour un emploi du temps et rend ses
// en-têtes bruts tels quels : contrairement à
// `workers/identity-directory-parser.mjs`, ce module ne connaît AUCUN nom
// de colonne attendu et n'en rejette ni n'en renomme aucun — le plan
// interdit explicitement de deviner les en-têtes. La correspondance
// classe/professeur/matière/salle/jour/heures est choisie par un humain
// (`shared/schedule-tabular-mapping.ts`) une fois ces en-têtes affichés à
// l'écran.
//
// Bornes et contrôles calqués sur `identity-directory-parser.mjs` (même
// bibliothèque `xlsx`, même rejet des formules/macros, même vérification de
// signature) : un fichier tabulaire d'emploi du temps est une donnée
// scolaire yet-untrusted comme un annuaire d'identité.

import { createHash } from "node:crypto";
import * as XLSX from "xlsx";

export const SCHEDULE_TABULAR_MAX_BYTES = 20 * 1024 * 1024;
export const SCHEDULE_TABULAR_MAX_ROWS = 20_000;
const MAX_COLUMNS = 40;
const MAX_HEADER_LENGTH = 120;
const MAX_CELL_LENGTH = 200;

export class ScheduleTabularParseError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ScheduleTabularParseError";
    this.code = code;
  }
}

function cleanCell(value) {
  const text = String(value ?? "").normalize("NFKC").trim();
  return text.length > MAX_CELL_LENGTH ? text.slice(0, MAX_CELL_LENGTH) : text;
}

export function parseScheduleTabularBytes({ bytes, fileName }) {
  if (!Buffer.isBuffer(bytes)) {
    throw new ScheduleTabularParseError("invalid_buffer", "Fichier illisible");
  }
  if (bytes.length < 1 || bytes.length > SCHEDULE_TABULAR_MAX_BYTES) {
    throw new ScheduleTabularParseError("invalid_size", "Taille de fichier invalide");
  }
  const extension = String(fileName).split(".").pop()?.toLowerCase();
  if (extension !== "csv" && extension !== "xlsx") {
    throw new ScheduleTabularParseError("unsupported_format", "Format non accepté");
  }
  if (extension === "xlsx" && !bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    throw new ScheduleTabularParseError("invalid_signature", "Signature Excel invalide");
  }
  if (extension === "csv" && bytes.includes(0)) {
    throw new ScheduleTabularParseError("invalid_signature", "Signature CSV invalide");
  }
  if (extension === "xlsx" && bytes.includes(Buffer.from("vbaProject.bin"))) {
    throw new ScheduleTabularParseError("macro_not_allowed", "Les macros sont interdites");
  }

  let workbook;
  try {
    workbook = XLSX.read(bytes, {
      type: "buffer",
      raw: false,
      cellFormula: true,
      cellHTML: false,
      cellNF: false,
      cellDates: false,
      bookVBA: false,
      WTF: false,
    });
  } catch {
    throw new ScheduleTabularParseError("unreadable_workbook", "Le tableau est illisible");
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new ScheduleTabularParseError("empty_workbook", "Le fichier ne contient aucune feuille");
  }
  const sheet = workbook.Sheets[sheetName];
  const ref = sheet["!ref"];
  if (!ref) throw new ScheduleTabularParseError("empty_sheet", "La feuille est vide");

  const range = XLSX.utils.decode_range(ref);
  const columnCount = range.e.c - range.s.c + 1;
  if (columnCount > MAX_COLUMNS) {
    throw new ScheduleTabularParseError("too_many_columns", "Le fichier contient trop de colonnes");
  }
  for (const [address, cell] of Object.entries(sheet)) {
    if (!address.startsWith("!") && cell && typeof cell === "object" && "f" in cell) {
      throw new ScheduleTabularParseError("formula_not_allowed", "Le fichier contient une formule interdite");
    }
  }

  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });
  if (matrix.length < 2) {
    throw new ScheduleTabularParseError("no_data_rows", "Le fichier ne contient aucune ligne de données");
  }
  if (matrix.length - 1 > SCHEDULE_TABULAR_MAX_ROWS) {
    throw new ScheduleTabularParseError("too_many_rows", "Le fichier contient trop de lignes");
  }

  const headers = matrix[0].map((value) => cleanCell(value)).map((value) => value.slice(0, MAX_HEADER_LENGTH));
  if (headers.some((header) => header.length === 0)) {
    throw new ScheduleTabularParseError("empty_header", "Une colonne du fichier n'a pas d'en-tête");
  }
  if (new Set(headers).size !== headers.length) {
    throw new ScheduleTabularParseError("duplicate_column", "Le fichier contient deux colonnes identiques");
  }

  const rows = matrix.slice(1).map((values) => headers.map((_, index) => cleanCell(values[index])));

  return {
    checksum: createHash("sha256").update(bytes).digest("hex"),
    headers,
    rows,
    rowCount: rows.length,
  };
}
