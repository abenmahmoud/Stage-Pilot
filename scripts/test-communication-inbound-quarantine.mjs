import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL(
  "../supabase/migrations/20260901133000_create_communication_inbound_quarantine.sql",
  import.meta.url
), "utf8");
const hardeningMigration = readFileSync(new URL(
  "../supabase/migrations/20260901160000_harden_communication_inbound_quarantine.sql",
  import.meta.url
), "utf8");
const summaryFixMigration = readFileSync(new URL(
  "../supabase/migrations/20260901161000_fix_communication_inbound_summary_validator.sql",
  import.meta.url
), "utf8");
const recipe = readFileSync(new URL(
  "../supabase/tests/communication_inbound_quarantine_security.test.sql",
  import.meta.url
), "utf8");
const schema = readFileSync(new URL("../db/schema.ts", import.meta.url), "utf8");
const route = readFileSync(new URL(
  "../api/webhooks/brevo/communications-inbound.ts",
  import.meta.url
), "utf8");

test("creates opaque private objects without message or contact content", () => {
  assert.match(migration, /create table public\.communication_inbound_objects/);
  assert.match(migration, /object_ref_hash text not null/);
  assert.match(migration, /object_kind in \('message_body', 'attachment'\)/);
  assert.match(migration, /size_bytes between 1 and 10485760/);
  assert.doesNotMatch(migration, /original_name|sender_email|recipient_email|subject text|body text|download_token/);
});

test("enforces quarantine, clean proof and an immutable lifecycle", () => {
  assert.match(migration, /communication_inbound_object_must_start_reserved/);
  assert.match(migration, /communication_inbound_object_clean_proof_required/);
  assert.match(migration, /invalid_communication_inbound_object_transition/);
  assert.match(migration, /scan_detail = 'clamav_clean'/);
  assert.match(migration, /sha256 ~ '\^\[a-f0-9\]\{64\}\$'/);
  assert.match(migration, /communication_inbound_object_events_append_only_trigger/);
  assert.match(hardeningMigration, /communication_inbound_object_proof_immutable/);
  assert.match(hardeningMigration, /old\.status = new\.status/);
  assert.match(hardeningMigration, /communication_inbound_object_event_state_mismatch/);
});

test("accepts only exact bounded machine summaries in the audit", () => {
  assert.match(summaryFixMigration, /pg_column_size\(summary_value\) > 1024/);
  assert.match(summaryFixMigration, /pg_catalog\.jsonb_object_keys\(summary_value\)/);
  assert.doesNotMatch(summaryFixMigration, /jsonb_object_length/);
  assert.match(summaryFixMigration, /summary_value = '\{"scan":"pending"\}'::jsonb/);
  assert.match(summaryFixMigration, /summary_value = '\{"antivirus":"clamav_clean"\}'::jsonb/);
  assert.match(hardeningMigration, /communication_inbound_object_events_summary_safe_check/);
  assert.doesNotMatch(summaryFixMigration, /sender|recipient|subject|download_token|original_name/);
});

test("keeps both storage buckets and the scan queue private", () => {
  assert.match(migration, /'communication-inbound-quarantine'[\s\S]*false/);
  assert.match(migration, /'communication-inbound-clean'[\s\S]*false/);
  assert.match(migration, /select pgmq\.create\('communication_inbound_scan'\)/);
  assert.match(migration, /alter table pgmq\.q_communication_inbound_scan force row level security/);
  assert.match(migration, /revoke all on table[\s\S]*pgmq\.q_communication_inbound_scan[\s\S]*from public, anon, authenticated/);
});

test("mirrors the private object model in Drizzle", () => {
  assert.match(schema, /export const communicationInboundObjects = pgTable/);
  assert.match(schema, /"communication_inbound_objects"/);
  assert.match(schema, /objectRefHash: text\("object_ref_hash"\)\.notNull\(\)/);
  assert.match(schema, /storageBucket: text\("storage_bucket"\)\.notNull\(\)\.default\("communication-inbound-quarantine"\)/);
  assert.match(schema, /export const communicationInboundObjectEvents = pgTable/);
  assert.match(schema, /communication_inbound_objects_scope_ref_uidx/);
});

test("keeps the live webhook closed and disconnected from storage", () => {
  assert.match(route, /communicationInboundWebhookEnabled\(\)/);
  assert.doesNotMatch(route, /communicationInboundObjects|communication-inbound-quarantine|communication_inbound_scan|storage\.from/);
});

test("proves the preview lifecycle, isolation and rollback with fixtures only", () => {
  assert.match(recipe, /^begin;/);
  assert.match(recipe, /clean_without_proof_blocked/);
  assert.match(recipe, /duplicate_ref_blocked/);
  assert.match(recipe, /cross_scope_blocked/);
  assert.match(recipe, /event_update_blocked/);
  assert.match(recipe, /clean_proof_rewrite_blocked/);
  assert.match(recipe, /unsafe_summary_blocked/);
  assert.match(recipe, /state_mismatch_event_blocked/);
  assert.match(recipe, /communication-inbound-clean/);
  assert.match(recipe, /rollback;[\s\S]*institution_residue[\s\S]*inbound_residue[\s\S]*object_residue[\s\S]*event_residue[\s\S]*queue_residue/);
  assert.doesNotMatch(recipe, /@ac-creteil\.fr|lycee-blaise-cendrars-sevran\.fr/);
});
