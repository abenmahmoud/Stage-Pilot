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
const queueMigration = readFileSync(
  new URL("../supabase/migrations/20260829112115_create_schedule_document_scan_queue.sql", import.meta.url),
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
const pagesApi = readFileSync(
  new URL("../api/schedule/admin/imports/[id]/pages/index.ts", import.meta.url),
  "utf8"
);
const verifyApi = readFileSync(
  new URL("../api/schedule/admin/imports/[id]/pages/[pageId]/verify.ts", import.meta.url),
  "utf8"
);
const fileApi = readFileSync(
  new URL("../api/schedule/admin/imports/[id]/file.ts", import.meta.url),
  "utf8"
);
const pageFileApi = readFileSync(
  new URL("../api/schedule/admin/imports/[id]/pages/[pageId]/file.ts", import.meta.url),
  "utf8"
);
const reviewBoundsMigration = readFileSync(
  new URL("../supabase/migrations/20260829113248_enforce_schedule_page_review_bounds.sql", import.meta.url),
  "utf8"
);
const promotionMigration = readFileSync(
  new URL("../supabase/migrations/20260829114151_enforce_schedule_promotion_integrity.sql", import.meta.url),
  "utf8"
);
const validationSummaryMigration = readFileSync(
  new URL("../supabase/migrations/20260829114935_harden_schedule_validation_summary.sql", import.meta.url),
  "utf8"
);
const pageAssetMigration = readFileSync(
  new URL("../supabase/migrations/20260901080000_create_private_schedule_page_assets.sql", import.meta.url),
  "utf8"
);
const approveApi = readFileSync(
  new URL("../api/schedule/admin/imports/[id]/approve.ts", import.meta.url),
  "utf8"
);
const activateApi = readFileSync(
  new URL("../api/schedule/admin/imports/[id]/activate.ts", import.meta.url),
  "utf8"
);
const rollbackApi = readFileSync(
  new URL("../api/schedule/admin/imports/[id]/rollback.ts", import.meta.url),
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
  assert.match(confirmation, /status: "quarantined"/);
  assert.match(confirmation, /pgmq\.send\([\s\S]+'schedule_document_scan'/);
  assert.match(confirmation, /activation: "blocked"/);
  assert.doesNotMatch(confirmation, /status: "active"/);
});

test("keeps the schedule scan queue private", () => {
  assert.match(queueMigration, /pgmq\.create\('schedule_document_scan'\)/);
  assert.match(queueMigration, /q_schedule_document_scan enable row level security/i);
  assert.match(queueMigration, /q_schedule_document_scan force row level security/i);
  assert.match(
    queueMigration,
    /revoke all on table[\s\S]+q_schedule_document_scan[\s\S]+from public, anon, authenticated/i
  );
});

test("limits page mapping to a scanned source under human review", () => {
  assert.match(pagesApi, /requireScheduleManager\(req\)/);
  assert.match(pagesApi, /source\.status !== "review"/);
  assert.match(pagesApi, /input\.pageNumber > source\.pageCount/);
  assert.match(pagesApi, /source\.sourceKind === "classes" \? "class" : "teacher"/);
  assert.match(pagesApi, /reviewStatus: "draft"/);
  assert.doesNotMatch(pagesApi, /teacherName|studentName|personalEmail/);
  assert.match(reviewBoundsMigration, /source_status <> 'review'/);
  assert.match(reviewBoundsMigration, /new\.page_number > expected_page_count/);
});

test("verifies pages through a distinct audited action", () => {
  assert.match(verifyApi, /requireScheduleManager\(req\)/);
  assert.match(verifyApi, /page\.sourceStatus !== "review"/);
  assert.match(verifyApi, /reviewStatus: "verified"/);
  assert.match(verifyApi, /action: "verify_page"/);
});

test("opens only validated private PDFs with a short audited URL", () => {
  assert.match(fileApi, /requireScheduleManager\(req\)/);
  assert.match(fileApi, /createSignedUrl\(source\.storagePath, SCHEDULE_SIGNED_URL_SECONDS\)/);
  assert.match(fileApi, /SCHEDULE_SIGNED_URL_SECONDS/);
  assert.match(fileApi, /action: "open_page"/);
  assert.match(fileApi, /Cache-Control", "no-store"/);
  assert.doesNotMatch(fileApi, /getPublicUrl|publicUrl/);
});

test("serves only a generated verified page under direction MFA", () => {
  assert.match(pageAssetMigration, /schedule_page_assets enable row level security/i);
  assert.match(pageAssetMigration, /schedule_page_assets force row level security/i);
  assert.match(
    pageAssetMigration,
    /revoke all on table public\.schedule_page_assets from public, anon, authenticated/i
  );
  assert.match(pageAssetMigration, /pageAssetsVerified'\) is distinct from 'true'/i);
  assert.match(pageAssetMigration, /Every schedule page must have a private page asset/i);
  assert.match(pageAssetMigration, /immutable outside processing/i);
  assert.match(pageAssetMigration, /storage_path <> expected_path/i);
  assert.match(pageFileApi, /requireScheduleManager\(req\)/);
  assert.match(pageFileApi, /schedulePageIndexes\.reviewStatus, "verified"/);
  assert.match(pageFileApi, /isExpectedSchedulePageAssetPath/);
  assert.match(pageFileApi, /createSignedUrl\(page\.storagePath, SCHEDULE_SIGNED_URL_SECONDS\)/);
  assert.match(pageFileApi, /scope: "single_page"/);
  assert.match(pageFileApi, /Cache-Control", "no-store"/);
  assert.doesNotMatch(pageFileApi, /scheduleSourceVersions\.storagePath|getPublicUrl|publicUrl/);
});

test("locks mapping and approval against concurrent edits", () => {
  assert.match(pagesApi, /pg_advisory_xact_lock\(hashtextextended\(\$\{id\}::text, 61744\)\)/);
  assert.match(verifyApi, /pg_advisory_xact_lock\(hashtextextended\(\$\{id\}::text, 61744\)\)/);
  assert.match(approveApi, /pg_advisory_xact_lock\(hashtextextended\(\$\{id\}::text, 61744\)\)/);
});

test("requires a clean complete page index before approval", () => {
  assert.match(approveApi, /validation\.securityScan !== "clean"/);
  assert.match(approveApi, /validation\.pageCountVerified !== true/);
  assert.match(approveApi, /count\(\*\) filter/);
  assert.match(approveApi, /action: "approve"/);
  assert.match(promotionMigration, /Every schedule page must be mapped and verified/);
  assert.match(promotionMigration, /Schedule document validation is incomplete/);
  assert.match(validationSummaryMigration, /securityScan'\) is distinct from 'clean'/i);
  assert.match(validationSummaryMigration, /pageCountVerified'\) is distinct from 'true'/i);
});

test("activates one version per scope in an audited transaction", () => {
  assert.match(activateApi, /parseSchedulePromotionInput\(req\.body, "ACTIVER"\)/);
  assert.match(activateApi, /pg_advisory_xact_lock/);
  assert.match(activateApi, /status: "superseded"/);
  assert.match(activateApi, /activatedBy: context\.user\.id/);
  assert.match(activateApi, /action: "activate"/);
});

test("restores only a superseded version with an explicit audit", () => {
  assert.match(rollbackApi, /parseSchedulePromotionInput\(req\.body, "RESTAURER"\)/);
  assert.match(rollbackApi, /candidate\.status !== "superseded"/);
  assert.match(rollbackApi, /action: "rollback"/);
  assert.match(promotionMigration, /'rollback'/);
});
