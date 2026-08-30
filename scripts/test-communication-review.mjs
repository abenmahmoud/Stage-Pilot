import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const detailPath = new URL("../api/communications/admin/[id]/index.ts", import.meta.url);
const reviewPath = new URL("../api/communications/admin/[id]/review.ts", import.meta.url);
const migrationPath = new URL(
  "../supabase/migrations/20260830080000_harden_communication_review_lifecycle.sql",
  import.meta.url
);
const retentionMigrationPath = new URL(
  "../supabase/migrations/20260830082000_retain_and_attach_communication_versions.sql",
  import.meta.url
);

test("returns only the scoped current content and bounded version metadata", async () => {
  const route = await readFile(detailPath, "utf8");
  assert.match(route, /requireCommunicationEditor\(req\)/);
  assert.match(route, /eq\(communications\.institutionId, context\.institutionId\)/);
  assert.match(route, /eq\(communicationVersions\.institutionId, context\.institutionId\)/);
  assert.match(route, /bodyMarkdown: communicationVersions\.bodyMarkdown/);
  assert.match(route, /structuredFacts: communicationVersions\.structuredFacts/);
  assert.match(route, /openQuestions: communicationVersions\.openQuestions/);
  assert.doesNotMatch(route, /sourceFingerprint: communications\.sourceFingerprint/);
  assert.doesNotMatch(route, /contentHash: communicationVersions\.contentHash/);
});

test("creates exactly one new draft version under a row lock", async () => {
  const route = await readFile(detailPath, "utf8");
  assert.match(route, /for update/);
  assert.match(route, /root\.status !== "draft"/);
  assert.match(route, /const nextVersion = root\.currentVersion \+ 1/);
  assert.match(route, /\.insert\(communicationVersions\)/);
  assert.match(route, /status: "draft"/);
  assert.match(route, /currentVersion: nextVersion/);
  assert.match(route, /eventType: "version\.created"/);
  assert.match(route, /current\.contentHash === contentHash/);
  assert.doesNotMatch(route, /\.update\(communicationVersions\)[\s\S]{0,500}bodyMarkdown/);
});

test("requests human review only after every open question is resolved", async () => {
  const route = await readFile(reviewPath, "utf8");
  assert.match(route, /confirmation !== "VERIFIER"/);
  assert.match(route, /for update/);
  assert.match(route, /questions\.length > 0/);
  assert.match(route, /status: "review"/);
  assert.match(route, /eventType: "communication\.review_requested"/);
  assert.match(route, /eq\(communications\.institutionId, context\.institutionId\)/);
  assert.doesNotMatch(route, /approvedBy|approvedAt|published|delivery|audience/i);
});

test("enforces clean inserts, ordered versions and immutable review content in SQL", async () => {
  const migration = await readFile(migrationPath, "utf8");
  const retentionMigration = await readFile(retentionMigrationPath, "utf8");
  assert.match(migration, /Communication must start as a private draft/);
  assert.match(migration, /Communication version must start as a draft/);
  assert.match(migration, /Communication version sequence is invalid/);
  assert.match(migration, /Communication version pointer may advance once while drafting/);
  assert.match(migration, /Communication review content is immutable/);
  assert.match(migration, /Communication and current version states are inconsistent/);
  assert.match(migration, /Only the current communication version may change state/);
  assert.match(migration, /Invalid communication lifecycle transition/);
  assert.match(migration, /Invalid communication version lifecycle transition/);
  assert.match(migration, /before insert on public\.communications/);
  assert.match(migration, /before insert on public\.communication_versions/);
  assert.match(migration, /deferrable initially deferred/);
  assert.match(migration, /revoke all on function public\.communication_root_insert_guard/);
  assert.match(retentionMigration, /Communication versions are retained/);
  assert.match(retentionMigration, /Communication version must become current in the same transaction/);
  assert.match(retentionMigration, /revoke all on function public\.communication_guard_version/);
});
