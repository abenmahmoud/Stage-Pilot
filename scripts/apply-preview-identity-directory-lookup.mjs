import { readFile } from "node:fs/promises";
import postgres from "postgres";

const EXPECTED_PROJECT_REF = "xijocumlwivhbmffrnlj";
const MIGRATIONS = [
  { version: "20260829031650", name: "create_identity_directory_lookup" },
  { version: "20260829031912", name: "minimize_identity_lookup_payloads" },
];
const mode = process.argv[2] ?? "--check";
if (!["--check", "--rollback-test", "--apply"].includes(mode)) {
  throw new Error("Use --check, --rollback-test or --apply");
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const target = new URL(databaseUrl);
if (![target.hostname, target.username].some((value) => value.includes(EXPECTED_PROJECT_REF))) {
  throw new Error("This script is locked to the Supabase preview branch");
}

const migrations = await Promise.all(MIGRATIONS.map(async (entry) => {
  const source = await readFile(
    new URL(`../supabase/migrations/${entry.version}_${entry.name}.sql`, import.meta.url),
    "utf8"
  );
  return {
    ...entry,
    body: source.replace(/^\s*begin;\s*/i, "").replace(/\s*commit;\s*$/i, "").trim(),
  };
}));
const sql = postgres(databaseUrl, { prepare: false, max: 1, idle_timeout: 20 });

async function state() {
  const versions = migrations.map((entry) => entry.version);
  const recorded = await sql`
    select version from supabase_migrations.schema_migrations
    where version in ${sql(versions)}
  `;
  const [result] = await sql`
    select
      to_regclass('public.identity_directory_lookup_requests') is not null as lookup_table,
      to_regclass('pgmq.q_identity_directory_lookup') is not null as lookup_queue,
      exists (
        select 1 from pg_constraint
        where conname = 'identity_directory_lookup_request_payload_check'
      ) as payload_guard
  `;
  return { ...result, recorded: recorded.map((entry) => entry.version).sort() };
}

function complete(value) {
  return value.lookup_table && value.lookup_queue && value.payload_guard
    && value.recorded.length === migrations.length;
}

function absent(value) {
  return !value.lookup_table && !value.lookup_queue && !value.payload_guard
    && value.recorded.length === 0;
}

try {
  const before = await state();
  if (mode === "--check") {
    console.log(JSON.stringify({ target: "preview", mode, ...before }));
  } else if (mode === "--rollback-test") {
    if (!absent(before)) throw new Error("Rollback test requires both migrations to be absent");
    const rollback = new Error("expected_rollback");
    try {
      await sql.begin(async (transaction) => {
        for (const migration of migrations) await transaction.unsafe(migration.body);
        const [inside] = await transaction`
          select
            to_regclass('public.identity_directory_lookup_requests') is not null as lookup_table,
            to_regclass('pgmq.q_identity_directory_lookup') is not null as lookup_queue,
            exists (
              select 1 from pg_constraint
              where conname = 'identity_directory_lookup_request_payload_check'
            ) as payload_guard
        `;
        if (!inside.lookup_table || !inside.lookup_queue || !inside.payload_guard) {
          throw new Error("Lookup controls were not created in the test transaction");
        }
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
    const after = await state();
    if (!absent(after)) throw new Error("Rollback test left persistent state");
    console.log(JSON.stringify({ target: "preview", mode, rollback: "verified" }));
  } else {
    if (!absent(before) && !complete(before)) {
      throw new Error("Migration state is inconsistent; manual review required");
    }
    if (absent(before)) {
      for (const migration of migrations) {
        await sql.begin(async (transaction) => {
          await transaction.unsafe(migration.body);
          await transaction`
            insert into supabase_migrations.schema_migrations (version, name, statements)
            values (${migration.version}, ${migration.name}, ${[migration.body]})
          `;
        });
      }
    }
    const after = await state();
    if (!complete(after)) throw new Error("Migration verification failed");
    const [security] = await sql`
      select
        (select count(*)::int from public.identity_directory_lookup_requests) as rows,
        (select count(*)::int from pgmq.q_identity_directory_lookup) as queued,
        (select relrowsecurity from pg_class where oid = 'public.identity_directory_lookup_requests'::regclass) as rls,
        (select relforcerowsecurity from pg_class where oid = 'public.identity_directory_lookup_requests'::regclass) as force_rls,
        has_table_privilege('anon', 'public.identity_directory_lookup_requests', 'select') as anon_select,
        has_table_privilege('authenticated', 'public.identity_directory_lookup_requests', 'select') as authenticated_select
    `;
    if (
      security.rows !== 0 || security.queued !== 0 || !security.rls || !security.force_rls ||
      security.anon_select || security.authenticated_select
    ) {
      throw new Error("Preview lookup security verification failed");
    }
    console.log(JSON.stringify({ target: "preview", mode, ...after, ...security }));
  }
} finally {
  await sql.end({ timeout: 5 });
}
