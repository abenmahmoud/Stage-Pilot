import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { maskKnowledgeDocumentListMetadata } from "../shared/knowledge-document-governance.ts";
import {
  boundedPurgeError,
  isKnowledgeDocumentPurgeEligible,
  purgedKnowledgeDocumentValues,
} from "../workers/knowledge-document-retention-policy.mjs";

const migrationUrl = new URL(
  "../supabase/migrations/20260829203723_add_knowledge_document_retention.sql",
  import.meta.url
);
const listUrl = new URL("../api/knowledge/admin/documents/index.ts", import.meta.url);
const downloadUrl = new URL("../api/knowledge/admin/documents/[id]/download.ts", import.meta.url);
const workerUrl = new URL("../workers/knowledge-document-purge-worker.mjs", import.meta.url);

const privateMetadata = {
  classification: "personal",
  title: "Dossier nominatif Jean Dupont",
  purposeDescription: "Coordonnées complètes de la famille Dupont",
  originalName: "jean-dupont-coordonnees.pdf",
};

test("masks personal and sensitive metadata in document lists", () => {
  for (const classification of ["personal", "sensitive"]) {
    const masked = maskKnowledgeDocumentListMetadata({ ...privateMetadata, classification });
    assert.doesNotMatch(JSON.stringify(masked), /Dupont|coordonnees/i);
    assert.match(masked.originalName, /masqué/i);
  }
});

test("keeps public and internal metadata readable", () => {
  const internal = { ...privateMetadata, classification: "internal" };
  assert.deepEqual(maskKnowledgeDocumentListMetadata(internal), internal);
});

test("retention is closed unless an approved policy and due date exist", () => {
  const base = {
    status: "review",
    source_id: null,
    retention_policy_key: "pending_dpo",
    retention_until: null,
    purge_status: "blocked",
  };
  assert.equal(isKnowledgeDocumentPurgeEligible(base, new Date("2026-09-01T00:00:00Z")), false);
  assert.equal(isKnowledgeDocumentPurgeEligible({
    ...base,
    retention_policy_key: "approved",
    retention_until: "2026-08-31T00:00:00Z",
    purge_status: "scheduled",
  }, new Date("2026-09-01T00:00:00Z")), true);
  assert.equal(isKnowledgeDocumentPurgeEligible({
    ...base,
    retention_policy_key: "approved",
    retention_until: "2026-08-31T00:00:00Z",
    purge_status: "scheduled",
    source_id: "active-source",
  }, new Date("2026-09-01T00:00:00Z")), false);
});

test("purged metadata contains no original content or filename", () => {
  const values = purgedKnowledgeDocumentValues(
    "11111111-1111-4111-8111-111111111111",
    new Date("2026-09-01T00:00:00Z")
  );
  assert.equal(values.status, "purged");
  assert.equal(Object.keys(values.proposedKnowledge).length, 0);
  assert.equal(values.checksum, null);
  assert.doesNotMatch(JSON.stringify(values), /Dupont|coordonnees/i);
});

test("purge errors are bounded and control characters are removed", () => {
  const code = boundedPurgeError(new Error(`storage\u0000-${"x".repeat(400)}`));
  assert.equal(code.length, 240);
  assert.doesNotMatch(code, /\u0000/);
});

test("migration keeps purge blocked by default and extends the private audit", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /retention_policy_key text not null default 'pending_dpo'/i);
  assert.match(sql, /retention_until is null\s+and purge_status = 'blocked'/i);
  assert.match(sql, /source_id is null/i);
  assert.match(sql, /'access_document', 'purge_document', 'fail_purge'/i);
  assert.doesNotMatch(sql, /interval '\d+ (?:day|days|month|months|year|years)'/i);
});

test("list masks governed metadata and never exposes storage internals", async () => {
  const source = await readFile(listUrl, "utf8");
  assert.match(source, /maskKnowledgeDocumentListMetadata/);
  assert.match(source, /retentionPolicyKey:/);
  assert.doesNotMatch(source, /storagePath: knowledgeDocuments\.storagePath/);
  assert.doesNotMatch(source, /proposedKnowledge: knowledgeDocuments\.proposedKnowledge/);
});

test("opening a private original records a minimal access event", async () => {
  const source = await readFile(downloadUrl, "utf8");
  assert.match(source, /action: "access_document"/);
  assert.match(source, /expiresInSeconds: 60/);
  assert.doesNotMatch(source, /storagePath: document\.storagePath/);
  assert.doesNotMatch(source, /originalName: document\.originalName/);
});

test("worker claims by batch and removes storage through the API", async () => {
  const source = await readFile(workerUrl, "utf8");
  assert.match(source, /for update skip locked/i);
  assert.match(source, /KNOWLEDGE_PURGE_WORKER_ENABLED/);
  assert.match(source, /source_id is null/i);
  assert.match(source, /\.from\(document\.storage_bucket\)\.remove\(\[document\.storage_path\]\)/);
  assert.match(source, /delete from public\.knowledge_source_excerpts/i);
  assert.match(source, /returning id/i);
  assert.doesNotMatch(source, /delete from storage\.objects/i);
});
