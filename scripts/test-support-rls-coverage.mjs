import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const migrationsUrl = new URL("../supabase/migrations/", import.meta.url);
const migrationName = "20260830150000_force_support_private_rls.sql";
const migration = await readFile(new URL(migrationName, migrationsUrl), "utf8");
const migrationFiles = (await readdir(migrationsUrl)).filter((name) => name.endsWith(".sql"));

const expectedTables = [
  "support_requests",
  "support_contacts",
  "support_messages",
  "support_device_sessions",
  "support_session_requests",
  "support_magic_tokens",
  "support_attachments",
  "support_events",
  "support_job_runs",
  "support_email_dispatches",
  "support_failed_jobs",
  "support_delivery_events",
  "support_webhook_receipts",
  "support_callback_tasks",
  "support_templates",
  "support_rate_limits",
  "support_assistant_routing_reviews",
].sort();

const discoveredTables = new Set();
for (const file of migrationFiles) {
  const source = await readFile(new URL(file, migrationsUrl), "utf8");
  for (const match of source.matchAll(/create table\s+(?:if not exists\s+)?public\.(support_[a-z0-9_]+)/gi)) {
    discoveredTables.add(match[1].toLowerCase());
  }
}

assert.deepEqual(
  [...discoveredTables].sort(),
  expectedTables,
  "every private support table must be covered explicitly"
);

for (const table of expectedTables) {
  if (table === "support_email_dispatches") {
    const guard = await readFile(new URL("20260904102111_support_email_dispatch_guard.sql", migrationsUrl), "utf8");
    assert.match(guard, /support_email_dispatches enable row level security/i);
    assert.match(guard, /support_email_dispatches force row level security/i);
    assert.match(guard, /revoke all on public.support_email_dispatches from public, anon, authenticated/i);
    continue;
  }
  assert.match(migration, new RegExp(`['\"]${table}['\"]`), `${table} must be listed`);
}

assert.match(migration, /begin;/i);
assert.match(migration, /commit;/i);
assert.match(migration, /to_regclass\(/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /force row level security/i);
assert.match(migration, /revoke all on table public\.%I from public, anon, authenticated/i);
assert.doesNotMatch(migration, /disable row level security/i);
assert.doesNotMatch(migration, /grant\s+all/i);

console.log(JSON.stringify({
  migration: migrationName,
  coveredTables: expectedTables.length,
  discoveredTables: discoveredTables.size,
}));
