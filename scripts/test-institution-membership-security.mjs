import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260827164419_create_institutions_memberships.sql",
  import.meta.url
);

test("keeps institution membership tables server-only", async () => {
  const sql = (await readFile(migrationUrl, "utf8")).toLowerCase();
  for (const table of ["institutions", "institution_memberships"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`alter table public\\.${table} force row level security`));
  }
  assert.match(sql, /from public, anon, authenticated/);
  assert.match(sql, /to service_role/);
  assert.doesNotMatch(sql, /grant\s+.+\s+to\s+(anon|authenticated)/s);
});

test("constrains persisted roles, statuses and services", async () => {
  const sql = (await readFile(migrationUrl, "utf8")).toLowerCase();
  for (const value of [
    "agent",
    "service_manager",
    "admin",
    "auditor",
    "invited",
    "active",
    "disabled",
    "referent_numerique",
    "ddfpt",
    "secretariat",
    "vie_scolaire",
  ]) {
    assert.match(sql, new RegExp(`'${value}'`));
  }
});
