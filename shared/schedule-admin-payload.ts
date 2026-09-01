import {
  SCHEDULE_IMPORT_MAX_BYTES,
  SCHEDULE_IMPORT_MIME,
  type ScheduleImportInput,
  type ScheduleSourceKind,
} from "./schedule-import-input.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_FRAGMENT = UUID_PATTERN.source.slice(1, -1);
const ISO_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,3})?Z$/;
const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const YEAR_PATTERN = /^(\d{4})-(\d{4})$/;
const SUBJECT_REF_PATTERN = /^[A-Z0-9][A-Z0-9._:-]{1,79}$/;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;
const SIGNED_TOKEN_PATTERN = /^[A-Za-z0-9._-]{20,8192}$/;

export const SCHEDULE_IMPORT_BUCKET = "schedule-ingest";
export const SCHEDULE_SIGNED_URL_SECONDS = 60;
export const SCHEDULE_IMPORT_STATUSES = [
  "reserved",
  "uploaded",
  "quarantined",
  "processing",
  "review",
  "approved",
  "active",
  "superseded",
  "rejected",
  "failed",
  "retired",
] as const;

export type ScheduleImportStatus = (typeof SCHEDULE_IMPORT_STATUSES)[number];
export type ScheduleImportPayload = {
  id: string;
  sourceKind: ScheduleSourceKind;
  schoolYear: string;
  version: number;
  title: string;
  purposeDescription: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  freshUntil: string | null;
  originalName: string;
  sizeBytes: number;
  pageCount: number | null;
  status: ScheduleImportStatus;
  uploadedAt: string | null;
  createdAt: string;
};

export type SchedulePageMappingPayload = {
  id: string;
  pageNumber: number;
  subjectType: "class" | "teacher";
  subjectRef: string;
  reviewStatus: "draft" | "verified" | "rejected";
  reviewedAt: string | null;
};

export type SchedulePageSourcePayload = {
  id: string;
  sourceKind: ScheduleSourceKind;
  title: string;
  pageCount: number | null;
  status: ScheduleImportStatus;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  const candidate = record(value);
  if (!candidate) return null;
  const actual = Object.keys(candidate).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index])
    ? candidate
    : null;
}

function boundedText(value: unknown, minimum: number, maximum: number): string | null {
  return typeof value === "string"
    && value.length >= minimum
    && value.length <= maximum
    && !CONTROL_PATTERN.test(value)
    ? value
    : null;
}

function calendarDate(value: unknown): string | null {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : null;
}

