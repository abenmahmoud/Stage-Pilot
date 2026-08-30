import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  COMMUNICATION_DOCUMENT_MAX_BYTES,
  parseCommunicationDocumentInput,
} from "../shared/communication-document-input.ts";
import {
  communicationDocumentStoragePath,
  communicationDocumentUploadEnabled,
} from "../api/_shared/communication-documents.ts";

const migrationPath = new URL(
  "../supabase/migrations/20260830073000_create_communication_document_intake.sql",
  import.meta.url
);
const reservePath = new URL("../api/communications/admin/documents/index.ts", import.meta.url);
const confirmPath = new URL(
  "../api/communications/admin/documents/[id]/confirm.ts",
  import.meta.url
);
const workerPath = new URL("../workers/communication-document-worker.mjs", import.meta.url);
const schemaPath = new URL("../db/schema.ts", import.meta.url);

test("accepts only exact PDF and DOCX metadata", () => {
  assert.deepEqual(parseCommunicationDocumentInput({
    originalName: "Information-fictive.pdf",
    mimeType: "application/pdf",
    sizeBytes: 12_345,
  }), {
    originalName: "Information-fictive.pdf",
    mimeType: "application/pdf",
    sizeBytes: 12_345,
  });
  assert.equal(parseCommunicationDocumentInput({
    originalName: "Information-fictive.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: COMMUNICATION_DOCUMENT_MAX_BYTES,
  }).sizeBytes, COMMUNICATION_DOCUMENT_MAX_BYTES);
});

test("rejects path traversal, MIME mismatch, excess size and unknown fields", () => {
  for (const input of [
    { originalName: "../secret.pdf", mimeType: "application/pdf", sizeBytes: 10 },
    { originalName: "secret.pdf", mimeType: "text/plain", sizeBytes: 10 },
    { originalName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 10 },
    { originalName: "secret.exe", mimeType: "application/pdf", sizeBytes: 10 },
    { originalName: "secret.pdf", mimeType: "application/pdf", sizeBytes: COMMUNICATION_DOCUMENT_MAX_BYTES + 1 },
    { originalName: "secret.pdf", mimeType: "application/pdf", sizeBytes: 10, institutionId: "forbidden" },
  ]) {
    assert.throws(() => parseCommunicationDocumentInput(input));
  }
});

test("keeps document intake closed unless its dedicated switch is exact", async () => {
  assert.equal(communicationDocumentUploadEnabled({}), false);
  assert.equal(communicationDocumentUploadEnabled({ COMMUNICATION_DOCUMENT_UPLOAD_ENABLED: "TRUE" }), false);
  assert.equal(communicationDocumentUploadEnabled({ COMMUNICATION_DOCUMENT_UPLOAD_ENABLED: "true" }), true);
  const [reserve, confirm] = await Promise.all([
    readFile(reservePath, "utf8"),
    readFile(confirmPath, "utf8"),
  ]);
  assert.match(reserve, /if \(!communicationDocumentUploadEnabled\(\)\)/);
  assert.match(confirm, /if \(!communicationDocumentUploadEnabled\(\)\)/);
});

test("uses random signed coordinates without institution or user identifiers", () => {
  const path = communicationDocumentStoragePath("Information-fictive.pdf");
  assert.match(path, /^private\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/);
  assert.doesNotMatch(path, /institution|utilisateur|@/i);
});

test("creates a server-only private intake, append-only audit and private queue", async () => {
  const migration = await readFile(migrationPath, "utf8");
  for (const table of ["communication_source_documents", "communication_source_events"]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`alter table public\\.${table} force row level security`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`));
  }
  assert.match(migration, /before update or delete on public\.communication_source_events/);
  assert.match(migration, /Communication source must start as a clean reservation/);
  assert.match(migration, /actor_type = 'user' and actor_user_id is not null/);
  assert.match(migration, /foreign key \(source_document_id, institution_id\)/);
  assert.match(migration, /foreign key \(communication_id, institution_id\)/);
  assert.match(migration, /Invalid communication source lifecycle transition/);
  assert.match(migration, /'communication-ingest',[\s\S]+false,[\s\S]+10485760/);
  assert.match(migration, /pgmq\.create\('communication_document_scan'\)/);
  assert.match(migration, /revoke all on table[\s\S]+q_communication_document_scan[\s\S]+from public, anon, authenticated/i);
  assert.doesNotMatch(migration, /create policy/i);
});

test("reserves signed uploads without listing private paths or extracted text", async () => {
  const reserve = await readFile(reservePath, "utf8");
  assert.match(reserve, /requireCommunicationEditor\(req\)/);
  assert.match(reserve, /communicationDocumentUploadEnabled\(\)/);
  assert.match(reserve, /createSignedUploadUrl\(storagePath\)/);
  assert.match(reserve, /status: "reserved"/);
  assert.match(reserve, /eventType: "source\.reserved"/);
  assert.doesNotMatch(reserve, /storagePath: communicationSourceDocuments\.storagePath/);
  assert.doesNotMatch(reserve, /extractedText: communicationSourceDocuments\.extractedText/);
});

test("confirms exact object metadata and queues only scoped quarantine work", async () => {
  const confirm = await readFile(confirmPath, "utf8");
  assert.match(confirm, /requireCommunicationEditor\(req\)/);
  assert.match(confirm, /communicationDocumentUploadEnabled\(\)/);
  assert.match(confirm, /eq\(communicationSourceDocuments\.institutionId, context\.institutionId\)/);
  assert.match(confirm, /uploadedSize !== document\.sizeBytes/);
  assert.match(confirm, /uploadedMime !== document\.mimeType/);
  assert.match(confirm, /status: "quarantined"/);
  assert.match(confirm, /pgmq\.send\([\s\S]+'communication_document_scan'/);
  assert.match(confirm, /'job_type', 'scan_communication_document'/);
  assert.match(confirm, /'institution_id', \$\{context\.institutionId\}::uuid/);
  assert.doesNotMatch(confirm, /status: "review"/);
  assert.doesNotMatch(confirm, /status: "used"/);
});

test("runs antivirus and local extraction before mandatory human review", async () => {
  const worker = await readFile(workerPath, "utf8");
  assert.match(worker, /clamdscan/);
  assert.match(worker, /extractCommunicationDocument/);
  assert.match(worker, /status = 'processing'/);
  assert.match(worker, /status = 'review'/);
  assert.match(worker, /privacySignals/);
  assert.match(worker, /duplicate_checksum/);
  assert.match(worker, /antivirus_detected_threat/);
  assert.match(worker, /invalid_job_archived/);
  assert.match(worker, /unresolved_job_archived/);
  assert.doesNotMatch(worker, /openai|anthropic|generativelanguage|api\.mistral/i);
  assert.doesNotMatch(worker, /status = 'used'/);
});

test("keeps the Drizzle schema aligned with the two private tables", async () => {
  const schema = await readFile(schemaPath, "utf8");
  assert.match(schema, /export const communicationSourceDocuments = pgTable/);
  assert.match(schema, /export const communicationSourceEvents = pgTable/);
  assert.match(schema, /communication_source_documents_checksum_uidx/);
  assert.match(schema, /communication_source_events_source_scope_idx/);
});
