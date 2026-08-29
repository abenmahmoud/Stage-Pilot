export type SchedulePageMappingInput = {
  pageNumber: number;
  subjectRef: string;
};

const SUBJECT_REF = /^[A-Z0-9][A-Z0-9._:-]{1,79}$/;

function cleanRef(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");
}

export function parseSchedulePageMappingInput(value: unknown): SchedulePageMappingInput {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const pageNumber = Number(input.pageNumber);
  const subjectRef = cleanRef(input.subjectRef);

  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 500) {
    throw new Error("La page doit être comprise entre 1 et 500.");
  }
  if (!SUBJECT_REF.test(subjectRef)) {
    throw new Error("La référence doit contenir 2 à 80 lettres, chiffres, points, tirets ou deux-points.");
  }
  return { pageNumber, subjectRef };
}
