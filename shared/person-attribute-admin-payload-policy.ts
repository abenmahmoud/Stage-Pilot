const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const STATUSES = ["review", "active", "superseded", "rejected"] as const;

export type PersonAttributeImportStatus = (typeof STATUSES)[number];

export type PersonAttributeImportListItem = {
  id: string;
  originalName: string;
  rowCount: number;
  status: PersonAttributeImportStatus;
  createdAt: string;
  approvedAt: string | null;
};

type PersonAttributeActionPayload = {
  import: PersonAttributeImportListItem;
  duplicate: boolean;
};

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, fields: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === fields.length && keys.every((key) => fields.includes(key));
}

function iso(value: unknown): value is string {
  if (typeof value !== "string" || !ISO.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function item(value: unknown): value is PersonAttributeImportListItem {
  return record(value)
    && exact(value, ["id", "originalName", "rowCount", "status", "createdAt", "approvedAt"])
    && typeof value.id === "string"
    && UUID.test(value.id)
    && typeof value.originalName === "string"
    && value.originalName === value.originalName.trim()
    && value.originalName.length >= 1
    && value.originalName.length <= 255
    && !/[\u0000-\u001f\u007f]/.test(value.originalName)
    && Number.isSafeInteger(value.rowCount)
    && Number(value.rowCount) >= 1
    && Number(value.rowCount) <= 25_000
    && typeof value.status === "string"
    && (STATUSES as readonly string[]).includes(value.status)
    && iso(value.createdAt)
    && (value.approvedAt === null || iso(value.approvedAt));
}

export function isPersonAttributeImportListPayload(
  value: unknown
): value is { imports: PersonAttributeImportListItem[] } {
  if (!record(value)
    || !exact(value, ["imports"])
    || !Array.isArray(value.imports)
    || value.imports.length > 100
    || !value.imports.every(item)) return false;
  const imports = value.imports as PersonAttributeImportListItem[];
  if (new Set(imports.map((entry) => entry.id)).size !== imports.length) return false;
  return imports.every((entry, index) => (
    index === 0 || Date.parse(imports[index - 1].createdAt) >= Date.parse(entry.createdAt)
  ));
}

export function isPersonAttributeActionPayload(
  value: unknown,
  expectedId: string
): value is PersonAttributeActionPayload {
  return record(value)
    && exact(value, ["import", "duplicate"])
    && typeof value.duplicate === "boolean"
    && item(value.import)
    && value.import.id === expectedId
    && value.import.status === "active";
}
