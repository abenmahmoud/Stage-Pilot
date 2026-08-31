export type SupportQueuePayloadRow = {
  publicCode: string;
};

export type SupportQueueServiceRow = {
  service: string | null;
};

export type SupportQueuePayloadPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export const SUPPORT_QUEUE_SERVICES = [
  "referent_numerique",
  "ddfpt",
  "secretariat",
  "vie_scolaire",
  "intendance",
  "direction",
  "administration",
] as const;

const SUPPORT_QUEUE_REQUESTER_TYPES = [
  "eleve",
  "parent",
  "professeur",
  "personnel",
  "autre",
] as const;

const SUPPORT_QUEUE_BENEFICIARY_TYPES = [
  "self",
  "eleve",
  "professeur",
  "personnel",
  "autre",
] as const;

const SUPPORT_QUEUE_CATEGORIES = [
  "inscription",
  "affectation_classe",
  "documents_scolarite",
  "ent",
  "email_academique",
  "ordinateur",
  "logiciel",
  "restauration_bourse",
  "orientation_formation",
  "vie_scolaire",
  "autre",
] as const;

const SUPPORT_QUEUE_STATUSES = [
  "nouveau",
  "a_qualifier",
  "assigne",
  "en_cours",
  "attente_demandeur",
  "attente_interne",
  "resolu",
  "clos",
  "indesirable",
] as const;

const SUPPORT_QUEUE_PRIORITIES = ["p1", "p2", "p3", "p4"] as const;
const SUPPORT_QUEUE_ACCESS_ROLES = ["superadmin", "proviseur", "administration", "agent"] as const;
const SUPPORT_PUBLIC_CODE_PATTERN = /^BC-\d{4}-\d{6}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SUBJECT_CONTEXT_ENTRIES = 20;
const MAX_SUBJECT_CONTEXT_KEY_LENGTH = 60;
const MAX_SUBJECT_CONTEXT_VALUE_LENGTH = 700;

type SupportQueueCoreRow = {
  publicCode: string;
  requesterType: string;
  requesterFirstName: string;
  requesterLastName: string;
  beneficiaryType: string;
  beneficiaryFirstName: string | null;
  beneficiaryLastName: string | null;
  subjectContext: Record<string, string>;
  category: string;
  subject: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  assignedTeam: string | null;
  slaDueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type SupportQueueAccessPayload = {
  role: string;
  label: string;
  serviceCodes: string[];
  canViewAll: boolean;
  canRoute: boolean;
  canManageTemplates: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedText(value: unknown, maximum: number, allowEmpty = false): value is string {
  return typeof value === "string"
    && value.length <= maximum
    && (allowEmpty || value.trim().length > 0);
}

function isNullableBoundedText(value: unknown, maximum: number): value is string | null {
  return value === null || isBoundedText(value, maximum);
}

function isKnownValue<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && allowed.includes(value as T[number]);
}

function isSupportDate(value: unknown): value is string {
  return isBoundedText(value, 40) && Number.isFinite(Date.parse(value));
}

function isNullableSupportDate(value: unknown): value is string | null {
  return value === null || isSupportDate(value);
}

function isSubjectContext(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= MAX_SUBJECT_CONTEXT_ENTRIES
    && entries.every(([key, item]) => (
      isBoundedText(key, MAX_SUBJECT_CONTEXT_KEY_LENGTH)
      && isBoundedText(item, MAX_SUBJECT_CONTEXT_VALUE_LENGTH)
    ));
}

export function isKnownSupportQueueService(value: unknown): value is string | null {
  return value === null || isKnownValue(value, SUPPORT_QUEUE_SERVICES);
}

export function isValidSupportQueueCoreRow(value: unknown): value is SupportQueueCoreRow {
  if (!isRecord(value)) return false;
  return typeof value.publicCode === "string"
    && SUPPORT_PUBLIC_CODE_PATTERN.test(value.publicCode)
    && isKnownValue(value.requesterType, SUPPORT_QUEUE_REQUESTER_TYPES)
    && isBoundedText(value.requesterFirstName, 100)
    && isBoundedText(value.requesterLastName, 100)
    && isKnownValue(value.beneficiaryType, SUPPORT_QUEUE_BENEFICIARY_TYPES)
    && isNullableBoundedText(value.beneficiaryFirstName, 100)
    && isNullableBoundedText(value.beneficiaryLastName, 100)
    && isSubjectContext(value.subjectContext)
    && isKnownValue(value.category, SUPPORT_QUEUE_CATEGORIES)
    && isBoundedText(value.subject, 180)
    && isKnownValue(value.status, SUPPORT_QUEUE_STATUSES)
    && isKnownValue(value.priority, SUPPORT_QUEUE_PRIORITIES)
    && (value.assignedTo === null || (typeof value.assignedTo === "string" && UUID_PATTERN.test(value.assignedTo)))
    && isKnownSupportQueueService(value.assignedTeam)
    && isNullableSupportDate(value.slaDueAt)
    && isSupportDate(value.createdAt)
    && isSupportDate(value.updatedAt);
}

export function isValidSupportQueueAccess(value: unknown): value is SupportQueueAccessPayload {
  if (!isRecord(value)
    || !isKnownValue(value.role, SUPPORT_QUEUE_ACCESS_ROLES)
    || !isBoundedText(value.label, 80)
    || !Array.isArray(value.serviceCodes)
    || value.serviceCodes.length > SUPPORT_QUEUE_SERVICES.length
    || !value.serviceCodes.every((service) => isKnownValue(service, SUPPORT_QUEUE_SERVICES))
    || new Set(value.serviceCodes).size !== value.serviceCodes.length
  ) {
    return false;
  }
  return typeof value.canViewAll === "boolean"
    && typeof value.canRoute === "boolean"
    && typeof value.canManageTemplates === "boolean";
}

export function hasUniqueSupportQueueRows(rows: SupportQueuePayloadRow[]): boolean {
  return new Set(rows.map((row) => row.publicCode)).size === rows.length;
}

export function hasUniqueSupportQueueServices(rows: SupportQueueServiceRow[]): boolean {
  const keys = rows.map((row) => row.service ?? "__unassigned__");
  return new Set(keys).size === keys.length;
}

export function hasCoherentSupportQueuePagination(
  requestCount: number,
  pagination: SupportQueuePayloadPagination
): boolean {
  if (
    !Number.isInteger(requestCount)
    || requestCount < 0
    || !Number.isInteger(pagination.page)
    || pagination.page < 1
    || !Number.isInteger(pagination.pageSize)
    || pagination.pageSize < 1
    || !Number.isInteger(pagination.total)
    || pagination.total < 0
    || !Number.isInteger(pagination.totalPages)
    || pagination.totalPages < 1
  ) {
    return false;
  }

  const expectedTotalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  if (
    pagination.totalPages !== expectedTotalPages
    || pagination.page > pagination.totalPages
    || requestCount > pagination.pageSize
    || requestCount > pagination.total
  ) {
    return false;
  }

  return pagination.total === 0
    ? pagination.page === 1 && requestCount === 0
    : requestCount > 0;
}
