import {
  AGENT_RUNTIME_OUTCOMES,
  type AgentRuntimeOutcome,
} from "./agent-runtime-metrics.js";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_CODE_PATTERN = /^BC-[0-9]{4}-[0-9]{6}$/;
const ERROR_CODE_PATTERN = /^[a-z0-9_]{1,80}$/;
const JOB_TYPE_PATTERN = /^[a-z][a-z0-9_]{0,79}$/;
const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const ISO_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,3})?Z$/;
const CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export const SUPPORT_OPERATION_CATEGORIES = [
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

type SupportOperationCategory = (typeof SUPPORT_OPERATION_CATEGORIES)[number];

export type SupportOperationsPayload = {
  generatedAt: string;
  summary: {
    failuresWaiting: number;
    jobSuccesses24h: number;
    jobFailures24h: number;
    webhookAlerts24h: number;
    deliveryAlerts24h: number;
    attachmentsWaiting: number;
    attachmentRemovalsWaiting: number;
    lastSuccessAt: string | null;
  };
  activity30d: {
    created: number;
    resolved: number;
    resolutionRate: number;
    openBacklog: number;
    averageResolutionHours: number;
    p90ResolutionHours: number;
    categories: Array<{ category: SupportOperationCategory; count: number }>;
  };
  failures: Array<{
    id: string;
    jobType: string;
    attempts: number;
    lastErrorCode: string | null;
    lastErrorSummary: string | null;
    failedAt: string;
    publicCode: string | null;
    subject: string | null;
  }>;
};

export type AgentMetricsPayload = {
  generatedAt: string;
  days: 7 | 30;
  summary: {
    total: number;
    aiAttempts: number;
    aiSuccesses: number;
    localOrFallback: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostMicros: number;
    pricedRuns: number;
    pricingConfigured: boolean;
    pricingComplete: boolean;
    serviceChanges: number;
    routingCorrections: number;
    routingCorrectionRate: number;
    routingReviewTotal: number;
    routingReviewPending: number;
    routingReviewConfirmed: number;
    routingReviewCorrected: number;
    routingReviewCompletionRate: number;
    routingReviewCorrectionRate: number;
  };
  outcomes: Array<{ outcome: AgentRuntimeOutcome; count: number }>;
  daily: Array<{
    date: string;
    total: number;
    aiSuccesses: number;
    averageLatencyMs: number;
  }>;
};

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    return null;
  }
  return value as Record<string, unknown>;
}

function integer(value: unknown, maximum = 1_000_000_000): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximum
    ? value
    : null;
}

function rate(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;
}

function timestamp(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_PATTERN.test(value) || !Number.isFinite(Date.parse(value))) {
    return null;
  }
  return value;
}

function nullableTimestamp(value: unknown): string | null | undefined {
  if (value === null) return null;
  return timestamp(value) ?? undefined;
}

function nullableText(value: unknown, maximum: number): string | null | undefined {
  if (value === null) return null;
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximum ||
    CONTROL_PATTERN.test(value)
  ) {
    return undefined;
  }
  return value;
}

function percentageMatches(actual: number, numerator: number, denominator: number): boolean {
  const expected = denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
  return Math.abs(actual - expected) < 0.001;
}

