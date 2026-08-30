import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const recipe = readFileSync(
  new URL("../supabase/tests/public_content_expired_archive_security.test.sql", import.meta.url),
  "utf8"
);
const route = readFileSync(new URL("../api/content/public.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");

test("keeps the archive recipe fictitious, transactional and residue-free", () => {
  assert.match(recipe, /^begin;/);
  assert.match(recipe, /rollback;[\s\S]*auth_residue[\s\S]*item_residue[\s\S]*version_residue/);
  assert.match(recipe, /@example\.test/);
  assert.doesNotMatch(recipe, /@ac-creteil\.fr|lycee-blaise-cendrars-sevran\.fr/);
});

test("partitions current, expired and manually withdrawn publications", () => {
  assert.match(recipe, /current_ids <> array\['00000000-0000-4000-8000-000000005962'::uuid\]/);
  assert.match(recipe, /expired_ids <> array\['00000000-0000-4000-8000-000000005963'::uuid\]/);
  assert.match(recipe, /item\.status <> 'archive'/);
  assert.match(recipe, /has_table_privilege/);
});

test("binds pagination to the current or expired scope", () => {
  assert.match(route, /parsePublicContentScope\(req\.query\.archive\)/);
  assert.match(route, /cursor\.scope !== scope/);
  assert.match(route, /scope === "expired"/);
  assert.match(route, /ne\(siteContentItems\.status, "archive"\)/);
  assert.match(route, /return \{ items, nextCursor, scope \}/);
});

test("offers an accessible archive mode while explaining manual withdrawal", () => {
  assert.match(page, /role="group" aria-label="Période des informations"/);
  assert.match(page, /aria-pressed=\{scope === "expired"\}/);
  assert.match(page, /Les publications retirées par la direction ne sont jamais affichées ici/);
});
