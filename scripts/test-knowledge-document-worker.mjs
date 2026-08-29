import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  documentPrivacySignals,
  extractKnowledgeDocument,
} from "../workers/knowledge-document-extractor.mjs";

function minimalPdf(text) {
  const safeText = text.replace(/([\\()])/g, "\\$1");
  const stream = `BT /F1 12 Tf 72 720 Td (${safeText}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}

test("extracts bounded safe text locally", async () => {
  const result = await extractKnowledgeDocument({
    bytes: Buffer.from("Calendrier fictif : accueil des classes le 2 septembre.", "utf8"),
    mimeType: "text/plain",
    classification: "internal",
  });
  assert.equal(result.summary.state, "extracted");
  assert.match(result.proposedKnowledge.extractedText, /accueil des classes/);
  assert.match(result.checksum, /^[a-f0-9]{64}$/);
});

test("stops automatic extraction when contact or credential values are present", async () => {
  const value = "Contacter personne@example.test. Code ENT: BC93-2026.";
  assert.deepEqual(documentPrivacySignals(value), ["email_address", "school_access_code"]);
  const result = await extractKnowledgeDocument({
    bytes: Buffer.from(value, "utf8"),
    mimeType: "text/plain",
    classification: "internal",
  });
  assert.equal(result.summary.state, "manual_review");
  assert.equal(result.proposedKnowledge.extractedText, null);
  assert.deepEqual(result.proposedKnowledge.privacySignals, [
    "email_address",
    "school_access_code",
  ]);
});

test("keeps a password reset procedure when it contains no credential value", async () => {
  const value =
    "Pour réinitialiser un mot de passe ENT, utilisez la procédure officielle. Ne communiquez jamais votre mot de passe ni un code reçu par SMS.";
  assert.deepEqual(documentPrivacySignals(value), []);
  const result = await extractKnowledgeDocument({
    bytes: Buffer.from(value, "utf8"),
    mimeType: "text/plain",
    classification: "internal",
  });
  assert.equal(result.summary.state, "extracted");
  assert.match(result.proposedKnowledge.extractedText, /procédure officielle/);
});

test("detects secrets in tabular imports and technical tokens without retaining text", async () => {
  const cases = [
    ["mot_de_passe,Azerty123!", "password_value"],
    ["otp;739144", "one_time_code"],
    ["code_pronote\tPRONOTE-2026", "school_access_code"],
    ["api_key=sk-exampletoken123456789", "api_secret"],
    ["-----BEGIN PRIVATE KEY-----", "private_key"],
  ];
  for (const [value, expectedSignal] of cases) {
    const result = await extractKnowledgeDocument({
      bytes: Buffer.from(value, "utf8"),
      mimeType: "text/csv",
      classification: "internal",
    });
    assert.equal(result.summary.state, "manual_review", value);
    assert.equal(result.proposedKnowledge.extractedText, null, value);
    assert.ok(result.proposedKnowledge.privacySignals.includes(expectedSignal), value);
  }
});

test("never retains extracted text for personal or sensitive documents", async () => {
  const result = await extractKnowledgeDocument({
    bytes: Buffer.from("Donnée fictive", "utf8"),
    mimeType: "text/plain",
    classification: "personal",
  });
  assert.equal(result.summary.reason, "sensitive_classification");
  assert.equal(result.proposedKnowledge.extractedText, null);
});

test("extracts a bounded xlsx workbook after archive preflight", async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["jour", "information"],
      ["lundi", "accueil fictif"],
    ]),
    "Planning"
  );
  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const result = await extractKnowledgeDocument({
    bytes,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    classification: "internal",
  });
  assert.equal(result.summary.method, "sheetjs");
  assert.match(result.proposedKnowledge.extractedText, /accueil fictif/);
});

test("extracts a simple PDF with the Node-compatible pdf engine", async () => {
  const result = await extractKnowledgeDocument({
    bytes: minimalPdf("Procedure fictive de voyage scolaire"),
    mimeType: "application/pdf",
    classification: "internal",
  });
  assert.equal(result.summary.method, "pdfjs");
  assert.match(result.proposedKnowledge.extractedText, /voyage scolaire/);
});

test("queues only private local analysis and keeps human review in the data model", async () => {
  const [migration, confirm, worker, service, workerPackage] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260828234000_create_knowledge_document_scan_queue.sql", import.meta.url), "utf8"),
    readFile(new URL("../api/knowledge/admin/documents/[id]/confirm.ts", import.meta.url), "utf8"),
    readFile(new URL("../workers/knowledge-document-worker.mjs", import.meta.url), "utf8"),
    readFile(new URL("../deploy/lycee-knowledge-document-worker.service", import.meta.url), "utf8"),
    readFile(new URL("../workers/package.json", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /pgmq\.create\('knowledge_document_scan'\)/);
  assert.match(migration, /revoke all on table[\s\S]+q_knowledge_document_scan[\s\S]+from public, anon, authenticated/i);
  assert.match(confirm, /pgmq\.send\([\s\S]+'knowledge_document_scan'/);
  assert.match(confirm, /status: "quarantined"/);
  assert.match(worker, /clamdscan/);
  assert.match(worker, /status = 'review'/);
  assert.match(worker, /invalid_job_archived/);
  assert.match(worker, /unresolved_job_archived/);
  assert.doesNotMatch(worker, /openai|anthropic|generativelanguage|api\.mistral/i);
  assert.match(service, /User=lycee-support/);
  assert.match(service, /MemoryMax=768M/);
  assert.equal(JSON.parse(workerPackage).dependencies["pdfjs-dist"], "5.4.624");
});
