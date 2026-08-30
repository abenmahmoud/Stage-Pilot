import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260830024727_create_private_schedule_slots.sql", import.meta.url),
  "utf8"
);
const scopeIndex = await readFile(
  new URL("../supabase/migrations/20260830024928_index_schedule_slots_scope_foreign_key.sql", import.meta.url),
  "utf8"
);
const hardening = await readFile(
  new URL("../supabase/migrations/20260830025506_harden_schedule_slot_freshness.sql", import.meta.url),
  "utf8"
);
const reader = await readFile(
  new URL("../api/_shared/schedule-reader.ts", import.meta.url),
  "utf8"
);

test("keeps structured schedule slots private and institution-owned", () => {
  assert.match(migration, /create table public\.schedule_slots/i);
  assert.match(migration, /foreign key \(source_version_id, institution_id\)[\s\S]+schedule_source_versions\(id, institution_id\)/i);
  assert.match(migration, /schedule_slots enable row level security/i);
  assert.match(migration, /schedule_slots force row level security/i);
  assert.match(migration, /revoke all on table public\.schedule_slots from public, anon, authenticated/i);
  assert.match(scopeIndex, /schedule_slots \(source_version_id, institution_id\)/i);
});

test("requires reviewed slots and immutable activated sources", () => {
  assert.match(migration, /review_status in \('pending', 'approved', 'rejected'\)/i);
  assert.match(migration, /Activated schedule slots are immutable/);
  assert.match(migration, /ends_at > starts_at/);
  assert.match(migration, /status <> 'active' or fresh_until is not null/i);
  assert.match(hardening, /fresh_until::date >= effective_from/i);
  assert.match(hardening, /schedule_slots_source_identity_time_uidx/i);
});

test("bounds trusted scopes and filters both reads by institution", () => {
  assert.match(reader, /MAX_SCOPE_REFS = 40/);
  assert.match(reader, /normalize\("NFKC"\)/);
  assert.match(reader, /toUpperCase\(\)/);
  assert.match(reader, /Invalid trusted schedule scope/);
  const institutionFilters = reader.match(/eq\([\s\S]{0,80}institutionId, input\.scope\.institutionId\)/g) ?? [];
  assert.equal(institutionFilters.length, 2);
  assert.match(reader, /eq\(scheduleSlots\.reviewStatus, "approved"\)/);
  assert.match(reader, /\.limit\(100\)/);
});

test("returns the policy result without exposing a teacher reference", () => {
  assert.match(reader, /readNextAuthorizedCourse/);
  assert.doesNotMatch(reader, /course:\s*\{[\s\S]{0,500}teacherRef/);
  assert.match(reader, /changes: \[\]/);
});
