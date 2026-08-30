import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260829234312_create_agent_action_approval_foundation.sql",
  import.meta.url
);
const schemaUrl = new URL("../db/schema.ts", import.meta.url);
const privilegeMigrationUrl = new URL(
  "../supabase/migrations/20260829235446_restrict_agent_action_delete_privileges.sql",
  import.meta.url
);
const consumeFixMigrationUrl = new URL(
  "../supabase/migrations/20260829235635_fix_agent_consume_approval_ambiguity.sql",
  import.meta.url
);
const indexMigrationUrl = new URL(
  "../supabase/migrations/20260830000053_index_agent_action_foreign_keys.sql",
  import.meta.url
);
const expiryMigrationUrl = new URL(
  "../supabase/migrations/20260830000304_allow_agent_approval_expiry_transition.sql",
  import.meta.url
);

const [migration, privilegeMigration, consumeFixMigration, indexMigration, expiryMigration, schema] = await Promise.all([
  readFile(migrationUrl, "utf8"),
  readFile(privilegeMigrationUrl, "utf8"),
  readFile(consumeFixMigrationUrl, "utf8"),
  readFile(indexMigrationUrl, "utf8"),
  readFile(expiryMigrationUrl, "utf8"),
  readFile(schemaUrl, "utf8"),
]);

test("keeps action, approval and audit records server-only", () => {
  for (const table of ["agent_actions", "agent_approvals", "agent_action_audit"]) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`, "i")
    );
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} force row level security`, "i")
    );
  }
  assert.match(
    migration,
    /revoke all on table[\s\S]+agent_actions[\s\S]+agent_approvals[\s\S]+agent_action_audit[\s\S]+from public, anon, authenticated/i
  );
  assert.doesNotMatch(migration, /grant[\s\S]+to anon|grant[\s\S]+to authenticated/i);
  assert.match(
    privilegeMigration,
    /revoke all on table[\s\S]+agent_actions[\s\S]+agent_approvals[\s\S]+agent_action_audit[\s\S]+from service_role/i
  );
  assert.match(
    privilegeMigration,
    /grant select, insert, update on table[\s\S]+agent_actions[\s\S]+agent_approvals[\s\S]+to service_role/i
  );
  assert.match(
    privilegeMigration,
    /grant select, insert on table public\.agent_action_audit to service_role/i
  );
  assert.doesNotMatch(privilegeMigration, /grant[^;]*delete/i);
});

test("stores only bounded references, hashes and redacted action input", () => {
  assert.match(migration, /input_redacted jsonb not null/);
  assert.match(migration, /input_fingerprint text not null[\s\S]+\^\[a-f0-9\]\{64\}/);
  assert.match(migration, /idempotency_key_hash text not null/);
  assert.match(migration, /requester_ref_hash text not null/);
  assert.doesNotMatch(
    migration,
    /requester_(?:email|phone|name)|student_name|guardian_name|password|secret_value/i
  );
});

test("blocks A4 in the database and requires the correct initial state", () => {
  assert.match(migration, /authority_level in \('A0', 'A1', 'A2', 'A3'\)/);
  assert.doesNotMatch(migration, /authority_level in \([^)]*'A4'/);
  assert.match(
    migration,
    /new\.authority_level = 'A3' and new\.status <> 'awaiting_approval'/
  );
  assert.match(
    migration,
    /new\.authority_level <> 'A3' and new\.status <> 'planned'/
  );
});

test("binds one approval to the exact institution, action, tool, input and requester", () => {
  assert.match(
    migration,
    /unique \(\s*id,\s*institution_id,\s*tool_key,\s*input_fingerprint,\s*requested_by_user_id\s*\)/i
  );
  assert.match(
    migration,
    /foreign key \(\s*action_id,\s*institution_id,\s*tool_key,\s*input_fingerprint,\s*requested_by_user_id\s*\)[\s\S]+references public\.agent_actions/i
  );
  assert.match(migration, /unique \(action_id\)/);
  assert.match(migration, /decision_by_user_id <> requested_by_user_id/);
  assert.match(migration, /decision_role = requested_from_role/);
});

test("rejects expired, future, incomplete or reused approvals", () => {
  assert.match(migration, /expires_at > requested_at/);
  assert.match(migration, /new\.expires_at <= transaction_timestamp\(\)/);
  assert.match(migration, /locked_approval\.expires_at <= consumed_timestamp/);
  assert.match(migration, /locked_approval\.consumed_at is not null/);
  assert.match(migration, /executing_user_id is null/);
  assert.match(migration, /expected_tool_key is null/);
  assert.match(migration, /expected_input_fingerprint is null/);
  assert.match(
    expiryMigration,
    /old\.status = 'approved'[\s\S]+old\.consumed_at is null[\s\S]+new\.status in \('expired', 'cancelled'\)/
  );
  assert.match(
    expiryMigration,
    /new\.status = 'expired' and new\.expires_at > transaction_timestamp\(\)/
  );
});

