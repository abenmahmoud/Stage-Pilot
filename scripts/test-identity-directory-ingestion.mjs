import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  IDENTITY_DIRECTORY_MAX_BYTES,
  identityDirectoryMime,
  parseIdentityDirectoryInput,
} from "../shared/identity-directory-input.ts";
import { identityDirectoryStoragePath } from "../api/_shared/identity-directory-path.ts";

const migrationPath = new URL(
  "../supabase/migrations/20260828212703_create_identity_directory_intake.sql",
  import.meta.url
);
const quarantineMigrationPath = new URL(
  "../supabase/migrations/20260828220614_create_identity_directory_quarantine_rows.sql",
  import.meta.url
);
const reservePath = new URL("../api/identity/admin/imports/index.ts", import.meta.url);
const confirmPath = new URL(
  "../api/identity/admin/imports/[id]/confirm.ts",
  import.meta.url
);
const reportPath = new URL(
  "../api/identity/admin/imports/[id]/report.ts",
  import.meta.url
);
const approvePath = new URL(
  "../api/identity/admin/imports/[id]/approve.ts",
  import.meta.url
);
const activatePath = new URL(
  "../api/identity/admin/imports/[id]/activate.ts",
  import.meta.url
);
const viewPath = new URL(
  "../api/_shared/identity-directory-view.ts",
  import.meta.url
);

function validInput(overrides = {}) {
  return {
    title: "Répertoire fictif 2026-2027",
    purposeDescription:
      "Jeu fictif destiné uniquement à vérifier les identités et les relations autorisées.",
    sourceType: "official_export",
    originalName: "repertoire-fictif.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sizeBytes: 2 * 1024 * 1024,
    ...overrides,
  };
}

test("accepts only bounded CSV and XLSX directory files", () => {
  assert.equal(parseIdentityDirectoryInput(validInput()).sourceType, "official_export");
  assert.equal(identityDirectoryMime("liste.csv", "application/octet-stream"), "text/csv");
  assert.throws(
    () => parseIdentityDirectoryInput(validInput({ originalName: "liste.pdf", mimeType: "application/pdf" })),
    /Format du fichier/
  );
  assert.throws(
    () => parseIdentityDirectoryInput(validInput({ sizeBytes: IDENTITY_DIRECTORY_MAX_BYTES + 1 })),
    /50 Mo/
  );
});

test("uses opaque institution and actor scoped paths", () => {
  const path = identityDirectoryStoragePath(
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "Liste élèves et parents.xlsx"
  );
  assert.match(
    path,
    /^11111111-1111-4111-8111-111111111111\/22222222-2222-4222-8222-222222222222\/\d{4}\/\d{2}\/[0-9a-f-]+\.xlsx$/
  );
  assert.doesNotMatch(path, /élèves|parents|liste/i);
});

test("keeps identity, contact and relationship tables server-only", async () => {
  const sql = (await readFile(migrationPath, "utf8")).toLowerCase();
  for (const table of [
    "identity_directory_imports",
    "contact_verifications",
    "school_identities",
    "school_relationships",
    "identity_directory_audit",
  ]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`alter table public\\.${table} force row level security`));
  }
  assert.match(sql, /from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant\s+.+\s+to\s+(anon|authenticated)/s);
  assert.match(sql, /'identity-ingest',[\s\S]+false,[\s\S]+52428800/);
});

test("does not promote a contact verification into school identity", async () => {
  const sql = (await readFile(migrationPath, "utf8")).toLowerCase();
  assert.match(sql, /assurance_level in \('directory_matched', 'official_sso'\)/);
  assert.doesNotMatch(sql, /assurance_level in \([^)]*contact_verified/);
  assert.match(sql, /official_person_ref[\s\S]+source_import_id/);
  assert.match(sql, /num_nonnulls\(user_id, support_session_id\) = 1/);
});

test("requires MFA, signed upload and explicit confirmation", async () => {
  const [reserve, confirm] = await Promise.all([
    readFile(reservePath, "utf8"),
    readFile(confirmPath, "utf8"),
  ]);
  assert.match(reserve, /requireIdentityDirectoryManager\(req\)/);
  assert.match(reserve, /createSignedUploadUrl\(storagePath\)/);
  assert.match(reserve, /status: "reserved"/);
  assert.doesNotMatch(reserve, /schoolIdentities|schoolRelationships/);
  assert.match(confirm, /inArray\(identityDirectoryImports\.status, \["reserved", "uploaded"\]\)/);
  assert.match(confirm, /status: "quarantined"/);
  assert.match(confirm, /pgmq\.send\(/);
  assert.match(confirm, /'identity_directory_scan'/);
  assert.doesNotMatch(confirm, /status: "active"/);
});

test("keeps parsed rows private and stores only keyed contact fingerprints", async () => {
  const sql = (await readFile(quarantineMigrationPath, "utf8")).toLowerCase();
  assert.match(sql, /create table public\.identity_directory_rows/);
  assert.match(sql, /alter table public\.identity_directory_rows enable row level security/);
  assert.match(sql, /alter table public\.identity_directory_rows force row level security/);
  assert.match(sql, /academic_email_hash text/);
  assert.match(sql, /personal_email_hash text/);
  assert.match(sql, /phone_hash text/);
  assert.doesNotMatch(sql, /academic_email text/);
  assert.doesNotMatch(sql, /personal_email text/);
  assert.doesNotMatch(sql, /phone text/);
  assert.match(sql, /revoke all on table public\.identity_directory_rows from public, anon, authenticated/);
});

test("exposes only a redacted report and requires MFA lifecycle actions", async () => {
  const [report, approve, activate, view] = await Promise.all([
    readFile(reportPath, "utf8"),
    readFile(approvePath, "utf8"),
    readFile(activatePath, "utf8"),
    readFile(viewPath, "utf8"),
  ]);
  for (const source of [report, approve, activate]) {
    assert.match(source, /requireIdentityDirectoryManager\(req\)/);
  }
  assert.doesNotMatch(report, /academicEmailHash:/);
  assert.doesNotMatch(report, /personalEmailHash:/);
  assert.doesNotMatch(report, /phoneHash:/);
  assert.match(approve, /candidate\.rejectedRowCount !== 0/);
  assert.match(approve, /status: "approved"/);
  assert.match(activate, /confirmation !== "ACTIVER"/);
  assert.match(activate, /status: "superseded"/);
  assert.match(activate, /status: "active"/);
  assert.doesNotMatch(view, /storagePath:/);
  assert.doesNotMatch(view, /storageBucket:/);
  assert.doesNotMatch(view, /uploadedBy:/);
});
