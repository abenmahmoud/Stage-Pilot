import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const persistence = readFileSync(
  new URL("../api/_shared/communication-job-cancellation-persistence.ts", import.meta.url),
  "utf8"
);
const route = readFileSync(
  new URL("../api/communications/admin/jobs/[id]/cancel.ts", import.meta.url),
  "utf8"
);
const gate = readFileSync(new URL("../api/_shared/communications.ts", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260830130000_allow_communication_emergency_cancellation.sql", import.meta.url),
  "utf8"
);
const guardRepairMigration = readFileSync(
  new URL("../supabase/migrations/20260830160000_restore_communication_approval_guards.sql", import.meta.url),
  "utf8"
);
const previewRecipe = readFileSync(
  new URL("../supabase/tests/communication_job_recovery_security.test.sql", import.meta.url),
  "utf8"
);

test("keeps emergency cancellation available while switches are off", () => {
  assert.match(migration, /old\.status in \('prepared', 'queued', 'error'\)[\s\S]*new\.status = 'cancelled'[\s\S]*return new/);
  assert.match(migration, /old\.status in \('pending', 'retry'\)[\s\S]*new\.status = 'cancelled'[\s\S]*return new/);
  assert.match(migration, /Communication module is disabled/);
  assert.match(migration, /Communication sending is disabled/);
  assert.doesNotMatch(migration, /old\.status in \([^)]*running/);
});

test("preserves approval guards while adding emergency cancellation", () => {
  for (const sql of [migration, guardRepairMigration]) {
    assert.match(sql, /communication_status text/);
    assert.match(sql, /version_status text/);
    assert.match(sql, /Communication delivery requires an approved version/);
    assert.match(sql, /Communication job requires an approved version/);
    assert.match(sql, /for key share of communication, version/);
  }
});

test("requires direction MFA and explicit confirmation without the sending gate", () => {
  assert.match(gate, /export async function requireCommunicationDirection/);
  assert.match(gate, /const context = await requireSupportAgent\(req\);\s+await requireAal2\(req\)/);
  assert.match(route, /await requireCommunicationDirection\(req\)/);
  assert.match(route, /operatorConfirmedCancellation !== true/);
  assert.doesNotMatch(route, /requireCommunicationSender|sendingEnabled|COMMUNICATION_SENDING_ENABLED/);
});

test("locks job then delivery and updates only observed pre-send state", () => {
  assert.match(persistence, /\.from\(communicationJobs\)[\s\S]*\.for\("update"\)/);
  assert.match(persistence, /\.from\(communicationDeliveries\)[\s\S]*\.for\("update"\)/);
  assert.match(persistence, /eq\(communicationJobs\.status, job\.status\)/);
  assert.match(persistence, /decision\.deliveryAction === "cancel_pre_send_delivery"/);
  assert.match(persistence, /PRE_SEND_STATUSES\.has\(delivery\.status\)/);
  assert.match(persistence, /eq\(communicationDeliveries\.status, delivery\.status\)/);
});

test("preserves non-recallable delivery state and audits bounded metadata", () => {
  assert.match(persistence, /deliveryAction: decision\.deliveryAction/);
  assert.match(persistence, /eventType: "job\.cancelled"/);
  const returnBlock = persistence.match(/return \{\n    allowed: true,([\s\S]*?)\n  \};/)?.[1] ?? "";
  assert.match(returnBlock, /cancelled: true/);
  assert.doesNotMatch(returnBlock, /jobId|deliveryId|institutionId|contact|email/i);
});

test("keeps the preview recovery recipe transactional and residue-free", () => {
  assert.match(previewRecipe, /begin;[\s\S]*rollback;/);
  assert.match(previewRecipe, /draft_delivery_blocked/);
  assert.match(previewRecipe, /running_job_cancel_blocked/);
  assert.match(previewRecipe, /sent_delivery_cancel_blocked/);
  assert.match(previewRecipe, /on conflict do nothing/);
  assert.match(previewRecipe, /auth_residue[\s\S]*institution_residue[\s\S]*communication_residue[\s\S]*delivery_residue[\s\S]*job_residue[\s\S]*event_residue/);
});
