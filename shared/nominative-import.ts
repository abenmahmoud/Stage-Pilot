// Import d'un fichier de valeurs nominatives et rapprochement avec le
// repertoire de l'etablissement.
//
// Ce module ne lit aucun fichier et n'ouvre aucune connexion : il recoit du
// texte et un instantane de repertoire, et rend un bilan. C'est ce qui permet
// de le prouver entierement avec des donnees fictives.
//
// Regle de rapprochement, volontairement stricte : une reference stable
// l'emporte toujours. Les noms et la classe servent a VERIFIER un
// rapprochement, jamais a en decider un quand il reste une ambiguite. Deux
// homonymes dans la meme classe ne sont pas departages par le systeme : ils
// sortent en « ambigu » et attendent une decision humaine.

import {
  NominativeValueError,
  parseBeneficiaryRef,
  parseNominativeValueText,
} from "./nominative-value-policy.js";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_ROWS = 5000;
const MAX_COLUMNS = 60;
const CONTROL_CHARACTERS = new RegExp(
  "[" + String.fromCharCode(0) + "-" + String.fromCharCode(8) + String.fromCharCode(11) + String.fromCharCode(12) + "]",
  "u"
);

export class NominativeImportError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("Le fichier importe est invalide");
    this.reason = reason;
  }
}

