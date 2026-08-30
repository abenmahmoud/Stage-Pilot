import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const schema = await source("db/schema.ts");
const migration = await source(
  "supabase/migrations/20260830041544_scope_support_technical_tables_by_institution.sql"
);
const indexMigration = await source(
  "supabase/migrations/20260830041931_index_support_technical_scope_foreign_keys.sql"
);
const supportWorker = await source("api/cron/support-worker.ts");
const inboundWebhook = await source("api/webhooks/brevo/inbound.ts");
const deliveryWebhook = await source("api/webhooks/brevo/delivery.ts");
const operations = await source("api/support/agent/operations/index.ts");
const retry = await source("api/support/agent/operations/[id]/retry.ts");
const fileWorker = await source("workers/support-file-worker.mjs");
const emailWorker = await source("workers/support-email-worker.mjs");
const attachmentConfirm = await source("api/support/attachments/[id]/confirm.ts");

test("makes every support technical row institution-owned", () => {
  for (const table of [
    "supportJobRuns",
    "supportFailedJobs",
    "supportDeliveryEvents",
    "supportWebhookReceipts",
  ]) {
    assert.match(
      schema,
      new RegExp(`export const ${table}[\\s\\S]*?institutionId: uuid\\("institution_id"\\)[\\s\\S]*?\\.notNull\\(\\)`)
    );
  }
  assert.match(migration, /support_job_runs[\s\S]*alter column institution_id set not null/);
  assert.match(migration, /support_failed_jobs[\s\S]*alter column institution_id set not null/);
  assert.match(migration, /support_delivery_events[\s\S]*alter column institution_id set not null/);
  assert.match(migration, /support_webhook_receipts[\s\S]*alter column institution_id set not null/);
});

test("binds job rows to a request from the same institution", () => {
  assert.match(migration, /support_requests_id_institution_key/);
  assert.match(migration, /support_job_runs_request_institution_fkey/);
  assert.match(migration, /support_failed_jobs_request_institution_fkey/);
  assert.match(migration, /foreign key \(request_id, institution_id\)/);
  assert.match(indexMigration, /support_job_runs_request_institution_idx/);
  assert.match(indexMigration, /support_failed_jobs_request_institution_idx/);
});

test("makes technical idempotency local to the institution", () => {
  assert.match(migration, /support_job_runs_institution_job_attempt_uidx/);
  assert.match(migration, /support_failed_jobs_institution_job_uidx/);
  assert.match(migration, /support_delivery_events_institution_provider_uidx/);
  assert.match(migration, /support_webhook_receipts_institution_provider_uidx/);
  assert.match(
    inboundWebhook,
    /on conflict \(institution_id, provider, external_id, payload_hash\)/
  );
});

test("prevents institution reassignment and cross-institution delivery events", () => {
  assert.match(migration, /support_prevent_technical_institution_change/);
  assert.match(migration, /support technical institution is immutable/);
  assert.match(migration, /support_assert_delivery_event_institution/);
  assert.match(migration, /support delivery event institution mismatch/);
  assert.match(migration, /force row level security/g);
});

test("persists and checks institution ownership in workers and webhooks", () => {
  assert.match(supportWorker, /institutionId,/);
  assert.match(supportWorker, /eq\(supportJobRuns\.institutionId, institutionId\)/);
  assert.match(inboundWebhook, /institutionId: institution\.id/);
  assert.match(inboundWebhook, /'institution_id', \$\{institution\.id\}::uuid/);
  assert.match(deliveryWebhook, /eq\(supportRequests\.institutionId, institution\.id\)/);
  assert.match(deliveryWebhook, /institutionId: institution\.id/);
  assert.match(attachmentConfirm, /'institution_id', \$\{access\.institutionId\}::uuid/);
  assert.match(fileWorker, /!job\?\.institution_id/);
  assert.match(fileWorker, /request\.institution_id = \$\{job\.institution_id\}/);
  assert.match(
    fileWorker,
    /on conflict \(institution_id, job_id, attempt\) do nothing/
  );
  assert.match(fileWorker, /on conflict \(institution_id, job_id\) do nothing/);
  assert.match(emailWorker, /shared_support_queue_requires_one_active_institution/);
  assert.match(emailWorker, /job\.institution_id !== institutionId/);
  assert.match(
    emailWorker,
    /on conflict \(institution_id, job_id, attempt\) do nothing/
  );
});

test("scopes operations and retry claims directly to the institution", () => {
  assert.match(
    operations,
    /eq\(supportWebhookReceipts\.institutionId, context\.institutionId\)/
  );
  assert.match(retry, /eq\(supportFailedJobs\.institutionId, context\.institutionId\)/);
  assert.doesNotMatch(operations, /assertLegacySingleInstitutionMode/);
});
