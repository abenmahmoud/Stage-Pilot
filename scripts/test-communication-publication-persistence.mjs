import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const recipe = readFileSync(
  new URL("../supabase/tests/communication_publication_atomicity_security.test.sql", import.meta.url),
  "utf8"
);

test("keeps the publication recipe fictitious, transactional and residue-free", () => {
  assert.match(recipe, /^begin;/);
  assert.match(recipe, /rollback;[\s\S]*auth_residue[\s\S]*institution_residue[\s\S]*communication_residue[\s\S]*communication_version_residue[\s\S]*site_content_residue[\s\S]*site_version_residue[\s\S]*site_audit_residue[\s\S]*communication_event_residue/);
  assert.match(recipe, /@example\.test/);
  assert.doesNotMatch(recipe, /@ac-creteil\.fr|lycee-blaise-cendrars-sevran\.fr/);
});

test("proves one public snapshot without opening an email delivery", () => {
  assert.match(recipe, /status = 'publie'/);
  assert.match(recipe, /item\.audience = 'tous'/);
  assert.match(recipe, /version\.snapshot ->> 'status' = 'publie'/);
  assert.match(recipe, /communication\.published/);
  assert.match(recipe, /communication_audiences/);
  assert.match(recipe, /communication_deliveries/);
  assert.match(recipe, /communication_jobs/);
});

test("proves rollback of every partial publication side effect", () => {
  assert.match(recipe, /forced_publication_rollback/);
  assert.match(recipe, /Failed publication left a partial state/);
  assert.match(recipe, /site_content_items where id = failed_content_id/);
  assert.match(recipe, /site_content_versions where content_id = failed_content_id/);
  assert.match(recipe, /site_content_audit where resource_id = failed_content_id/);
});

test("keeps direct client access closed", () => {
  assert.match(recipe, /has_table_privilege\('anon', 'public\.site_content_items', 'SELECT'\)/);
  assert.match(recipe, /has_table_privilege\('authenticated', 'public\.communications', 'SELECT'\)/);
});
