export const SCHEDULE_IMPORT_MAX_BYTES = 50 * 1024 * 1024;
export const SCHEDULE_IMPORT_MIME = "application/pdf";

export type ScheduleSourceKind = "classes" | "teachers";

export type ScheduleImportInput = {
  sourceKind: ScheduleSourceKind;
  schoolYear: string;
  title: string;
  purposeDescription: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  freshUntil: string;
  originalName: string;
  mimeType: typeof SCHEDULE_IMPORT_MIME;
  sizeBytes: number;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Les informations du fichier sont invalides.");
  }
  return value as Record<string, unknown>;
}

function text(
  value: unknown,
  label: string,
  min: number,
  max: number
): string {
  if (typeof value !== "string") throw new Error(`${label} est obligatoire.`);
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length < min || cleaned.length > max) {
    throw new Error(`${label} doit contenir entre ${min} et ${max} caractères.`);
  }
  return cleaned;
}

function schoolYear(value: unknown): string {
  const cleaned = text(value, "L'année scolaire", 9, 9);
  const match = /^(\d{4})-(\d{4})$/.exec(cleaned);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) {
    throw new Error("L'année scolaire doit suivre le format 2026-2027.");
  }
  return cleaned;
}

function calendarDate(value: unknown, year: string, label: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} est invalide.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} est invalide.`);
  }
  const [start, end] = year.split("-").map(Number);
  const dateYear = date.getUTCFullYear();
  if (dateYear !== start && dateYear !== end) {
    throw new Error(`${label} doit appartenir à l'année scolaire choisie.`);
  }
  return value;
}

function fileName(value: unknown): string {
  const cleaned = text(value, "Le nom du fichier", 5, 255);
  if (
    cleaned.includes("/") ||
    cleaned.includes("\\") ||
    cleaned.startsWith(".") ||
    !cleaned.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("Choisissez un fichier PDF dont le nom est valide.");
  }
  return cleaned;
}

export function parseScheduleImportInput(value: unknown): ScheduleImportInput {
  const input = record(value);
  if (input.sourceKind !== "classes" && input.sourceKind !== "teachers") {
    throw new Error("Le type d'emploi du temps est invalide.");
  }
  const year = schoolYear(input.schoolYear);
  const effectiveFrom = calendarDate(input.effectiveFrom, year, "La date d'effet");
  const effectiveUntil = input.effectiveUntil === null || input.effectiveUntil === ""
    ? null
    : calendarDate(input.effectiveUntil, year, "La date de fin");
  const freshUntil = calendarDate(input.freshUntil, year, "La date de recontrôle");
  if (effectiveUntil !== null && effectiveUntil < effectiveFrom) {
    throw new Error("La date de fin ne peut pas précéder la date d'effet.");
  }
  if (freshUntil < effectiveFrom || (effectiveUntil !== null && freshUntil > effectiveUntil)) {
    throw new Error("La date de recontrôle doit être comprise dans la période de validité.");
  }
  if (input.mimeType !== SCHEDULE_IMPORT_MIME) {
    throw new Error("Seuls les documents PDF sont acceptés.");
  }
  if (
    typeof input.sizeBytes !== "number" ||
    !Number.isSafeInteger(input.sizeBytes) ||
    input.sizeBytes < 1 ||
    input.sizeBytes > SCHEDULE_IMPORT_MAX_BYTES
  ) {
    throw new Error("Le PDF doit peser entre 1 octet et 50 Mo.");
  }
  return {
    sourceKind: input.sourceKind,
    schoolYear: year,
    title: text(input.title, "Le titre", 2, 180),
    purposeDescription: text(input.purposeDescription, "L'usage prévu", 20, 2000),
    effectiveFrom,
    effectiveUntil,
    freshUntil,
    originalName: fileName(input.originalName),
    mimeType: SCHEDULE_IMPORT_MIME,
    sizeBytes: input.sizeBytes,
  };
}
