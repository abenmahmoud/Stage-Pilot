import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseAgentMetricsPayload,
  parseSupportOperationsPayload,
} from "../shared/support-operations-payload.ts";

const failure = {
  id: "9c7032e1-2607-4bc3-a99c-8d93371d6ddf",
  jobType: "send_requester_reply",
  attempts: 5,
  lastErrorCode: "provider_unavailable",
  lastErrorSummary: "Service de notification indisponible.",
  failedAt: "2026-08-31T08:30:00.000Z",
  publicCode: "BC-2026-000042",
  subject: "Accès au service numérique",
};

const operations = {
  generatedAt: "2026-08-31T09:00:00.000Z",
  summary: {
    failuresWaiting: 1,
    jobSuccesses24h: 18,
    jobFailures24h: 1,
    webhookAlerts24h: 0,
    deliveryAlerts24h: 1,
    attachmentsWaiting: 2,
    attachmentRemovalsWaiting: 0,
    lastSuccessAt: "2026-08-31T08:55:00.000Z",
  },
  activity30d: {
    created: 10,
    resolved: 8,
    resolutionRate: 80,
    openBacklog: 3,
    averageResolutionHours: 6,
    p90ResolutionHours: 14,
    categories: [
      { category: "ent", count: 6 },
      { category: "ordinateur", count: 4 },
    ],
  },
  failures: [failure],
};

const metrics = {
  generatedAt: "2026-08-31T09:00:00.000Z",
  days: 7,
  summary: {
    total: 3,
    aiAttempts: 2,
    aiSuccesses: 1,
    localOrFallback: 2,
    averageLatencyMs: 400,
    p95LatencyMs: 900,
    inputTokens: 200,
    outputTokens: 50,
    totalTokens: 250,
    estimatedCostMicros: 1000,
    pricedRuns: 1,
    pricingConfigured: true,
    pricingComplete: true,
    serviceChanges: 2,
    routingCorrections: 1,
    routingCorrectionRate: 50,
    routingReviewTotal: 3,
    routingReviewPending: 1,
    routingReviewConfirmed: 1,
    routingReviewCorrected: 1,
    routingReviewCompletionRate: 66.7,
    routingReviewCorrectionRate: 50,
  },
  outcomes: [
    { outcome: "deterministic", count: 2 },
    { outcome: "model_success", count: 1 },
  ],
  daily: [
    { date: "2026-08-30", total: 1, aiSuccesses: 0, averageLatencyMs: 100 },
    { date: "2026-08-31", total: 2, aiSuccesses: 1, averageLatencyMs: 550 },
  ],
};

test("accepts one complete bounded operations payload", () => {
  assert.deepEqual(parseSupportOperationsPayload(operations), operations);
});

test("rejects malformed or internally inconsistent operations data", () => {
  const invalid = [
    null,
    { ...operations, requesterEmail: "private@example.test" },
    { ...operations, generatedAt: "tomorrow" },
    { ...operations, summary: { ...operations.summary, failuresWaiting: -1 } },
    { ...operations, activity30d: { ...operations.activity30d, resolved: 11 } },
    { ...operations, activity30d: { ...operations.activity30d, resolutionRate: 81 } },
    { ...operations, activity30d: { ...operations.activity30d, categories: [
      { category: "ent", count: 6 }, { category: "ent", count: 4 },
    ] } },
    { ...operations, activity30d: { ...operations.activity30d, categories: [
      { category: "secret", count: 10 },
    ] } },
    { ...operations, failures: [{ ...failure, id: "not-a-uuid" }] },
    { ...operations, failures: [{ ...failure, jobType: "../../delete_request" }] },
    { ...operations, failures: [{ ...failure, subject: "x".repeat(201) }] },
    { ...operations, failures: [{ ...failure, subject: "Sujet\u0000caché" }] },
    { ...operations, summary: { ...operations.summary, failuresWaiting: 0 } },
    { ...operations, failures: Array.from({ length: 51 }, (_, index) => ({
      ...failure,
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    })) },
  ];
  for (const payload of invalid) assert.equal(parseSupportOperationsPayload(payload), null);
});

test("accepts one complete bounded metrics payload", () => {
  assert.deepEqual(parseAgentMetricsPayload(metrics), metrics);
});

test("keeps antivirus failures visible without offering an unsupported retry", async () => {
  const antivirusPayload = {
    ...operations,
    failures: [{ ...failure, jobType: "scan_attachment" }],
  };
  assert.deepEqual(parseSupportOperationsPayload(antivirusPayload), antivirusPayload);
  const page = await readFile(
    new URL("../src/pages/admin/SupportOperationsPage.tsx", import.meta.url),
    "utf8"
  );
  assert.match(page, /isSupportRetryableJobType\(job\.jobType\) \? \(/);
  assert.match(page, /Intervention manuelle/);
  assert.match(page, /ne peut pas être relancée ici/);
});

test("rejects contradictory totals, rates and unbounded metrics", () => {
  const invalid = [
    { ...metrics, conversation: "private" },
    { ...metrics, days: 14 },
    { ...metrics, summary: { ...metrics.summary, aiAttempts: 4 } },
    { ...metrics, summary: { ...metrics.summary, localOrFallback: 1 } },
    { ...metrics, summary: { ...metrics.summary, totalTokens: 249 } },
    { ...metrics, summary: { ...metrics.summary, routingCorrectionRate: 49.9 } },
    { ...metrics, summary: { ...metrics.summary, routingReviewPending: 2 } },
    { ...metrics, summary: { ...metrics.summary, pricingComplete: false } },
    { ...metrics, outcomes: [{ outcome: "unknown", count: 3 }] },
    { ...metrics, outcomes: [{ outcome: "deterministic", count: 3 }, { outcome: "deterministic", count: 0 }] },
    { ...metrics, outcomes: [{ outcome: "deterministic", count: 2 }] },
    { ...metrics, daily: [{ date: "2026-08-31", total: 2, aiSuccesses: 1, averageLatencyMs: 550 }] },
    { ...metrics, daily: [
      { date: "2026-08-31", total: 1, aiSuccesses: 0, averageLatencyMs: 100 },
      { date: "2026-08-31", total: 2, aiSuccesses: 1, averageLatencyMs: 550 },
    ] },
    { ...metrics, daily: [{ date: "31-08-2026", total: 3, aiSuccesses: 1, averageLatencyMs: 550 }] },
  ];
  for (const payload of invalid) assert.equal(parseAgentMetricsPayload(payload), null);
});

test("validates both API responses before replacing the protected view", async () => {
  const page = await readFile(
    new URL("../src/pages/admin/SupportOperationsPage.tsx", import.meta.url),
    "utf8"
  );
  assert.match(page, /apiFetch<unknown>\("support\/agent\/operations"\)/);
  assert.match(page, /apiFetch<unknown>\(`support\/agent\/metrics\?days=/);
  const operationsValidation = page.indexOf("parseSupportOperationsPayload(operations.value)");
  const operationsState = page.indexOf("setPayload(operationsPayload)");
  const metricsValidation = page.indexOf("parseAgentMetricsPayload(metrics.value)");
  const metricsState = page.indexOf("setAgentMetrics(metricsPayload)");
  assert.ok(operationsValidation >= 0 && operationsValidation < operationsState);
  assert.ok(metricsValidation >= 0 && metricsValidation < metricsState);
  assert.match(page, /metricsPayload\.days !== metricsDays/);
});
