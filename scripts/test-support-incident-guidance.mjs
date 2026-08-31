import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildSupportIncidentGuidance } from "../shared/support-incident-guidance.ts";

function payload(overrides = {}) {
  const summary = {
    failuresWaiting: 0,
    jobSuccesses24h: 12,
    jobFailures24h: 0,
    webhookAlerts24h: 0,
    deliveryAlerts24h: 0,
    attachmentsWaiting: 0,
    attachmentRemovalsWaiting: 0,
    lastSuccessAt: "2026-08-31T08:55:00.000Z",
    ...overrides,
  };
  return {
    generatedAt: "2026-08-31T09:00:00.000Z",
    summary,
    activity30d: {
      created: 1,
      resolved: 1,
      resolutionRate: 100,
      openBacklog: 0,
      averageResolutionHours: 1,
      p90ResolutionHours: 1,
      categories: [{ category: "ent", count: 1 }],
    },
    failures: [{
      id: "9c7032e1-2607-4bc3-a99c-8d93371d6ddf",
      jobType: "send_requester_reply",
      attempts: 5,
      lastErrorCode: "provider_unavailable",
      lastErrorSummary: "Texte privé à exclure",
      failedAt: "2026-08-31T08:30:00.000Z",
      publicCode: "BC-2026-000042",
      subject: "Objet privé à exclure",
    }],
  };
}

test("returns one quiet monitoring step when all technical signals are nominal", () => {
  const guidance = buildSupportIncidentGuidance(payload());
  assert.equal(guidance.state, "nominal");
  assert.equal(guidance.title, "Surveillance nominale");
  assert.deepEqual(guidance.steps.map((step) => step.id), ["monitor"]);
  assert.match(guidance.technicalReport, /État : nominal/);
});

test("builds only the steps corresponding to active technical signals", () => {
  const guidance = buildSupportIncidentGuidance(payload({
    failuresWaiting: 2,
    jobFailures24h: 3,
    webhookAlerts24h: 1,
    deliveryAlerts24h: 2,
    attachmentsWaiting: 4,
    attachmentRemovalsWaiting: 1,
  }));
  assert.equal(guidance.state, "attention");
  assert.deepEqual(guidance.steps.map((step) => step.id), [
    "failed_jobs",
    "email_chain",
    "attachment_scan",
    "attachment_removal",
    "preserve",
  ]);
  assert.match(guidance.description, /Aucune réparation automatique/);
});

test("keeps the copied incident report aggregate, bounded and free of dossier data", () => {
  const guidance = buildSupportIncidentGuidance(payload({ failuresWaiting: 1 }));
  assert.match(guidance.technicalReport, /Échecs en attente : 1/);
  assert.match(guidance.technicalReport, /ni identité, ni numéro de dossier/);
  assert.doesNotMatch(guidance.technicalReport, /BC-2026-000042/);
  assert.doesNotMatch(guidance.technicalReport, /Objet privé|Texte privé|provider_unavailable/);
  assert.ok(guidance.technicalReport.length < 1_000);
});

test("integrates guidance after payload validation and confirms copy only after success", async () => {
  const page = await readFile(
    new URL("../src/pages/admin/SupportOperationsPage.tsx", import.meta.url),
    "utf8"
  );
  const validation = page.indexOf("parseSupportOperationsPayload(operations.value)");
  const guidance = page.indexOf("buildSupportIncidentGuidance(payload)");
  const write = page.indexOf("await navigator.clipboard.writeText(report)");
  const success = page.indexOf('setIncidentCopyStatus("success")');
  assert.ok(validation >= 0 && validation < guidance);
  assert.ok(write >= 0 && write < success);
  assert.match(page, /aria-labelledby="incident-guidance-title"/);
  assert.match(page, /Il n’envoie aucune alerte/);
  assert.match(page, /role="alert"/);
  assert.match(page, /role="status"/);
});
