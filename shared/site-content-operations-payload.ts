const ISO_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;
const MAX_COUNT = 1_000_000;

export type SiteContentOperationsPayload = {
  generatedAt: string;
  summary: {
    total: number;
    pending: number;
    quarantine: number;
    quarantineOver15m: number;
    ready: number;
    blocked: number;
    scanError: number;
    archived: number;
    legacyReadyWithoutScan: number;
    oldestQuarantineAt: string | null;
    lastScanAt: string | null;
  };
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

function count(value: unknown): number | null {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= MAX_COUNT
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

function projectedTimestamp(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  return timestamp(value);
}

function nullableProjectedTimestamp(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return projectedTimestamp(value) || undefined;
}

export function parseSiteContentOperationsPayload(value: unknown): SiteContentOperationsPayload | null {
  const envelope = exactRecord(value, ["generatedAt", "summary"]);
  const generatedAt = envelope ? timestamp(envelope.generatedAt) : null;
  const summary = envelope ? exactRecord(envelope.summary, [
    "total", "pending", "quarantine", "quarantineOver15m", "ready",
    "blocked", "scanError", "archived", "legacyReadyWithoutScan",
    "oldestQuarantineAt", "lastScanAt",
  ]) : null;
  if (!envelope || !generatedAt || !summary) return null;

  const total = count(summary.total);
  const pending = count(summary.pending);
  const quarantine = count(summary.quarantine);
  const quarantineOver15m = count(summary.quarantineOver15m);
  const ready = count(summary.ready);
  const blocked = count(summary.blocked);
  const scanError = count(summary.scanError);
  const archived = count(summary.archived);
  const legacyReadyWithoutScan = count(summary.legacyReadyWithoutScan);
  const oldestQuarantineAt = nullableTimestamp(summary.oldestQuarantineAt);
  const lastScanAt = nullableTimestamp(summary.lastScanAt);
  if (
    total === null || pending === null || quarantine === null
    || quarantineOver15m === null || ready === null || blocked === null
    || scanError === null || archived === null || legacyReadyWithoutScan === null
    || oldestQuarantineAt === undefined || lastScanAt === undefined
  ) return null;
  if (pending + quarantine + ready + blocked + scanError + archived !== total) return null;
  if (quarantineOver15m > quarantine || legacyReadyWithoutScan > ready) return null;
  if ((quarantine === 0) !== (oldestQuarantineAt === null)) return null;

  return {
    generatedAt,
    summary: {
      total,
      pending,
      quarantine,
      quarantineOver15m,
      ready,
      blocked,
      scanError,
      archived,
      legacyReadyWithoutScan,
      oldestQuarantineAt,
      lastScanAt,
    },
  };
}

export function projectSiteContentOperationsPayload(input: {
  generatedAt: Date | string;
  summary: {
    total: number;
    pending: number;
    quarantine: number;
    quarantineOver15m: number;
    ready: number;
    blocked: number;
    scanError: number;
    archived: number;
    legacyReadyWithoutScan: number;
    oldestQuarantineAt: Date | string | null;
    lastScanAt: Date | string | null;
  };
}): SiteContentOperationsPayload {
  const payload = {
    generatedAt: projectedTimestamp(input.generatedAt),
    summary: {
      ...input.summary,
      oldestQuarantineAt: nullableProjectedTimestamp(input.summary.oldestQuarantineAt),
      lastScanAt: nullableProjectedTimestamp(input.summary.lastScanAt),
    },
  };
  const parsed = parseSiteContentOperationsPayload(payload);
  if (!parsed) throw new Error("Invalid site content operations projection");
  return parsed;
}