export function parseSupportOperationsPayload(value: unknown): SupportOperationsPayload | null {
  const root = exactRecord(value, ["generatedAt", "summary", "activity30d", "failures"]);
  if (!root) return null;
  const generatedAt = timestamp(root.generatedAt);
  const summaryInput = exactRecord(root.summary, [
    "failuresWaiting",
    "jobSuccesses24h",
    "jobFailures24h",
    "webhookAlerts24h",
    "deliveryAlerts24h",
    "attachmentsWaiting",
    "attachmentRemovalsWaiting",
    "lastSuccessAt",
  ]);
  const activityInput = exactRecord(root.activity30d, [
    "created",
    "resolved",
    "resolutionRate",
    "openBacklog",
    "averageResolutionHours",
    "p90ResolutionHours",
    "categories",
  ]);
  if (!generatedAt || !summaryInput || !activityInput || !Array.isArray(root.failures)) return null;

  const failuresWaiting = integer(summaryInput.failuresWaiting);
  const jobSuccesses24h = integer(summaryInput.jobSuccesses24h);
  const jobFailures24h = integer(summaryInput.jobFailures24h);
  const webhookAlerts24h = integer(summaryInput.webhookAlerts24h);
  const deliveryAlerts24h = integer(summaryInput.deliveryAlerts24h);
  const attachmentsWaiting = integer(summaryInput.attachmentsWaiting);
  const attachmentRemovalsWaiting = integer(summaryInput.attachmentRemovalsWaiting);
  const lastSuccessAt = nullableTimestamp(summaryInput.lastSuccessAt);
  if (
    failuresWaiting === null ||
    jobSuccesses24h === null ||
    jobFailures24h === null ||
    webhookAlerts24h === null ||
    deliveryAlerts24h === null ||
    attachmentsWaiting === null ||
    attachmentRemovalsWaiting === null ||
    lastSuccessAt === undefined
  ) return null;

  const created = integer(activityInput.created);
  const resolved = integer(activityInput.resolved);
  const resolutionRate = rate(activityInput.resolutionRate);
  const openBacklog = integer(activityInput.openBacklog);
  const averageResolutionHours = integer(activityInput.averageResolutionHours, 87_600);
  const p90ResolutionHours = integer(activityInput.p90ResolutionHours, 87_600);
  if (
    created === null || resolved === null || resolutionRate === null || openBacklog === null ||
    averageResolutionHours === null || p90ResolutionHours === null || resolved > created ||
    !percentageMatches(resolutionRate, resolved, created) ||
    !Array.isArray(activityInput.categories) || activityInput.categories.length > 5
  ) return null;

  const categoryNames = new Set<string>();
  const categories: SupportOperationsPayload["activity30d"]["categories"] = [];
  for (const input of activityInput.categories) {
    const row = exactRecord(input, ["category", "count"]);
    const count = row ? integer(row.count) : null;
    if (
      !row || typeof row.category !== "string" ||
      !SUPPORT_OPERATION_CATEGORIES.includes(row.category as SupportOperationCategory) ||
      count === null || categoryNames.has(row.category)
    ) return null;
    categoryNames.add(row.category);
    categories.push({ category: row.category as SupportOperationCategory, count });
  }
  if (categories.reduce((sum, entry) => sum + entry.count, 0) > created) return null;

  if (root.failures.length > 50) return null;
  const failureIds = new Set<string>();
  const failures: SupportOperationsPayload["failures"] = [];
  for (const input of root.failures) {
    const row = exactRecord(input, [
      "id", "jobType", "attempts", "lastErrorCode", "lastErrorSummary", "failedAt", "publicCode", "subject",
    ]);
    const attempts = row ? integer(row.attempts, 100) : null;
    const failedAt = row ? timestamp(row.failedAt) : null;
    const lastErrorSummary = row ? nullableText(row.lastErrorSummary, 500) : undefined;
    const subject = row ? nullableText(row.subject, 200) : undefined;
    if (
      !row || typeof row.id !== "string" || !UUID_PATTERN.test(row.id) || failureIds.has(row.id) ||
      typeof row.jobType !== "string" || !JOB_TYPE_PATTERN.test(row.jobType) || attempts === null || !failedAt ||
      !(row.lastErrorCode === null || (typeof row.lastErrorCode === "string" && ERROR_CODE_PATTERN.test(row.lastErrorCode))) ||
      lastErrorSummary === undefined || subject === undefined ||
      !(row.publicCode === null || (typeof row.publicCode === "string" && PUBLIC_CODE_PATTERN.test(row.publicCode)))
    ) return null;
    failureIds.add(row.id);
    failures.push({
      id: row.id,
      jobType: row.jobType,
      attempts,
      lastErrorCode: row.lastErrorCode,
      lastErrorSummary,
      failedAt,
      publicCode: row.publicCode,
      subject,
    });
  }
  if (failuresWaiting < failures.length) return null;

  return {
    generatedAt,
    summary: {
      failuresWaiting,
      jobSuccesses24h,
      jobFailures24h,
      webhookAlerts24h,
      deliveryAlerts24h,
      attachmentsWaiting,
      attachmentRemovalsWaiting,
      lastSuccessAt,
    },
    activity30d: {
      created,
      resolved,
      resolutionRate,
      openBacklog,
      averageResolutionHours,
      p90ResolutionHours,
      categories,
    },
    failures,
  };
}

