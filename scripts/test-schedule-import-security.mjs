import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260829105141_create_schedule_import_foundation.sql", import.meta.url),
  "utf8"
);
const indexMigration = readFileSync(
  new URL("../supabase/migrations/20260829105238_index_schedule_audit_institution.sql", import.meta.url),
  "utf8"
);
const integrityMigration = readFileSync(
  new URL("../supabase/migrations/20260829105632_harden_schedule_scope_integrity.sql", import.meta.url),
  "utf8"
);
const reservation = readFileSync(
  new URL("../api/schedule/admin/imports/index.ts", import.meta.url),
  "utf8"
);
const confirmation = readFileSync(
  new URL("../api/schedule/admin/imports/[id]/confirm.ts", import.meta.url),
  "utf8"
);
const manager = readFileSync(
  new URL("../api/_shared/schedule-imports.ts", import.meta.url),
  "utf8"
);

test("keeps schedule tables and the PDF bucket private", () => {
  assert.match(migration, /schedule_source_versions enable row level security/i);
  assert.match(migration, /schedule_source_versions force row level security/i);
  assert.match(migration, /revoke all on table[\s\S]+from public, anon, authenticated/i);
  assert.match(migration, /'schedule-ingest'[\s\S]+false[\s\S]+application\/pdf/i);
  assert.match(migration, /size_bytes > 0 and size_bytes <= 52428800/i);
  assert.match(indexMigration, /schedule_audit \(institution_id, created_at desc\)/i);
});

test("requires direction access and live MFA for every schedule request", () => {
  assert.match(manager, /requireKnowledgeManager\(req, \{ publish: true \}\)/);
  assert.match(reservation, /requireScheduleManager\(req\)/);
  assert.match(confirmation, /requireScheduleManager\(req\)/);
});

test("allows only one active version per scope and school year", () => {
  assert.match(
    migration,
    /unique index schedule_source_versions_one_active_uidx[\s\S]+where status = 'active'/i
  );
  assert.match(migration, /approved_by is not null and approved_at is not null/i);
  assert.match(migration, /activated_by is not null and activated_at is not null/i);
});

test("uses opaque page references and a verified page index", () => {
  assert.match(migration, /subject_type in \('class', 'teacher'\)/i);
  assert.match(migration, /subject_ref ~ '\^\[A-Z0-9\]/i);
  assert.match(migration, /review_status in \('draft', 'verified', 'rejected'\)/i);
  assert.doesNotMatch(migration, /teacher_name|student_name|personal_email/i);
  assert.match(integrityMigration, /consecutive_school_year_check/i);
  assert.match(integrityMigration, /expected_kind = 'classes'[\s\S]+new\.subject_type <> 'class'/i);
  assert.match(integrityMigration, /expected_kind = 'teachers'[\s\S]+new\.subject_type <> 'teacher'/i);
  assert.match(integrityMigration, /revoke all on function[\s\S]+from public, anon, authenticated/i);
});

test("reserves a signed upload without exposing a permanent file URL", () => {
  assert.match(reservation, /createSignedUploadUrl\(storagePath\)/);
  assert.doesNotMatch(reservation, /getPublicUrl|publicUrl|createSignedUrl/);
  assert.match(reservation, /pg_advisory_xact_lock/);
});

test("confirms exact size and MIME but never activates the received PDF", () => {
  assert.match(confirmation, /uploadedSize !== source\.sizeBytes/);
  assert.match(confirmation, /uploadedMime !== source\.mimeType/);
  assert.match(confirmation, /status: "uploaded"/);
  assert.match(confirmation, /activation: "blocked"/);
  assert.doesNotMatch(confirmation, /status: "active"/);
});
