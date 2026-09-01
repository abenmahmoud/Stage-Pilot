import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";

const migrationDirectory = new URL("../supabase/migrations/", import.meta.url);
const matching = (await readdir(migrationDirectory))
  .filter((name) => name.endsWith("_require_agent_mfa_for_direct_database_access.sql"));
assert.equal(matching.length, 1);
const migration = await readFile(new URL(matching[0], migrationDirectory), "utf8");
const recipe = await readFile(new URL(
  "../supabase/tests/agent_mfa_required_security.test.sql", import.meta.url,
), "utf8");
const withoutComments = (source) => source.replace(/--[^\r\n]*/g, "");
const sql = withoutComments(migration);
const testSql = withoutComments(recipe);

test("migration changes only the existing restrictive MFA policies", () => {
  const tables = [...sql.match(/foreach table_name in array array\[([\s\S]*?)\]/i)[1]
    .matchAll(/'([a-z_]+)'/g)].map((match) => match[1]).sort();
  assert.deepEqual(tables, [
    "classes", "eleves", "etablissement", "fiches_grand_oral", "import_logs",
    "notifications_log", "professeurs", "stages", "templates_documents",
  ]);
  assert.match(sql, /^\s*begin;/i);
  assert.match(sql, /commit;\s*$/i);
  assert.match(sql, /p\.permissive = 'RESTRICTIVE'.*p\.cmd = 'ALL'/);
  assert.match(sql, /p\.roles = array\['authenticated'\]::name\[\].*c\.relrowsecurity/);
  assert.match(sql, /raise exception 'Expected restrictive MFA policy/);
  assert.match(sql, /alter policy "agent_mfa_when_enrolled".*rename to "agent_mfa_required"/);
  assert.match(sql, /alter policy "agent_mfa_required".*using \(%s\) with check \(%s\)/);
  assert.doesNotMatch(sql, /\b(grant|revoke|delete|truncate|drop|insert|update)\b/i);
  assert.doesNotMatch(sql, /create\s+(policy|function)|disable\s+row\s+level|security\s+definer/i);
});

test("the MFA predicate matches API roles, with no enrollment or metadata fallback", () => {
  const predicate = sql.match(/\$policy\$([\s\S]*?)\$policy\$/)[1];
  assert.match(predicate, /\(select auth\.jwt\(\)\) -> 'app_metadata' ->> 'role'/);
  assert.match(predicate, /not in \('superadmin', 'administration', 'proviseur', 'agent'\)/);
  assert.match(predicate, /coalesce\(\(select auth\.jwt\(\)\) ->> 'aal', 'aal1'\) = 'aal2'/);
  assert.equal((predicate.match(/\bor\b/g) ?? []).length, 1);
  assert.doesNotMatch(predicate, /mfa_factors|user_metadata|not exists|service_role/);
});

test("the SQL recipe exercises installed predicates and real RLS with rollback", () => {
  assert.match(testSql, /^\s*begin;/i);
  assert.match(testSql, /rollback;\s*$/i);
  assert.doesNotMatch(testSql, /\bcommit\b|\bcreate\b|security\s+definer|\bgrant\b|\bdrop\b/i);
  assert.match(testSql, /not rolbypassrls and not rolsuper/);
  assert.match(testSql, /pg_trigger.*public\.classes/s);
  assert.match(testSql, /format\('select \(%s\), \(%s\)', policy_row\.qual, policy_row\.with_check\)/);
  assert.match(testSql, /set local role authenticated/);
  assert.match(testSql, /set local role anon/);
  assert.match(testSql, /set local role service_role/);
  assert.match(testSql, /\['aal1', 'aal2', null, 'aal3', ''\]/);
  assert.match(testSql, /'professeur', 'eleve', 'pp'/);
  assert.match(testSql, /'user_metadata', jsonb_build_object/);
  assert.match(testSql, /gen_random_uuid\(\)/);
  assert.match(testSql, /where id = class_id/g);
  assert.match(testSql, /where id = candidate_id/g);
  const modifiedTables = [...testSql.matchAll(/^\s*(?:insert into|update|delete from)\s+([a-z_.]+)/gim)]
    .map((match) => match[1]);
  assert.deepEqual([...new Set(modifiedTables)], ["public.classes"]);
  assert.match(testSql, /statement_timeout = '20s'/);
  assert.match(testSql, /lock_timeout = '3s'/);
});

// These are offline contract checks. PostgreSQL evidence comes from the SQL recipe.