test("consumes approval and starts the action atomically under row locks", () => {
  const actionLock = consumeFixMigration.indexOf("from public.agent_actions as action_record");
  const approvalLock = consumeFixMigration.indexOf("from public.agent_approvals as approval_record");
  const consumeUpdate = consumeFixMigration.indexOf("update public.agent_approvals as approval_record");
  const runUpdate = consumeFixMigration.indexOf("update public.agent_actions as action_record");

  assert.ok(actionLock >= 0, "the action row must be locked");
  assert.ok(approvalLock > actionLock, "the approval must be locked after the action");
  assert.ok(consumeUpdate > approvalLock, "the approval must be consumed after both locks");
  assert.ok(runUpdate > consumeUpdate, "the action starts only after consumption");
  assert.match(consumeFixMigration, /for update/);
  assert.match(consumeFixMigration, /locked_action\.status <> 'awaiting_approval'/);
  assert.match(migration, /A3 action requires a consumed approval/);
});

test("prevents replay by making action and approval terminal bindings immutable", () => {
  assert.match(migration, /Terminal agent action is immutable/);
  assert.match(migration, /Consumed approval is immutable/);
  assert.match(migration, /Agent action binding fields are immutable/);
  assert.match(migration, /Agent approval binding fields are immutable/);
  assert.match(migration, /Agent actions are append-only records/);
  assert.match(migration, /Agent approvals are append-only records/);
});

test("accepts success only with a current external confirmation", () => {
  assert.match(
    migration,
    /status = 'succeeded'[\s\S]+started_at is not null[\s\S]+confirmed_at is not null[\s\S]+confirmation_ref is not null[\s\S]+tool_result is not null/i
  );
  assert.match(migration, /confirmed_at >= requested_at/);
  assert.match(migration, /new\.confirmed_at > transaction_timestamp\(\)/);
  assert.match(migration, /status <> 'succeeded' and confirmed_at is null and confirmation_ref is null/);
});

test("writes an append-only audit for every sensitive transition", () => {
  for (const event of [
    "action_created",
    "approval_requested",
    "approval_approved",
    "approval_rejected",
    "approval_expired",
    "approval_cancelled",
    "approval_consumed",
    "action_started",
    "action_succeeded",
    "action_failed",
    "action_refused",
  ]) {
    assert.match(migration, new RegExp(`'${event}'`));
  }
  assert.match(migration, /Agent action audit is append-only/);
  assert.match(migration, /before update or delete on public\.agent_action_audit/);
});

test("exposes only the atomic invoker function to the server role", () => {
  assert.match(
    consumeFixMigration,
    /function public\.agent_consume_approval\([\s\S]+security invoker[\s\S]+set search_path = ''/i
  );
  assert.match(
    consumeFixMigration,
    /revoke all on function public\.agent_consume_approval\(uuid, uuid, uuid, text, text\)[\s\S]+from public, anon, authenticated/i
  );
  assert.match(
    consumeFixMigration,
    /grant execute on function public\.agent_consume_approval\(uuid, uuid, uuid, text, text\)[\s\S]+to service_role/i
  );
  assert.doesNotMatch(consumeFixMigration, /security definer/i);
  assert.doesNotMatch(
    consumeFixMigration,
    /from public\.agent_approvals\s+where\s+id = requested_approval_id/i
  );
});

test("keeps Drizzle models aligned with the migration", () => {
  assert.match(schema, /export const agentActions = pgTable/);
  assert.match(schema, /export const agentApprovals = pgTable/);
  assert.match(schema, /export const agentActionAudit = pgTable/);
  assert.match(schema, /authorityLevel: text\("authority_level"\)/);
  assert.match(schema, /confirmedAt: timestamp\("confirmed_at"/);
  assert.match(schema, /consumedAt: timestamp\("consumed_at"/);
});

test("covers every new foreign key used during deletes or audit lookups", () => {
  for (const indexName of [
    "agent_action_audit_action_created_idx",
    "agent_approvals_action_binding_fk_idx",
    "agent_actions_requested_by_user_fk_idx",
    "agent_approvals_requested_by_user_fk_idx",
    "agent_approvals_decision_by_user_fk_idx",
    "agent_action_audit_actor_user_fk_idx",
  ]) {
    assert.match(indexMigration, new RegExp(`create index ${indexName}`));
    assert.match(schema, new RegExp(`index\\(\"${indexName}\"\\)`));
  }
});
