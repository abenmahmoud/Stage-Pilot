import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const recipe = readFileSync(
  new URL("../supabase/tests/communication_inbound_classification_security.test.sql", import.meta.url),
  "utf8"
);

test("keeps the preview recipe transactional and synthetic", () => {
  assert.match(recipe, /^begin;/);
  assert.match(recipe, /rollback;[\s\S]*auth_residue[\s\S]*institution_residue[\s\S]*communication_residue[\s\S]*inbound_residue/);
  assert.match(recipe, /@example\.test/);
  assert.doesNotMatch(recipe, /@ac-creteil\.fr|lycee-blaise-cendrars-sevran\.fr/);
});

test("proves the four governed categories and rejects an automatic action", () => {
  for (const category of ["withdrawal", "contact_correction", "question", "free_reply"]) {
    assert.match(recipe, new RegExp(`'${category}'`));
  }
  assert.match(recipe, /automatic_action/);
  assert.match(recipe, /exception when check_violation/);
  assert.match(recipe, /Invalid inbound classification was accepted/);
});

test("proves private review rows and absence of client privileges", () => {
  assert.match(recipe, /status = 'review'/);
  assert.match(recipe, /classification is null/);
  assert.match(recipe, /has_table_privilege/);
  assert.match(recipe, /'anon'/);
  assert.match(recipe, /'authenticated'/);
});
