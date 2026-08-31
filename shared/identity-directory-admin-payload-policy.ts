import { IDENTITY_DIRECTORY_MAX_BYTES, IDENTITY_DIRECTORY_MAX_ROWS } from "./identity-directory-input.js";

export const IDENTITY_DIRECTORY_STATUSES = [
  "reserved",
  "uploaded",
  "quarantined",
  "parsing",
  "review",
  "approved",
  "active",
  "superseded",
  "rejected",
  "failed",
  "retired",
] as const;

const PERSON_TYPES = ["student", "guardian", "staff"] as const;
const RELATIONSHIP_TYPES = ["self", "guardian_of", "member_of", "teaches", "manages"] as const;
const RECORD_TYPES = ["person", "relationship", "unknown"] as const;
const VALIDATION_STATUSES = ["valid", "warning", "rejected"] as const;
const ISSUE_SEVERITIES = ["warning", "error"] as const;
const ISSUE_CODES = [
  "duplicate_person_ref",
  "duplicate_relationship",
  "duplicate_academic_email",
  "shared_personal_email",
  "shared_phone",
  "invalid_email",
  "invalid_phone",
  "invalid_date",
  "invalid_date_range",
  "invalid_person_type",
  "invalid_relationship_type",
  "invalid_record_type",
  "invalid_reference",
  "missing_value",
  "no_contact_factor",
  "student_without_class",
  "staff_without_service",
  "unknown_subject_ref",
  "unknown_object_ref",
  "self_reference_mismatch",
  "value_too_long",
] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/;
const STORAGE_PATH_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/\d{4}\/(?:0[1-9]|1[0-2])\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:csv|xlsx)$/i;
const UPLOAD_TOKEN_PATTERN = /^[A-Za-z0-9._~-]+$/;

const LIST_FIELDS = new Set(["imports"]);
const LIST_ITEM_FIELDS = new Set([
  "id",
  "title",
  "purposeDescription",
  "originalName",
  "sizeBytes",
  "status",
  "rowCount",
  "validRowCount",
  "rejectedRowCount",
  "createdAt",
]);
const ACTION_VIEW_FIELDS = new Set(["id", "status", "updatedAt"]);
const ACTION_FIELDS = new Set(["import", "duplicate"]);
const RESERVATION_FIELDS = new Set(["import", "upload"]);
const UPLOAD_FIELDS = new Set(["bucket", "path", "token"]);
const REPORT_FIELDS = new Set(["import", "rows", "pagination"]);
const REPORT_IMPORT_FIELDS = new Set([
  "id",
  "status",
  "rowCount",
  "validRowCount",
  "rejectedRowCount",
  "validationSummary",
]);
const SUMMARY_FIELDS = new Set(["warningRowCount", "issueCounts"]);
const ROW_FIELDS = new Set([
  "id",
  "sourceSheet",
  "rowNumber",
  "recordType",
  "personRef",
  "personType",
  "subjectPersonRef",
  "relationshipType",
  "objectRef",
  "classRef",
  "serviceCode",
  "validFrom",
  "validUntil",
  "validationStatus",
  "issues",
]);
const ISSUE_FIELDS = new Set(["severity", "code", "column"]);
const PAGINATION_FIELDS = new Set(["page", "pageSize", "total"]);

export type IdentityDirectoryStatus = (typeof IDENTITY_DIRECTORY_STATUSES)[number];

export type IdentityDirectoryListItem = {
  id: string;
  title: string;
  purposeDescription: string;
  originalName: string;
  sizeBytes: number;
  status: IdentityDirectoryStatus;
  rowCount: number | null;
  validRowCount: number | null;
  rejectedRowCount: number | null;
  createdAt: string;
};

export type IdentityDirectoryActionView = {
  id: string;
  status: IdentityDirectoryStatus;
  updatedAt: string;
};

export type IdentityDirectoryActionPayload = {
  import: IdentityDirectoryActionView;
  duplicate: boolean;
};

export type IdentityDirectoryReservationPayload = {
  import: IdentityDirectoryActionView;
  upload: { bucket: string; path: string; token: string };
};

export type IdentityDirectoryReportIssue = {
  severity: (typeof ISSUE_SEVERITIES)[number];
  code: (typeof ISSUE_CODES)[number];
  column: string;
};

