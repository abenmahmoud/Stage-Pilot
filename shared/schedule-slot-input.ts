// Bornes alignées sur les contraintes réelles de `public.schedule_slots`
// (`supabase/migrations/20260830024727_create_private_schedule_slots.sql`) :
// un rejet ici doit rester une erreur de validation lisible, jamais une
// contrainte Postgres brute remontée à l'appelant.
const SUBJECT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._:-]{0,31}$/;
const REF_PATTERN = /^[A-Z0-9][A-Z0-9._:-]{1,79}$/;
const ISO_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;
const MAX_ROWS = 80;

export type ScheduleSlotRowInput = {
  subjectCode: string;
  subjectLabel: string;
  roomCode: string | null;
  startsAt: string;
  endsAt: string;
  weekPattern: string | null;
  groupRef: string | null;
};

export type ScheduleSlotBatchInput = { rows: ScheduleSlotRowInput[] };

function hasControlChar(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function cleanRef(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");
}

function boundedText(value: unknown, minimum: number, maximum: number): string | null {
  if (typeof value !== "string" || hasControlChar(value)) return null;
  const trimmed = value.trim();
  return trimmed.length >= minimum && trimmed.length <= maximum ? trimmed : null;
}

function isoInstant(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_PATTERN.test(value)) return null;
  return Number.isFinite(new Date(value).getTime()) ? value : null;
}

function optionalGroupRef(value: unknown, rowNumber: number): string | null {
  if (value === null || value === undefined) return null;
  const ref = cleanRef(value);
  if (!REF_PATTERN.test(ref)) {
    throw new Error(`Ligne ${rowNumber} : groupe invalide.`);
  }
  return ref;
}

function parseRow(value: unknown, rowNumber: number): ScheduleSlotRowInput {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  const subjectCode = cleanRef(input.subjectCode);
  if (!SUBJECT_CODE_PATTERN.test(subjectCode)) {
    throw new Error(`Ligne ${rowNumber} : code matière invalide.`);
  }
  const subjectLabel = boundedText(input.subjectLabel, 2, 120);
  if (!subjectLabel) {
    throw new Error(`Ligne ${rowNumber} : intitulé de matière invalide.`);
  }
  const startsAt = isoInstant(input.startsAt);
  const endsAt = isoInstant(input.endsAt);
  if (!startsAt || !endsAt) {
    throw new Error(`Ligne ${rowNumber} : horaires invalides.`);
  }
  if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new Error(`Ligne ${rowNumber} : l'horaire de fin doit suivre le début.`);
  }
  const roomCode = input.roomCode === null || input.roomCode === undefined
    ? null
    : boundedText(input.roomCode, 1, 40);
  if (input.roomCode !== null && input.roomCode !== undefined && roomCode === null) {
    throw new Error(`Ligne ${rowNumber} : salle invalide.`);
  }
  const weekPattern = input.weekPattern === null || input.weekPattern === undefined
    ? null
    : boundedText(input.weekPattern, 1, 16);
  if (input.weekPattern !== null && input.weekPattern !== undefined && weekPattern === null) {
    throw new Error(`Ligne ${rowNumber} : alternance de semaine invalide.`);
  }
  const groupRef = optionalGroupRef(input.groupRef, rowNumber);

  return { subjectCode, subjectLabel, roomCode, startsAt, endsAt, weekPattern, groupRef };
}

export function parseScheduleSlotBatchInput(value: unknown): ScheduleSlotBatchInput {
  const root = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
  const rawRows = root?.rows;
  if (!Array.isArray(rawRows) || rawRows.length < 1 || rawRows.length > MAX_ROWS) {
    throw new Error(`La liste des créneaux doit contenir entre 1 et ${MAX_ROWS} lignes.`);
  }

  const rows = rawRows.map((entry, index) => parseRow(entry, index + 1));

  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const key = `${row.subjectCode}|${row.groupRef ?? ""}|${row.startsAt}|${row.endsAt}`;
    if (seen.has(key)) {
      throw new Error(`Ligne ${index + 1} : créneau en double dans l'envoi.`);
    }
    seen.add(key);
  });

  return { rows };
}