function timestamp(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_PATTERN.test(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value ? value : null;
}

function nullableTimestamp(value: unknown): string | null | undefined {
  if (value === null) return null;
  return timestamp(value) ?? undefined;
}

function nullableDate(value: unknown): string | null | undefined {
  if (value === null) return null;
  return calendarDate(value) ?? undefined;
}

function schoolYear(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = YEAR_PATTERN.exec(value);
  return match && Number(match[2]) === Number(match[1]) + 1 ? value : null;
}

function pdfName(value: unknown): string | null {
  const name = boundedText(value, 5, 255);
  return name
    && name.toLowerCase().endsWith(".pdf")
    && !name.startsWith(".")
    && !name.includes("/")
    && !name.includes("\\")
    ? name
    : null;
}

function isoValue(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

function parseImportRecord(value: unknown): ScheduleImportPayload | null {
  const row = exactRecord(value, [
    "id",
    "sourceKind",
    "schoolYear",
    "version",
    "title",
    "purposeDescription",
    "effectiveFrom",
    "effectiveUntil",
    "freshUntil",
    "originalName",
    "sizeBytes",
    "pageCount",
    "status",
    "uploadedAt",
    "createdAt",
  ]);
  if (!row || typeof row.id !== "string" || !UUID_PATTERN.test(row.id)) return null;
  if (row.sourceKind !== "classes" && row.sourceKind !== "teachers") return null;
  const year = schoolYear(row.schoolYear);
  const title = boundedText(row.title, 2, 180);
  const purposeDescription = boundedText(row.purposeDescription, 20, 2_000);
  const effectiveFrom = calendarDate(row.effectiveFrom);
  const effectiveUntil = nullableDate(row.effectiveUntil);
  const freshUntil = nullableTimestamp(row.freshUntil);
  const originalName = pdfName(row.originalName);
  const uploadedAt = nullableTimestamp(row.uploadedAt);
  const createdAt = timestamp(row.createdAt);
  if (
    !year
    || !title
    || !purposeDescription
    || !effectiveFrom
    || effectiveUntil === undefined
    || freshUntil === undefined
    || !originalName
    || uploadedAt === undefined
    || !createdAt
    || !Number.isSafeInteger(row.version)
    || Number(row.version) < 1
    || Number(row.version) > 10_000
    || !Number.isSafeInteger(row.sizeBytes)
    || Number(row.sizeBytes) < 1
    || Number(row.sizeBytes) > SCHEDULE_IMPORT_MAX_BYTES
    || !(row.pageCount === null || (Number.isInteger(row.pageCount) && Number(row.pageCount) >= 1 && Number(row.pageCount) <= 500))
    || typeof row.status !== "string"
    || !SCHEDULE_IMPORT_STATUSES.includes(row.status as ScheduleImportStatus)
  ) return null;
  if (effectiveUntil !== null && effectiveUntil < effectiveFrom) return null;
  if (freshUntil !== null && Date.parse(freshUntil) < Date.parse(`${effectiveFrom}T00:00:00.000Z`)) return null;
  if (freshUntil !== null && effectiveUntil !== null && freshUntil.slice(0, 10) > effectiveUntil) return null;
  if (uploadedAt !== null && Date.parse(uploadedAt) < Date.parse(createdAt)) return null;
  const status = row.status as ScheduleImportStatus;
  if (status === "reserved" && (uploadedAt !== null || row.pageCount !== null)) return null;
  if (["review", "approved", "active", "superseded"].includes(status) && row.pageCount === null) return null;
  return {
    id: row.id,
    sourceKind: row.sourceKind,
    schoolYear: year,
    version: Number(row.version),
    title,
    purposeDescription,
    effectiveFrom,
    effectiveUntil,
    freshUntil,
    originalName,
    sizeBytes: Number(row.sizeBytes),
    pageCount: row.pageCount === null ? null : Number(row.pageCount),
    status,
    uploadedAt,
    createdAt,
  };
}

export function projectScheduleImportPayload(value: unknown): ScheduleImportPayload {
  const row = record(value);
  if (!row) throw new Error("Invalid schedule import projection");
  const projected = parseImportRecord({
    id: row.id,
    sourceKind: row.sourceKind,
    schoolYear: row.schoolYear,
    version: row.version,
    title: row.title,
    purposeDescription: row.purposeDescription,
    effectiveFrom: row.effectiveFrom,
    effectiveUntil: row.effectiveUntil,
    freshUntil: isoValue(row.freshUntil),
    originalName: row.originalName,
    sizeBytes: row.sizeBytes,
    pageCount: row.pageCount,
    status: row.status,
    uploadedAt: isoValue(row.uploadedAt),
    createdAt: isoValue(row.createdAt),
  });
  if (!projected) throw new Error("Invalid schedule import projection");
  return projected;
}

export function parseScheduleImportListPayload(value: unknown): { imports: ScheduleImportPayload[] } | null {
  const root = exactRecord(value, ["imports"]);
  if (!root || !Array.isArray(root.imports) || root.imports.length > 100) return null;
  const ids = new Set<string>();
  const imports: ScheduleImportPayload[] = [];
  let previousTime = Number.POSITIVE_INFINITY;
  for (const entry of root.imports) {
    const parsed = parseImportRecord(entry);
    if (!parsed || ids.has(parsed.id) || Date.parse(parsed.createdAt) > previousTime) return null;
    ids.add(parsed.id);
    imports.push(parsed);
    previousTime = Date.parse(parsed.createdAt);
  }
  return { imports };
}

export function parseScheduleImportReservationPayload(
  value: unknown,
  expected: ScheduleImportInput
): { import: ScheduleImportPayload; upload: { bucket: string; path: string; token: string } } | null {
  if (expected.mimeType !== SCHEDULE_IMPORT_MIME) return null;
  const root = exactRecord(value, ["import", "upload"]);
  const source = root ? parseImportRecord(root.import) : null;
  const upload = root ? exactRecord(root.upload, ["bucket", "path", "token"]) : null;
  if (
    !source
    || !upload
    || source.status !== "reserved"
    || source.sourceKind !== expected.sourceKind
    || source.schoolYear !== expected.schoolYear
    || source.title !== expected.title
    || source.purposeDescription !== expected.purposeDescription
    || source.effectiveFrom !== expected.effectiveFrom
    || source.effectiveUntil !== expected.effectiveUntil
    || source.freshUntil?.slice(0, 10) !== expected.freshUntil
    || source.originalName !== expected.originalName
    || source.sizeBytes !== expected.sizeBytes
    || upload.bucket !== SCHEDULE_IMPORT_BUCKET
    || typeof upload.path !== "string"
    || typeof upload.token !== "string"
    || !SIGNED_TOKEN_PATTERN.test(upload.token)
  ) return null;
  const pathPattern = new RegExp(
    `^${UUID_FRAGMENT}/${expected.schoolYear}/${expected.sourceKind}/${UUID_FRAGMENT}/${UUID_FRAGMENT}\\.pdf$`,
    "i"
  );
  if (!pathPattern.test(upload.path)) return null;
  return {
    import: source,
    upload: { bucket: SCHEDULE_IMPORT_BUCKET, path: upload.path, token: upload.token },
  };
}

export function parseScheduleImportMutationPayload(
  value: unknown,
  expected: {
    id: string;
    freshStatus: ScheduleImportStatus;
    duplicateStatuses: readonly ScheduleImportStatus[];
  }
): { import: ScheduleImportPayload; duplicate: boolean } | null {
  const root = exactRecord(value, ["import", "duplicate"]);
  const source = root ? parseImportRecord(root.import) : null;
  if (!root || !source || typeof root.duplicate !== "boolean" || source.id !== expected.id) return null;
  if (root.duplicate ? !expected.duplicateStatuses.includes(source.status) : source.status !== expected.freshStatus) {
    return null;
  }
  return { import: source, duplicate: root.duplicate };
}

function parsePageSource(value: unknown): SchedulePageSourcePayload | null {
  const row = exactRecord(value, ["id", "sourceKind", "title", "pageCount", "status"]);
  if (
    !row
    || typeof row.id !== "string"
    || !UUID_PATTERN.test(row.id)
    || (row.sourceKind !== "classes" && row.sourceKind !== "teachers")
    || !boundedText(row.title, 2, 180)
    || !(row.pageCount === null || (Number.isInteger(row.pageCount) && Number(row.pageCount) >= 1 && Number(row.pageCount) <= 500))
    || typeof row.status !== "string"
    || !SCHEDULE_IMPORT_STATUSES.includes(row.status as ScheduleImportStatus)
  ) return null;
  return {
    id: row.id,
    sourceKind: row.sourceKind,
    title: String(row.title),
    pageCount: row.pageCount === null ? null : Number(row.pageCount),
    status: row.status as ScheduleImportStatus,
  };
}

function parsePageMapping(value: unknown): SchedulePageMappingPayload | null {
  const row = exactRecord(value, [
    "id",
    "pageNumber",
    "subjectType",
    "subjectRef",
    "reviewStatus",
    "reviewedAt",
  ]);
  const reviewedAt = row ? nullableTimestamp(row.reviewedAt) : undefined;
  if (
    !row
    || typeof row.id !== "string"
    || !UUID_PATTERN.test(row.id)
    || !Number.isInteger(row.pageNumber)
    || Number(row.pageNumber) < 1
    || Number(row.pageNumber) > 500
    || (row.subjectType !== "class" && row.subjectType !== "teacher")
    || typeof row.subjectRef !== "string"
    || !SUBJECT_REF_PATTERN.test(row.subjectRef)
    || (row.reviewStatus !== "draft" && row.reviewStatus !== "verified" && row.reviewStatus !== "rejected")
    || reviewedAt === undefined
    || ((row.reviewStatus === "draft") !== (reviewedAt === null))
  ) return null;
  return {
    id: row.id,
    pageNumber: Number(row.pageNumber),
    subjectType: row.subjectType,
    subjectRef: row.subjectRef,
    reviewStatus: row.reviewStatus,
    reviewedAt,
  };
}

export function projectSchedulePageMappingPayload(value: unknown): SchedulePageMappingPayload {
  const row = record(value);
  const projected = row ? parsePageMapping({
    id: row.id,
    pageNumber: row.pageNumber,
    subjectType: row.subjectType,
    subjectRef: row.subjectRef,
    reviewStatus: row.reviewStatus,
    reviewedAt: isoValue(row.reviewedAt),
  }) : null;
  if (!projected) throw new Error("Invalid schedule page projection");
  return projected;
}

export function projectSchedulePageSourcePayload(value: unknown): SchedulePageSourcePayload {
  const row = record(value);
  const projected = row ? parsePageSource({
    id: row.id,
    sourceKind: row.sourceKind,
    title: row.title,
    pageCount: row.pageCount,
    status: row.status,
  }) : null;
  if (!projected) throw new Error("Invalid schedule page source projection");
  return projected;
}

export function parseSchedulePageListPayload(
  value: unknown,
  expectedSourceId: string
): { source: SchedulePageSourcePayload; pages: SchedulePageMappingPayload[] } | null {
  const root = exactRecord(value, ["source", "pages"]);
  const source = root ? parsePageSource(root.source) : null;
  if (
    !root
    || !source
    || source.id !== expectedSourceId
    || source.status !== "review"
    || source.pageCount === null
    || !Array.isArray(root.pages)
    || root.pages.length > 500
  ) {
    return null;
  }
  const ids = new Set<string>();
  const pageNumbers = new Set<number>();
  const subjectRefs = new Set<string>();
  const expectedType = source.sourceKind === "classes" ? "class" : "teacher";
  const pages: SchedulePageMappingPayload[] = [];
  let previousPage = 0;
  for (const entry of root.pages) {
    const page = parsePageMapping(entry);
    if (
      !page
      || page.subjectType !== expectedType
      || ids.has(page.id)
      || pageNumbers.has(page.pageNumber)
      || subjectRefs.has(page.subjectRef)
      || page.pageNumber <= previousPage
      || (source.pageCount !== null && page.pageNumber > source.pageCount)
    ) return null;
    ids.add(page.id);
    pageNumbers.add(page.pageNumber);
    subjectRefs.add(page.subjectRef);
    pages.push(page);
    previousPage = page.pageNumber;
  }
  return { source, pages };
}

export function parseSchedulePageMutationPayload(
  value: unknown,
  expected: { id?: string; pageNumber: number; subjectType: "class" | "teacher"; subjectRef: string; reviewStatus: "draft" | "verified" }
): { mapping: SchedulePageMappingPayload } | null {
  const root = exactRecord(value, ["mapping"]);
  const mapping = root ? parsePageMapping(root.mapping) : null;
  if (
    !mapping
    || (expected.id !== undefined && mapping.id !== expected.id)
    || mapping.pageNumber !== expected.pageNumber
    || mapping.subjectType !== expected.subjectType
    || mapping.subjectRef !== expected.subjectRef
    || mapping.reviewStatus !== expected.reviewStatus
  ) return null;
  return { mapping };
}

export function parseSchedulePrivateFilePayload(
  value: unknown,
  expectedOrigin: string
): { url: string; expiresInSeconds: number } | null {
  const root = exactRecord(value, ["url", "expiresInSeconds"]);
  if (
    !root
    || root.expiresInSeconds !== SCHEDULE_SIGNED_URL_SECONDS
    || typeof root.url !== "string"
    || root.url.length > 8_192
  ) return null;
  let url: URL;
  try {
    url = new URL(root.url);
  } catch {
    return null;
  }
  const queryKeys = [...url.searchParams.keys()];
  const token = url.searchParams.get("token");
  if (
    url.protocol !== "https:"
    || url.origin !== expectedOrigin
    || url.username
    || url.password
    || url.hash
    || !url.pathname.startsWith(`/storage/v1/object/sign/${SCHEDULE_IMPORT_BUCKET}/`)
    || queryKeys.length !== 1
    || queryKeys[0] !== "token"
    || !token
    || !SIGNED_TOKEN_PATTERN.test(token)
  ) return null;
  return { url: url.toString(), expiresInSeconds: SCHEDULE_SIGNED_URL_SECONDS };
}
