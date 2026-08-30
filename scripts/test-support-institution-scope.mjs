import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const schema = await source("db/schema.ts");
const migration = await source(
  "supabase/migrations/20260830020355_scope_support_requests_by_institution.sql"
);
const sharedAccess = await source("api/_shared/support.ts");
const agentAccess = await source("api/_shared/support-agent-access.ts");
const publicRequests = await source("api/support/requests/index.ts");
const publicMessages = await source("api/support/requests/[code]/messages.ts");
const agentList = await source("api/support/agent/requests/index.ts");
const agentDetail = await source("api/support/agent/requests/[code].ts");
const agentReply = await source("api/support/agent/requests/[code]/reply.ts");
const agentNotes = await source("api/support/agent/requests/[code]/notes.ts");
const agentCallbacks = await source("api/support/agent/requests/[code]/callbacks.ts");
const agentTranslate = await source("api/support/agent/requests/[code]/translate.ts");
const agentAttachment = await source("api/support/agent/attachments/[id].ts");
const inboundWebhook = await source("api/webhooks/brevo/inbound.ts");
const supportWorker = await source("api/cron/support-worker.ts");

test("makes the request institution mandatory and immutable", () => {
  assert.match(schema, /institutionId: uuid\("institution_id"\)[\s\S]*?\.notNull\(\)/);
  assert.match(
    migration,
    /support_requests backfill requires exactly one pilot or active institution/
  );
  assert.match(migration, /alter column institution_id set not null/);
  assert.match(migration, /foreign key \(institution_id\)[\s\S]*on delete restrict/);
  assert.match(migration, /support_requests_institution_immutable/);
  assert.match(migration, /support request institution is immutable/);
  assert.match(migration, /force row level security/);
});

test("scopes idempotency to the institution and request", () => {
  assert.match(schema, /support_requests_institution_idempotency_uidx/);
  assert.match(schema, /support_messages_request_idempotency_uidx/);
  assert.match(
    publicRequests,
    /target: \[supportRequests\.institutionId, supportRequests\.idempotencyKeyHash\]/
  );
  for (const route of [publicMessages, agentReply, agentNotes]) {
    assert.match(
      route,
      /target: \[supportMessages\.requestId, supportMessages\.clientIdempotencyKeyHash\]/
    );
  }
});

test("binds public creation and follow-up to the configured institution", () => {
  assert.match(publicRequests, /const institution = await requireConfiguredInstitution\(\)/);
  assert.match(publicRequests, /institutionId: institution\.id/);
  assert.match(publicRequests, /eq\(supportRequests\.institutionId, institution\.id\)/);
  assert.match(sharedAccess, /eq\(supportRequests\.institutionId, institution\.id\)/);
  assert.match(publicMessages, /eq\(supportRequests\.institutionId, access\.institutionId\)/);
});

test("returns the institution in every support agent context", () => {
  assert.match(agentAccess, /institutionId: string/);
  assert.match(agentAccess, /return \{ user, access, institutionId: institution\.id \}/);
});

test("scopes every request-facing agent route", () => {
  const routes = [
    agentList,
    agentDetail,
    agentReply,
    agentNotes,
    agentCallbacks,
    agentTranslate,
    agentAttachment,
  ];
  for (const route of routes) {
    assert.match(route, /institutionId/);
    assert.match(route, /supportRequests\.institutionId/);
  }
});

test("carries and verifies institution ownership through async email work", () => {
  assert.match(publicRequests, /'institution_id', \$\{institution\.id\}::uuid/);
  assert.match(publicMessages, /'institution_id', \$\{access\.institutionId\}::uuid/);
  assert.match(agentReply, /'institution_id', \$\{institutionId\}::uuid/);
  assert.match(inboundWebhook, /'institution_id', \$\{institution\.id\}::uuid/);
  assert.match(supportWorker, /job\.institution_id !== institutionId/);
  assert.match(supportWorker, /eq\(supportRequests\.institutionId, institutionId\)/);
});

test("fails closed while legacy technical tables remain single-institution", () => {
  assert.match(inboundWebhook, /assertLegacySingleInstitutionMode\(institution\.id\)/);
  assert.match(supportWorker, /assertLegacySingleInstitutionMode\(institution\.id\)/);
});