/** Lecture CSV minimale mais correcte : guillemets, separateur detecte, BOM retire. */
export function parseDelimitedFile(text: unknown): { headers: string[]; rows: string[][] } {
  if (typeof text !== "string") throw new NominativeImportError("file_invalid");
  if (new TextEncoder().encode(text).byteLength > MAX_FILE_BYTES) throw new NominativeImportError("file_too_large");
  const cleaned = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (CONTROL_CHARACTERS.test(cleaned)) throw new NominativeImportError("file_invalid");

  const firstLine = cleaned.split("\n", 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;
  for (let index = 0; index < cleaned.length; index += 1) {
    const character = cleaned[index];
    if (quoted) {
      if (character === '"') {
        if (cleaned[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += character;
    }
  }
  if (quoted) throw new NominativeImportError("quote_unterminated");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const populated = rows.filter((line) => line.some((cell) => cell.trim().length > 0));
  if (populated.length < 2) throw new NominativeImportError("file_empty");
  const headers = populated[0].map((cell) => cell.trim());
  if (headers.length < 1 || headers.length > MAX_COLUMNS) throw new NominativeImportError("headers_invalid");
  if (new Set(headers.map((header) => header.toLowerCase())).size !== headers.length) {
    throw new NominativeImportError("headers_duplicated");
  }
  const body = populated.slice(1);
  if (body.length > MAX_ROWS) throw new NominativeImportError("too_many_rows");
  if (body.some((line) => line.length !== headers.length)) {
    throw new NominativeImportError("row_width_invalid");
  }
  return { headers, rows: body };
}

export const NOMINATIVE_IMPORT_ROLES = [
  "beneficiary_ref",
  "last_name",
  "first_name",
  "class_label",
  "value",
] as const;

export type NominativeImportRole = (typeof NOMINATIVE_IMPORT_ROLES)[number];

const HEADER_HINTS: ReadonlyArray<{ role: NominativeImportRole; pattern: RegExp }> = [
  { role: "beneficiary_ref", pattern: /^(ref|reference|identifiant|ine|id)([ _-]?(eleve|beneficiaire))?$/i },
  { role: "last_name", pattern: /^(nom|nom de famille|nom_eleve)$/i },
  { role: "first_name", pattern: /^(prenom|prénom|prenom_eleve)$/i },
  { role: "class_label", pattern: /^(classe|division|groupe)$/i },
  { role: "value", pattern: /^(badge|numero de badge|numéro de badge|num_badge|valeur|information cantine|cantine)$/i },
];

export type NominativeColumnMapping = Partial<Record<NominativeImportRole, number>>;

/**
 * Prerempli ce qui est certain, et rien de plus : un en-tete ne suggere un
 * role que s'il correspond exactement a un libelle connu. La confirmation des
 * colonnes reste un geste du referent, parce qu'un en-tete « code » ne dit pas
 * si la valeur ouvre un acces.
 */
export function suggestColumnMapping(headers: readonly string[]): NominativeColumnMapping {
  const mapping: NominativeColumnMapping = {};
  headers.forEach((header, index) => {
    const normalized = header.trim();
    for (const hint of HEADER_HINTS) {
      if (hint.pattern.test(normalized) && mapping[hint.role] === undefined) {
        mapping[hint.role] = index;
      }
    }
  });
  return mapping;
}

export function assertMappingComplete(mapping: NominativeColumnMapping, columnCount: number): void {
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping) ||
    Object.keys(mapping).some((key) => !(NOMINATIVE_IMPORT_ROLES as readonly string[]).includes(key))) {
    throw new NominativeImportError("mapping_invalid");
  }
  if (mapping.value === undefined) throw new NominativeImportError("value_column_missing");
  const hasIdentity =
    mapping.beneficiary_ref !== undefined ||
    (mapping.last_name !== undefined && mapping.first_name !== undefined);
  if (!hasIdentity) throw new NominativeImportError("identity_columns_missing");
  const used = Object.values(mapping).filter((index) => index !== undefined);
  for (const index of used) {
    if (!Number.isInteger(index) || index < 0 || index >= columnCount) {
      throw new NominativeImportError("column_index_invalid");
    }
  }
  if (new Set(used).size !== used.length) throw new NominativeImportError("column_reused");
}

/** Un bénéficiaire connu de l'etablissement, tel que le repertoire le decrit. */
export type DirectoryBeneficiary = {
  beneficiaryRef: string;
  lastName: string;
  firstName: string;
  classLabel: string;
  contactRef: string | null;
  contactRevoked: boolean;
};

export type NominativeImportOutcome =
  | "ready"
  | "value_missing"
  | "match_missing"
  | "match_ambiguous"
  | "source_duplicate"
  | "contact_missing"
  | "contact_revoked";

export type NominativeImportRow = {
  rowNumber: number;
  outcome: NominativeImportOutcome;
  beneficiaryRef: string | null;
  contactRef: string | null;
  value: string | null;
  /** Ce qui a permis le rapprochement, pour que le referent puisse le verifier. */
  matchedBy: "reference" | "name_and_class" | null;
  candidateRefs: string[];
};

export type NominativeImportReport = {
  totalRows: number;
  readyCount: number;
  byOutcome: Record<NominativeImportOutcome, number>;
  rows: NominativeImportRow[];
};

function foldName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function cell(row: readonly string[], index: number | undefined): string {
  if (index === undefined) return "";
  return (row[index] ?? "").trim();
}

/**
 * Rapprochement et bilan. Aucun effet de bord, aucune ecriture, aucune
 * exposition de nom en dehors de l'objet rendu a l'interface administrative.
 */
export function buildNominativeImportReport(input: {
  rows: readonly (readonly string[])[];
  mapping: NominativeColumnMapping;
  directory: readonly DirectoryBeneficiary[];
}): NominativeImportReport {
  const byRef = new Map<string, DirectoryBeneficiary[]>();
  const byName = new Map<string, DirectoryBeneficiary[]>();
  for (const person of input.directory) {
    const references = byRef.get(person.beneficiaryRef) ?? [];
    references.push(person);
    byRef.set(person.beneficiaryRef, references);
    const key = foldName(person.lastName) + "|" + foldName(person.firstName) + "|" + foldName(person.classLabel);
    const bucket = byName.get(key);
    if (bucket) bucket.push(person);
    else byName.set(key, [person]);
  }

  const seenRefs = new Set<string>();
  const rows: NominativeImportRow[] = [];

  input.rows.forEach((row, index) => {
    const rowNumber = index + 2; // ligne 1 = en-tetes
    const rawValue = cell(row, input.mapping.value);
    let value: string | null = null;
    if (rawValue.length > 0) {
      try {
        value = parseNominativeValueText(rawValue);
      } catch (error) {
        if (!(error instanceof NominativeValueError)) throw error;
        value = null;
      }
    }

    let matched: DirectoryBeneficiary | null = null;
    let matchedBy: NominativeImportRow["matchedBy"] = null;
    let candidates: DirectoryBeneficiary[] = [];
    let identityConflict = false;

    const rawRef = cell(row, input.mapping.beneficiary_ref);
    if (rawRef.length > 0) {
      try {
        const reference = parseBeneficiaryRef(rawRef);
        candidates = byRef.get(reference) ?? [];
        if (candidates.length === 1) {
          matched = candidates[0];
          matchedBy = "reference";
          identityConflict = ([
            [input.mapping.last_name, matched.lastName],
            [input.mapping.first_name, matched.firstName],
            [input.mapping.class_label, matched.classLabel],
          ] as const).some(([column, expected]) => {
            const provided = cell(row, column);
            return provided.length > 0 && foldName(provided) !== foldName(expected);
          });
          if (identityConflict) { matched = null; matchedBy = null; }
        }
      } catch (error) {
        if (!(error instanceof NominativeValueError)) throw error;
      }
    }
    // A supplied reference is authoritative. An unknown or malformed reference
    // must never fall back to the name of a different beneficiary.
    if (!matched && rawRef.length === 0) {
      const key =
        foldName(cell(row, input.mapping.last_name)) +
        "|" +
        foldName(cell(row, input.mapping.first_name)) +
        "|" +
        foldName(cell(row, input.mapping.class_label));
      candidates = byName.get(key) ?? [];
      if (candidates.length === 1) {
        matched = candidates[0];
        matchedBy = "name_and_class";
      }
    }

    let outcome: NominativeImportOutcome;
    if (identityConflict || (!matched && candidates.length > 1)) outcome = "match_ambiguous";
    else if (!matched) outcome = "match_missing";
    else if (seenRefs.has(matched.beneficiaryRef)) outcome = "source_duplicate";
    else if (value === null) outcome = "value_missing";
    else if (!matched.contactRef) outcome = "contact_missing";
    else if (matched.contactRevoked) outcome = "contact_revoked";
    else outcome = "ready";

    if (matched && outcome !== "match_ambiguous") seenRefs.add(matched.beneficiaryRef);

    rows.push({
      rowNumber,
      outcome,
      beneficiaryRef: matched ? matched.beneficiaryRef : null,
      contactRef: matched && outcome === "ready" ? matched.contactRef : null,
      value: outcome === "ready" ? value : null,
      matchedBy,
      candidateRefs: candidates.length > 1 ? candidates.map((person) => person.beneficiaryRef).sort() : [],
    });
  });

  // Identical duplicate rows are harmless, but conflicting values for the same
  // beneficiary require review of ALL occurrences. File order cannot choose
  // which personal value will be sent.
  const occurrences = new Map<string, NominativeImportRow[]>();
  for (const row of rows) {
    if (!row.beneficiaryRef) continue;
    const group = occurrences.get(row.beneficiaryRef) ?? [];
    group.push(row);
    occurrences.set(row.beneficiaryRef, group);
  }
  for (const group of occurrences.values()) {
    if (group.length < 2) continue;
    const values = new Set(group.map((row) => cell(input.rows[row.rowNumber - 2], input.mapping.value)));
    if (values.size < 2) continue;
    for (const row of group) {
      row.outcome = "source_duplicate";
      row.value = null;
      row.contactRef = null;
    }
  }

  const byOutcome: Record<NominativeImportOutcome, number> = {
    ready: 0,
    value_missing: 0,
    match_missing: 0,
    match_ambiguous: 0,
    source_duplicate: 0,
    contact_missing: 0,
    contact_revoked: 0,
  };
  for (const row of rows) byOutcome[row.outcome] += 1;

  return {
    totalRows: rows.length,
    readyCount: byOutcome.ready,
    byOutcome,
    rows,
  };
}
