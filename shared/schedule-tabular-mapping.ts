// LOT 3 du plan `docs/operations/PLAN_IMPORT_UTILISABLE_2026-09-07.md` :
// correspondance de colonnes pour un import tabulaire (CSV/Excel), choisie
// explicitement par un administrateur — jamais devinée à partir des noms
// d'en-têtes. Ce module est volontairement pur (aucun accès réseau ni
// stockage) pour rester testable en isolation et partageable entre le
// front (formulaire de correspondance) et l'API (application de la
// correspondance après lecture du fichier).
//
// La sortie (`ScheduleTabularSlotCandidate`) a exactement la forme attendue
// par `shared/schedule-slot-input.ts` : ce module ne fait qu'amener une
// ligne de tableur à cette forme, il n'invente pas un second point
// d'écriture. `api/_shared/schedule-slot-write.ts` reste inchangé.

const REF_PATTERN = /^[A-Z0-9][A-Z0-9._:-]{1,79}$/;
const SUBJECT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._:-]{0,31}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

export const SCHEDULE_TABULAR_MAX_ROWS = 20_000;
export const SCHEDULE_TABULAR_MAX_GROUPS = 500;
export const SCHEDULE_TABULAR_MAX_ROWS_PER_GROUP = 80;

export const SCHEDULE_TABULAR_REQUIRED_FIELDS = [
  "subjectRef",
  "subjectCode",
  "subjectLabel",
  "date",
  "startTime",
  "endTime",
] as const;

export const SCHEDULE_TABULAR_OPTIONAL_FIELDS = [
  "roomCode",
  "weekPattern",
  "groupRef",
] as const;

export type ScheduleTabularRequiredField = (typeof SCHEDULE_TABULAR_REQUIRED_FIELDS)[number];
export type ScheduleTabularOptionalField = (typeof SCHEDULE_TABULAR_OPTIONAL_FIELDS)[number];
export type ScheduleTabularField = ScheduleTabularRequiredField | ScheduleTabularOptionalField;

const ALL_FIELDS: readonly ScheduleTabularField[] = [
  ...SCHEDULE_TABULAR_REQUIRED_FIELDS,
  ...SCHEDULE_TABULAR_OPTIONAL_FIELDS,
];

// header choisi par l'administrateur pour chaque champ cible, ou `null`
// pour un champ optionnel absent du fichier — jamais deviné.
export type ScheduleTabularColumnMapping = Record<ScheduleTabularRequiredField, string> &
  Record<ScheduleTabularOptionalField, string | null>;

export type ScheduleTabularSlotCandidate = {
  subjectCode: string;
  subjectLabel: string;
  roomCode: string | null;
  startsAt: string;
  endsAt: string;
  weekPattern: string | null;
  groupRef: string | null;
};

export type ScheduleTabularGroup = {
  subjectRef: string;
  rows: ScheduleTabularSlotCandidate[];
};

export type ScheduleTabularRowIssue = {
  rowNumber: number;
  code:
    | "missing_value"
    | "invalid_reference"
    | "invalid_subject_code"
    | "invalid_date"
    | "invalid_time"
    | "invalid_time_range";
  field: ScheduleTabularField;
};

export type ScheduleTabularApplyResult =
  | { ok: true; groups: ScheduleTabularGroup[]; totalRowCount: number; rejectedRowCount: number }
  | { ok: false; reason: "too_many_rows" | "too_many_groups" | "group_too_large" | "no_valid_rows"; detail?: string };

function hasControlChar(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * Valide une correspondance proposée par l'administrateur contre la liste
 * réelle des en-têtes lus dans le fichier : chaque champ obligatoire doit
 * pointer vers un en-tête présent, chaque en-tête ne peut être utilisé
 * qu'une seule fois, et aucun champ non listé n'est accepté (pas de
 * correspondance implicite).
 */
export function parseScheduleTabularColumnMapping(
  value: unknown,
  headers: readonly string[]
): ScheduleTabularColumnMapping | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const actualKeys = Object.keys(input).sort();
  const expectedKeys = [...ALL_FIELDS].sort();
  if (actualKeys.length !== expectedKeys.length || !actualKeys.every((key, index) => key === expectedKeys[index])) {
    return null;
  }
  const headerSet = new Set(headers);
  if (headerSet.size !== headers.length) return null;

  const usedHeaders = new Set<string>();
  const mapping: Partial<ScheduleTabularColumnMapping> = {};

  for (const field of SCHEDULE_TABULAR_REQUIRED_FIELDS) {
    const header = input[field];
    if (typeof header !== "string" || !headerSet.has(header) || usedHeaders.has(header)) return null;
    usedHeaders.add(header);
    mapping[field] = header;
  }
  for (const field of SCHEDULE_TABULAR_OPTIONAL_FIELDS) {
    const header = input[field];
    if (header === null) {
      mapping[field] = null;
      continue;
    }
    if (typeof header !== "string" || !headerSet.has(header) || usedHeaders.has(header)) return null;
    usedHeaders.add(header);
    mapping[field] = header;
  }
  return mapping as ScheduleTabularColumnMapping;
}

function normalizeRef(value: string): string {
  return value.normalize("NFKC").trim().toUpperCase().replace(/\s+/g, "-");
}

function cellAt(row: readonly string[], headers: readonly string[], header: string | null): string {
  if (header === null) return "";
  const index = headers.indexOf(header);
  if (index < 0 || index >= row.length) return "";
  const raw = row[index];
  return typeof raw === "string" ? raw.normalize("NFKC").trim() : "";
}

