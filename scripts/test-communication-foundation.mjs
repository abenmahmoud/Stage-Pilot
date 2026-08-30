import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260830053500_create_private_communications_foundation.sql", import.meta.url),
  "utf8"
);
const switches = readFileSync(
  new URL("../supabase/migrations/20260830054500_enforce_communication_kill_switches.sql", import.meta.url),
  "utf8"
);
const approvalGate = readFileSync(
  new URL("../supabase/migrations/20260830055500_require_approved_communication_work.sql", import.meta.url),
  "utf8"
);
const scopeGuard = readFileSync(
  new URL("../supabase/migrations/20260830060500_harden_communication_scope.sql", import.meta.url),
  "utf8"
);
const foreignKeyIndexes = readFileSync(
  new URL("../supabase/migrations/20260830061500_index_communication_foreign_keys.sql", import.meta.url),
  "utf8"
);
const schema = readFileSync(new URL("../db/schema.ts", import.meta.url), "utf8");

const tables = [
  "communication_settings",
  "communications",
  "communication_versions",
  "communication_audiences",
  "communication_deliveries",
  "communication_jobs",
  "communication_inbound",
  "communication_events",
];

test("creates every private communication table with forced RLS", () => {
  for (const table of tables) {
    assert.match(migration, new RegExp(`create table public\\.${table} \\(`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`));
    assert.match(migration, new RegExp(`alter table public\\.${table} force row level security;`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated;`));
  }
});

test("fails closed at database level and keeps publication separate from sending", () => {
  assert.match(migration, /module_enabled boolean not null default false/);
  assert.match(migration, /publication_enabled boolean not null default false/);
  assert.match(migration, /sending_enabled boolean not null default false/);
  assert.match(migration, /module_enabled or \(not publication_enabled and not sending_enabled\)/);
});

test("uses opaque audiences and contact references without address columns", () => {
  assert.match(migration, /position\('@' in group_ref\) = 0/);
  assert.match(migration, /position\('@' in contact_ref\) = 0/);
  assert.doesNotMatch(migration, /recipient_email|email_address|contact_email/);
  assert.match(migration, /unique \(communication_id, group_ref\)/);
  assert.doesNotMatch(migration, /grant delete on table public\.communication_audiences/);
});

test("binds children to the same institution and version", () => {
  const scopeBindings = migration.match(/foreign key \(communication_id, institution_id\)/g) ?? [];
  assert.ok(scopeBindings.length >= 6);
  assert.match(migration, /foreign key \(version_id, institution_id, communication_id, version\)/);
  assert.match(migration, /references public\.communication_versions\(id, institution_id, communication_id, version\)/);
});

test("makes versions immutable after validation and events append-only", () => {
  assert.match(migration, /old\.status in \('approved', 'published', 'superseded'\)/);
  assert.match(migration, /Communication events are append-only/);
  assert.match(migration, /before update or delete on public\.communication_events/);
  assert.doesNotMatch(migration, /grant update.*communication_events/);
  assert.doesNotMatch(migration, /grant delete.*communication_events/);
});

test("provides durable idempotent jobs and deliveries without message bodies", () => {
  const idempotencyConstraints = migration.match(/unique \(institution_id, idempotency_key_hash\)/g) ?? [];
  assert.equal(idempotencyConstraints.length, 2);
  assert.match(migration, /status in \('pending', 'running', 'retry', 'completed', 'dead', 'cancelled'\)/);
  assert.match(migration, /communication_jobs_claim_idx/);
  assert.doesNotMatch(migration, /message_body|body_text|email_html/);
});

test("enforces kill switches again inside the database", () => {
  assert.match(switches, /Communication publication is disabled/);
  assert.match(switches, /Communication sending is disabled/);
  assert.match(switches, /Communication module is disabled/);
  assert.match(switches, /before update on public\.communications/);
  assert.match(switches, /before insert or update on public\.communication_deliveries/);
  assert.match(switches, /before insert or update on public\.communication_jobs/);
  assert.match(switches, /for key share/);
});

test("creates deliveries and operational jobs only from an approved version", () => {
  assert.match(approvalGate, /Communication delivery requires an approved version/);
  assert.match(approvalGate, /Communication job requires an approved version/);
  assert.match(approvalGate, /version\.institution_id = new\.institution_id/);
  assert.match(approvalGate, /version\.communication_id = new\.communication_id/);
  assert.match(approvalGate, /for key share of communication, version/);
});

test("freezes audiences after validation and technical work identities after insertion", () => {
  assert.match(scopeGuard, /Validated communication audiences are immutable/);
  assert.match(scopeGuard, /communication_status not in \('draft', 'review'\)/);
  assert.match(scopeGuard, /Communication delivery identity is immutable/);
  assert.match(scopeGuard, /Communication job identity is immutable/);
  assert.match(scopeGuard, /new\.idempotency_key_hash <> old\.idempotency_key_hash/);
  assert.match(scopeGuard, /before insert or update or delete on public\.communication_audiences/);
});

test("indexes every composite communication foreign key in its declared order", () => {
  for (const columns of [
    "communication_id, institution_id",
    "version_id, institution_id, communication_id, version",
    "delivery_id, institution_id",
  ]) {
    assert.match(foreignKeyIndexes, new RegExp(`\\(${columns}\\)`));
  }
  assert.match(foreignKeyIndexes, /communication_settings \(updated_by\)/);
  assert.match(foreignKeyIndexes, /communication_events \(communication_id, institution_id\)/);
});

test("keeps the Drizzle model aligned with every table", () => {
  for (const exported of [
    "communicationSettings",
    "communications",
    "communicationVersions",
    "communicationAudiences",
    "communicationDeliveries",
    "communicationJobs",
    "communicationInbound",
    "communicationEvents",
  ]) {
    assert.match(schema, new RegExp(`export const ${exported} = pgTable`));
  }
});
