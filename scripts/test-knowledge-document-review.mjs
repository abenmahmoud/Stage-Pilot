import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const reviewUrl = new URL(
  "../api/knowledge/admin/documents/[id]/review.ts",
  import.meta.url
);
const downloadUrl = new URL(
  "../api/knowledge/admin/documents/[id]/download.ts",
  import.meta.url
);
const listUrl = new URL("../api/knowledge/admin/documents/index.ts", import.meta.url);

test("requires MFA and creates only a draft source after human document approval", async () => {
  const source = await readFile(reviewUrl, "utf8");
  assert.match(source, /requireKnowledgeManager\(req, \{ publish: true \}\)/);
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /status: "draft"/);
  assert.match(source, /status: "ready"/);
  assert.match(source, /action: "review_document"/);
  assert.match(source, /compileApprovedDocument\(document\)/);
  assert.match(source, /proposedKnowledge: minimizedProposal/);
  assert.match(source, /extractedTextRemoved: true/);
  assert.doesNotMatch(source, /insert\(agentSkills\)|insert\(agentSkillVersions\)/);
});

test("removes a rejected original and clears proposed extracted knowledge", async () => {
  const source = await readFile(reviewUrl, "utf8");
  assert.match(source, /remove\(\[document\.storagePath\]\)/);
  assert.match(source, /proposedKnowledge: \{\}/);
  assert.match(source, /status: "rejected"/);
});

test("opens originals only through a short-lived private manager link", async () => {
  const source = await readFile(downloadUrl, "utf8");
  assert.match(source, /requireKnowledgeManager\(req\)/);
  assert.match(source, /createSignedUrl\(document\.storagePath, 60/);
  assert.match(source, /const downloadName/);
  assert.match(source, /open_for_review/);
  assert.doesNotMatch(source, /getPublicUrl/);
});

test("does not send extracted text or storage paths in the document list", async () => {
  const source = await readFile(listUrl, "utf8");
  assert.match(source, /\.select\(\{/);
  assert.match(source, /excerptCount:/);
  assert.doesNotMatch(source, /proposedKnowledge: knowledgeDocuments\.proposedKnowledge/);
  assert.doesNotMatch(source, /storagePath: knowledgeDocuments\.storagePath/);
  assert.doesNotMatch(source, /excerptText:/);
});
