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
const reservePath = new URL("../api/identity/admin/imports/index.ts", import.meta.url);
const confirmPath = new URL(
  "../api/identity/admin/imports/[id]/confirm.ts",
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
  assert.match(confirm, /eq\(identityDirectoryImports\.status, "reserved"\)/);
  assert.match(confirm, /status: "uploaded"/);
  assert.doesNotMatch(confirm, /status: "active"/);
});