export function parseAgentMetricsPayload(value: unknown): AgentMetricsPayload | null {
  const root = exactRecord(value, ["generatedAt", "days", "summary", "outcomes", "daily"]);
  const generatedAt = root ? timestamp(root.generatedAt) : null;
  const summaryInput = root ? exactRecord(root.summary, [
    "total", "aiAttempts", "aiSuccesses", "localOrFallback", "averageLatencyMs", "p95LatencyMs",
    "inputTokens", "outputTokens", "totalTokens", "estimatedCostMicros", "pricedRuns",
    "pricingConfigured", "pricingComplete", "serviceChanges", "routingCorrections",
    "routingCorrectionRate", "routingReviewTotal", "routingReviewPending", "routingReviewConfirmed",
    "routingReviewCorrected", "routingReviewCompletionRate", "routingReviewCorrectionRate",
  ]) : null;
  if (
    !root || !generatedAt || (root.days !== 7 && root.days !== 30) || !summaryInput ||
    !Array.isArray(root.outcomes) || !Array.isArray(root.daily)
  ) return null;

  const countKeys = [
    "total", "aiAttempts", "aiSuccesses", "localOrFallback", "averageLatencyMs", "p95LatencyMs",
    "inputTokens", "outputTokens", "totalTokens", "estimatedCostMicros", "pricedRuns",
    "serviceChanges", "routingCorrections", "routingReviewTotal", "routingReviewPending",
    "routingReviewConfirmed", "routingReviewCorrected",
  ] as const;
  const counts: Record<(typeof countKeys)[number], number> = {} as Record<(typeof countKeys)[number], number>;
  for (const key of countKeys) {
    const maximum = key === "estimatedCostMicros" ? 1_000_000_000_000_000 :
      key.endsWith("Tokens") ? 1_000_000_000_000 :
      key.endsWith("LatencyMs") ? 120_000 : 1_000_000_000;
    const parsed = integer(summaryInput[key], maximum);
    if (parsed === null) return null;
    counts[key] = parsed;
  }
  const routingCorrectionRate = rate(summaryInput.routingCorrectionRate);
  const routingReviewCompletionRate = rate(summaryInput.routingReviewCompletionRate);
  const routingReviewCorrectionRate = rate(summaryInput.routingReviewCorrectionRate);
  if (
    routingCorrectionRate === null || routingReviewCompletionRate === null || routingReviewCorrectionRate === null ||
    typeof summaryInput.pricingConfigured !== "boolean" || typeof summaryInput.pricingComplete !== "boolean" ||
    counts.aiAttempts > counts.total || counts.aiSuccesses > counts.aiAttempts ||
    counts.localOrFallback !== counts.total - counts.aiSuccesses || counts.pricedRuns > counts.total ||
    counts.inputTokens + counts.outputTokens > counts.totalTokens ||
    counts.routingCorrections > counts.serviceChanges ||
    counts.routingReviewPending + counts.routingReviewConfirmed + counts.routingReviewCorrected !== counts.routingReviewTotal ||
    !percentageMatches(routingCorrectionRate, counts.routingCorrections, counts.serviceChanges) ||
    !percentageMatches(
      routingReviewCompletionRate,
      counts.routingReviewConfirmed + counts.routingReviewCorrected,
      counts.routingReviewTotal
    ) ||
    !percentageMatches(
      routingReviewCorrectionRate,
      counts.routingReviewCorrected,
      counts.routingReviewConfirmed + counts.routingReviewCorrected
    ) ||
    summaryInput.pricingComplete !== (counts.aiSuccesses > 0 && counts.pricedRuns === counts.aiSuccesses)
  ) return null;

  if (root.outcomes.length > AGENT_RUNTIME_OUTCOMES.length) return null;
  const outcomeNames = new Set<string>();
  const outcomes: AgentMetricsPayload["outcomes"] = [];
  for (const input of root.outcomes) {
    const row = exactRecord(input, ["outcome", "count"]);
    const count = row ? integer(row.count) : null;
    if (
      !row || typeof row.outcome !== "string" ||
      !AGENT_RUNTIME_OUTCOMES.includes(row.outcome as AgentRuntimeOutcome) ||
      count === null || outcomeNames.has(row.outcome)
    ) return null;
    outcomeNames.add(row.outcome);
    outcomes.push({ outcome: row.outcome as AgentRuntimeOutcome, count });
  }
  if (outcomes.reduce((sum, entry) => sum + entry.count, 0) !== counts.total) return null;

  if (root.daily.length > root.days + 1) return null;
  const dates = new Set<string>();
  const daily: AgentMetricsPayload["daily"] = [];
  for (const input of root.daily) {
    const row = exactRecord(input, ["date", "total", "aiSuccesses", "averageLatencyMs"]);
    const total = row ? integer(row.total) : null;
    const aiSuccesses = row ? integer(row.aiSuccesses) : null;
    const averageLatencyMs = row ? integer(row.averageLatencyMs, 120_000) : null;
    if (
      !row || typeof row.date !== "string" || !DATE_PATTERN.test(row.date) ||
      !Number.isFinite(Date.parse(`${row.date}T00:00:00.000Z`)) || dates.has(row.date) ||
      total === null || aiSuccesses === null || aiSuccesses > total || averageLatencyMs === null
    ) return null;
    dates.add(row.date);
    daily.push({ date: row.date, total, aiSuccesses, averageLatencyMs });
  }
  if (daily.reduce((sum, entry) => sum + entry.total, 0) !== counts.total) return null;

  return {
    generatedAt,
    days: root.days,
    summary: {
      ...counts,
      pricingConfigured: summaryInput.pricingConfigured,
      pricingComplete: summaryInput.pricingComplete,
      routingCorrectionRate,
      routingReviewCompletionRate,
      routingReviewCorrectionRate,
    },
    outcomes,
    daily,
  };
}
