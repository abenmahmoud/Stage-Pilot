import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  KNOWLEDGE_DOCUMENT_MAX_BYTES,
  knowledgeDocumentMime,
  parseKnowledgeDocumentInput,
} from "../shared/knowledge-document-input.ts";
import { knowledgeDocumentStoragePath } from "../api/_shared/knowledge-documents.ts";

const migrationPath = new URL(
  "../supabase/migrations/20260828184943_create_knowledge_document_ingestion.sql",
  import.meta.url
);
const governanceMigrationPath = new URL(
  "../supabase/migrations/20260828232200_add_knowledge_document_governance.sql",
  import.meta.url
);
const reservePath = new URL("../api/knowledge/admin/documents/index.ts", import.meta.url);
const uploaderPath = new URL("../src/lib/resumable-upload.ts", import.meta.url);

function validInput(overrides = {}) {
  return {
    title: "Procédure fictive de test",
    purposeDescription:
      "Ce document fictif décrit une procédure de test et ne contient aucune donnée réelle.",
    sourceType: "procedure",
    classification: "internal",
    ownerServiceCode: "referent_numerique",
    serviceCodes: ["referent_numerique"],
    validFrom: "2026-09-01",
    reviewDueAt: "2027-02-01T12:00:00.000Z",
    originalName: "procedure-fictive.pdf",
    mimeType: "application/pdf",
    sizeBytes: 8 * 1024 * 1024,
    ...overrides,
  };
}

test("accepts a bounded private document with a business explanation", () => {
  const parsed = parseKnowledgeDocumentInput(validInput());
  assert.equal(parsed.mimeType, "application/pdf");
  assert.equal(parsed.ownerServiceCode, "referent_numerique");
  assert.deepEqual(parsed.serviceCodes, ["referent_numerique"]);
});

test("separates people directories from governed knowledge documents", () => {
  const form = parseKnowledgeDocumentInput(validInput({ sourceType: "form_template" }));
  assert.equal(form.sourceType, "form_template");
  assert.throws(
    () => parseKnowledgeDocumentInput(validInput({ sourceType: "directory" })),
    /Type de document/
  );
  assert.throws(
    () => parseKnowledgeDocumentInput(validInput({ reviewDueAt: "2026-08-31T23:00:00.000Z" })),
    /postérieure/
  );
});

test("infers known browser MIME gaps without accepting executable files", () => {
  assert.equal(knowledgeDocumentMime("tableau.csv", ""), "text/csv");
  assert.equal(knowledgeDocumentMime("procedure.docx", "application/octet-stream"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.throws(
    () => parseKnowledgeDocumentInput(validInput({ originalName: "outil.exe", mimeType: "application/octet-stream" })),
    /Format du fichier/
  );
});

test("rejects oversized documents and misleading public restrictions", () => {
  assert.throws(
    () => parseKnowledgeDocumentInput(validInput({ sizeBytes: KNOWLEDGE_DOCUMENT_MAX_BYTES + 1 })),
    /50 Mo/
  );
  assert.throws(
    () => parseKnowledgeDocumentInput(validInput({ classification: "public" })),
    /public/
  );
});

test("uses opaque institution-scoped storage paths", () => {
  const path = knowledgeDocumentStoragePath(
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "Liste réelle à ne pas exposer.PDF"
  );
  assert.match(path, /^11111111-1111-4111-8111-111111111111\/22222222-2222-4222-8222-222222222222\/\d{4}\/\d{2}\/[0-9a-f-]+\.pdf$/);
  assert.doesNotMatch(path, /Liste|réelle|exposer/i);
});

test("keeps uploaded documents private and inactive by construction", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /'knowledge-ingest',[\s\S]+false,[\s\S]+52428800/i);
  assert.match(sql, /alter table public\.knowledge_documents enable row level security/i);
  assert.match(sql, /alter table public\.knowledge_documents force row level security/i);
  assert.match(sql, /revoke all on table public\.knowledge_documents from public, anon, authenticated/i);
  assert.match(sql, /check \(source_id is null or status = 'ready'\)/i);
  assert.match(sql, /status in \([\s\S]+'reserved'[\s\S]+'uploaded'[\s\S]+'ready'/i);
});

test("requires a human owner, effective date and review deadline", async () => {
  const sql = await readFile(governanceMigrationPath, "utf8");
  assert.match(sql, /owner_service_code text/i);
  assert.match(sql, /valid_from date/i);
  assert.match(sql, /review_due_at timestamptz/i);
  assert.match(sql, /source_type in \('internal_document', 'procedure', 'calendar', 'form_template'\)/i);
  assert.match(sql, /knowledge_documents_owner_review_idx/i);
});

test("uploads directly with TUS and never creates a published source", async () => {
  const [reserve, uploader] = await Promise.all([
    readFile(reservePath, "utf8"),
    readFile(uploaderPath, "utf8"),
  ]);
  assert.match(reserve, /requireKnowledgeManager\(req\)/);
  assert.match(reserve, /createSignedUploadUrl\(storagePath\)/);
  assert.match(reserve, /status: "reserved"/);
  assert.doesNotMatch(reserve, /insert\(knowledgeSources\)/);
  assert.match(uploader, /new tus\.Upload/);
  assert.match(uploader, /"x-signature": target\.token/);
  assert.match(uploader, /resumeFromPreviousUpload/);
});