export type IdentityDirectoryReportRow = {
  id: number;
  sourceSheet: string;
  rowNumber: number;
  recordType: (typeof RECORD_TYPES)[number];
  personRef: string | null;
  personType: (typeof PERSON_TYPES)[number] | null;
  subjectPersonRef: string | null;
  relationshipType: (typeof RELATIONSHIP_TYPES)[number] | null;
  objectRef: string | null;
  classRef: string | null;
  serviceCode: string | null;
  validFrom: string | null;
  validUntil: string | null;
  validationStatus: (typeof VALIDATION_STATUSES)[number];
  issues: IdentityDirectoryReportIssue[];
};

export type IdentityDirectoryReportPayload = {
  import: {
    id: string;
    status: IdentityDirectoryStatus;
    rowCount: number | null;
    validRowCount: number | null;
    rejectedRowCount: number | null;
    validationSummary: {
      warningRowCount: number;
      issueCounts: Partial<Record<(typeof ISSUE_CODES)[number], number>>;
    };
  };
  rows: IdentityDirectoryReportRow[];
  pagination: { page: number; pageSize: number; total: number };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

function known<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && allowed.includes(value as T[number]);
}

function boundedText(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === "string"
    && value === value.trim()
    && value.length >= minimum
    && value.length <= maximum
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function boundedMultilineText(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === "string"
    && value === value.trim()
    && value.length >= minimum
    && value.length <= maximum
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}

function canonicalIso(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function calendarDay(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function countOrNull(value: unknown): value is number | null {
  return value === null
    || (Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= IDENTITY_DIRECTORY_MAX_ROWS);
}

function coherentCounts(value: Record<string, unknown>): boolean {
  if (!countOrNull(value.rowCount)
    || !countOrNull(value.validRowCount)
    || !countOrNull(value.rejectedRowCount)) return false;
  if (value.rowCount === null) {
    return value.validRowCount === null && value.rejectedRowCount === null;
  }
  return value.validRowCount !== null
    && value.rejectedRowCount !== null
    && Number(value.validRowCount) + Number(value.rejectedRowCount) <= Number(value.rowCount);
}

function isReferenceOrNull(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && REFERENCE_PATTERN.test(value));
}

function isListItem(value: unknown): value is IdentityDirectoryListItem {
  return isRecord(value)
    && hasExactKeys(value, LIST_ITEM_FIELDS)
    && typeof value.id === "string"
    && UUID_PATTERN.test(value.id)
    && boundedText(value.title, 2, 180)
    && boundedMultilineText(value.purposeDescription, 20, 2_000)
    && boundedText(value.originalName, 1, 255)
    && Number.isSafeInteger(value.sizeBytes)
    && Number(value.sizeBytes) > 0
    && Number(value.sizeBytes) <= IDENTITY_DIRECTORY_MAX_BYTES
    && known(value.status, IDENTITY_DIRECTORY_STATUSES)
    && coherentCounts(value)
    && canonicalIso(value.createdAt);
}

function isActionView(value: unknown): value is IdentityDirectoryActionView {
  return isRecord(value)
    && hasExactKeys(value, ACTION_VIEW_FIELDS)
    && typeof value.id === "string"
    && UUID_PATTERN.test(value.id)
    && known(value.status, IDENTITY_DIRECTORY_STATUSES)
    && canonicalIso(value.updatedAt);
}

function isIssue(value: unknown): value is IdentityDirectoryReportIssue {
  return isRecord(value)
    && hasExactKeys(value, ISSUE_FIELDS)
    && known(value.severity, ISSUE_SEVERITIES)
    && known(value.code, ISSUE_CODES)
    && boundedText(value.column, 1, 64)
    && /^[a-z0-9_]+$/i.test(value.column);
}

function isReportRow(value: unknown): value is IdentityDirectoryReportRow {
  return isRecord(value)
    && hasExactKeys(value, ROW_FIELDS)
    && Number.isSafeInteger(value.id)
    && Number(value.id) > 0
    && boundedText(value.sourceSheet, 1, 120)
    && Number.isSafeInteger(value.rowNumber)
    && Number(value.rowNumber) >= 1
    && Number(value.rowNumber) <= IDENTITY_DIRECTORY_MAX_ROWS + 1
    && known(value.recordType, RECORD_TYPES)
    && isReferenceOrNull(value.personRef)
    && (value.personType === null || known(value.personType, PERSON_TYPES))
    && isReferenceOrNull(value.subjectPersonRef)
    && (value.relationshipType === null || known(value.relationshipType, RELATIONSHIP_TYPES))
    && isReferenceOrNull(value.objectRef)
    && isReferenceOrNull(value.classRef)
    && isReferenceOrNull(value.serviceCode)
    && (value.validFrom === null || calendarDay(value.validFrom))
    && (value.validUntil === null || calendarDay(value.validUntil))
    && known(value.validationStatus, VALIDATION_STATUSES)
    && Array.isArray(value.issues)
    && value.issues.length <= 24
    && value.issues.every(isIssue);
}

function isSummary(value: unknown, rowCount: number | null): boolean {
  if (!isRecord(value)
    || !hasExactKeys(value, SUMMARY_FIELDS)
    || !Number.isSafeInteger(value.warningRowCount)
    || Number(value.warningRowCount) < 0
    || Number(value.warningRowCount) > (rowCount ?? 0)
    || !isRecord(value.issueCounts)
    || Object.keys(value.issueCounts).length > ISSUE_CODES.length) {
    return false;
  }
  return Object.entries(value.issueCounts).every(([code, count]) => (
    (ISSUE_CODES as readonly string[]).includes(code)
    && Number.isSafeInteger(count)
    && Number(count) >= 0
    && Number(count) <= IDENTITY_DIRECTORY_MAX_ROWS
  ));
}

export function isIdentityDirectoryListPayload(
  value: unknown
): value is { imports: IdentityDirectoryListItem[] } {
  if (!isRecord(value)
    || !hasExactKeys(value, LIST_FIELDS)
    || !Array.isArray(value.imports)
    || value.imports.length > 100
    || !value.imports.every(isListItem)) return false;
  const ids = value.imports.map((entry) => (entry as IdentityDirectoryListItem).id);
  if (new Set(ids).size !== ids.length) return false;
  for (let index = 1; index < value.imports.length; index += 1) {
    const previous = value.imports[index - 1] as IdentityDirectoryListItem;
    const current = value.imports[index] as IdentityDirectoryListItem;
    if (Date.parse(previous.createdAt) < Date.parse(current.createdAt)) return false;
  }
  return true;
}

export function isIdentityDirectoryReservationPayload(
  value: unknown
): value is IdentityDirectoryReservationPayload {
  return isRecord(value)
    && hasExactKeys(value, RESERVATION_FIELDS)
    && isActionView(value.import)
    && value.import.status === "reserved"
    && isRecord(value.upload)
    && hasExactKeys(value.upload, UPLOAD_FIELDS)
    && value.upload.bucket === "identity-ingest"
    && typeof value.upload.path === "string"
    && STORAGE_PATH_PATTERN.test(value.upload.path)
    && typeof value.upload.token === "string"
    && value.upload.token.length >= 20
    && value.upload.token.length <= 4_096
    && UPLOAD_TOKEN_PATTERN.test(value.upload.token);
}

export function isIdentityDirectoryActionPayload(
  value: unknown,
  expectedId: string,
  allowedStatuses: readonly IdentityDirectoryStatus[]
): value is IdentityDirectoryActionPayload {
  return isRecord(value)
    && hasExactKeys(value, ACTION_FIELDS)
    && typeof value.duplicate === "boolean"
    && isActionView(value.import)
    && value.import.id === expectedId
    && allowedStatuses.includes(value.import.status);
}

export function isIdentityDirectoryReportPayload(
  value: unknown,
  expectedImportId: string,
  expectedPage: number
): value is IdentityDirectoryReportPayload {
  if (!isRecord(value)
    || !hasExactKeys(value, REPORT_FIELDS)
    || !isRecord(value.import)
    || !hasExactKeys(value.import, REPORT_IMPORT_FIELDS)
    || value.import.id !== expectedImportId
    || !UUID_PATTERN.test(expectedImportId)
    || !known(value.import.status, IDENTITY_DIRECTORY_STATUSES)
    || !coherentCounts(value.import)
    || !isSummary(value.import.validationSummary, value.import.rowCount as number | null)
    || !Array.isArray(value.rows)
    || value.rows.length > 100
    || !value.rows.every(isReportRow)
    || !isRecord(value.pagination)
    || !hasExactKeys(value.pagination, PAGINATION_FIELDS)
    || value.pagination.page !== expectedPage
    || value.pagination.pageSize !== 100
    || !Number.isSafeInteger(value.pagination.total)
    || Number(value.pagination.total) < 0
    || Number(value.pagination.total) > IDENTITY_DIRECTORY_MAX_ROWS) {
    return false;
  }
  const total = Number(value.pagination.total);
  const maximumPage = Math.max(1, Math.ceil(total / 100));
  if (expectedPage < 1 || expectedPage > maximumPage) return false;
  const expectedRows = Math.min(100, Math.max(0, total - (expectedPage - 1) * 100));
  if (value.rows.length !== expectedRows) return false;
  const ids = value.rows.map((row) => (row as IdentityDirectoryReportRow).id);
  return new Set(ids).size === ids.length;
}