/**
 * Applique une correspondance déjà validée aux lignes brutes du fichier
 * (une ligne = une occurrence datée, comme la saisie manuelle de
 * `ScheduleSlotEditor.tsx` : ce module ne déduit aucune récurrence
 * hebdomadaire à partir d'un jour de semaine, le fichier doit porter une
 * date explicite par ligne). Regroupe par référence de classe/professeur
 * pour correspondre à une page de `schedule_page_indexes` par groupe.
 */
export function applyScheduleTabularColumnMapping(params: {
  mapping: ScheduleTabularColumnMapping;
  headers: readonly string[];
  rows: readonly (readonly string[])[];
}): ScheduleTabularApplyResult {
  const { mapping, headers, rows } = params;
  if (rows.length < 1 || rows.length > SCHEDULE_TABULAR_MAX_ROWS) {
    return { ok: false, reason: "too_many_rows", detail: String(rows.length) };
  }

  const groupOrder: string[] = [];
  const groupsByRef = new Map<string, ScheduleTabularSlotCandidate[]>();
  let rejectedRowCount = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const issues: ScheduleTabularRowIssue[] = [];

    const subjectRefRaw = cellAt(row, headers, mapping.subjectRef);
    const subjectRef = normalizeRef(subjectRefRaw);
    if (!subjectRef || hasControlChar(subjectRefRaw) || !REF_PATTERN.test(subjectRef)) {
      issues.push({ rowNumber, code: subjectRefRaw ? "invalid_reference" : "missing_value", field: "subjectRef" });
    }

    const subjectCodeRaw = cellAt(row, headers, mapping.subjectCode);
    const subjectCode = normalizeRef(subjectCodeRaw);
    if (!subjectCode || !SUBJECT_CODE_PATTERN.test(subjectCode)) {
      issues.push({
        rowNumber,
        code: subjectCodeRaw ? "invalid_subject_code" : "missing_value",
        field: "subjectCode",
      });
    }

    const subjectLabel = cellAt(row, headers, mapping.subjectLabel);
    if (subjectLabel.length < 2 || subjectLabel.length > 120 || hasControlChar(subjectLabel)) {
      issues.push({ rowNumber, code: "missing_value", field: "subjectLabel" });
    }

    const date = cellAt(row, headers, mapping.date);
    const dateValid = DATE_PATTERN.test(date) && Number.isFinite(new Date(`${date}T00:00:00.000Z`).getTime());
    if (!dateValid) issues.push({ rowNumber, code: date ? "invalid_date" : "missing_value", field: "date" });

    const startTime = cellAt(row, headers, mapping.startTime);
    if (!TIME_PATTERN.test(startTime)) {
      issues.push({ rowNumber, code: startTime ? "invalid_time" : "missing_value", field: "startTime" });
    }
    const endTime = cellAt(row, headers, mapping.endTime);
    if (!TIME_PATTERN.test(endTime)) {
      issues.push({ rowNumber, code: endTime ? "invalid_time" : "missing_value", field: "endTime" });
    }

    const roomCodeRaw = cellAt(row, headers, mapping.roomCode);
    const roomCode = roomCodeRaw.length === 0 ? null : roomCodeRaw;
    if (roomCode !== null && (roomCode.length > 40 || hasControlChar(roomCode))) {
      issues.push({ rowNumber, code: "missing_value", field: "roomCode" });
    }

    const weekPatternRaw = cellAt(row, headers, mapping.weekPattern);
    const weekPattern = weekPatternRaw.length === 0 ? null : weekPatternRaw;
    if (weekPattern !== null && (weekPattern.length > 16 || hasControlChar(weekPattern))) {
      issues.push({ rowNumber, code: "missing_value", field: "weekPattern" });
    }

    const groupRefRaw = cellAt(row, headers, mapping.groupRef);
    const groupRef = groupRefRaw.length === 0 ? null : normalizeRef(groupRefRaw);
    if (groupRef !== null && !REF_PATTERN.test(groupRef)) {
      issues.push({ rowNumber, code: "invalid_reference", field: "groupRef" });
    }

    if (issues.length > 0 || !dateValid) {
      rejectedRowCount += 1;
      return;
    }

    const startsAt = new Date(`${date}T${startTime}:00.000Z`).toISOString();
    const endsAt = new Date(`${date}T${endTime}:00.000Z`).toISOString();
    if (Date.parse(endsAt) <= Date.parse(startsAt)) {
      rejectedRowCount += 1;
      return;
    }

    if (!groupsByRef.has(subjectRef)) {
      groupOrder.push(subjectRef);
      groupsByRef.set(subjectRef, []);
    }
    groupsByRef.get(subjectRef)!.push({
      subjectCode,
      subjectLabel,
      roomCode,
      startsAt,
      endsAt,
      weekPattern,
      groupRef,
    });
  });

  if (groupOrder.length === 0) return { ok: false, reason: "no_valid_rows" };
  if (groupOrder.length > SCHEDULE_TABULAR_MAX_GROUPS) {
    return { ok: false, reason: "too_many_groups", detail: String(groupOrder.length) };
  }
  const tooLarge = groupOrder.find(
    (ref) => (groupsByRef.get(ref)?.length ?? 0) > SCHEDULE_TABULAR_MAX_ROWS_PER_GROUP
  );
  if (tooLarge) return { ok: false, reason: "group_too_large", detail: tooLarge };

  return {
    ok: true,
    groups: groupOrder.map((subjectRef) => ({ subjectRef, rows: groupsByRef.get(subjectRef)! })),
    totalRowCount: rows.length,
    rejectedRowCount,
  };
}
