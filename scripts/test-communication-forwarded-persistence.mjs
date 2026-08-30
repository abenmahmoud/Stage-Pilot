import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const recipe = readFileSync(
  new URL("../supabase/tests/communication_forwarded_draft_security.test.sql", import.meta.url),
  "utf8"
);

test("keeps the forwarded draft recipe transactional and residue-free", () => {
  assert.match(recipe, /^begin;/);
  assert.match(recipe, /rollback;[\s\S]*auth_residue[\s\S]*institution_residue[\s\S]*membership_residue[\s\S]*communication_residue[\s\S]*version_residue[\s\S]*inbound_residue[\s\S]*event_residue/);
  assert.match(recipe, /@example\.test/);
  assert.doesNotMatch(recipe, /@ac-creteil\.fr|lycee-blaise-cendrars-sevran\.fr/);
});

test("proves one linked internal draft and an idempotent replay", () => {
  assert.match(recipe, /provider = 'brevo_forward'/);
  assert.match(recipe, /classification = 'forwarded_source'/);
  assert.match(recipe, /source_type = 'forwarded_email'/);
  assert.match(recipe, /draft\.status = 'draft'/);
  assert.match(recipe, /draft\.visibility = 'internal'/);
  assert.match(recipe, /on conflict do nothing/);
  assert.match(recipe, /on conflict \(institution_id, source_fingerprint\) do nothing/);
});

test("proves an active admin actor, no delivery and no client privilege", () => {
  assert.match(recipe, /role = 'admin' and status = 'active'/);
  assert.match(recipe, /communication_audiences/);
  assert.match(recipe, /communication_deliveries/);
  assert.match(recipe, /communication_jobs/);
  assert.match(recipe, /has_table_privilege/);
});
