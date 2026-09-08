import { readFile } from "node:fs/promises";
import postgres from "postgres";

const EXPECTED_PROJECT_REF = "xijocumlwivhbmffrnlj";
const VERSION = "20260902210908";
const NAME = "create_identity_device_access";
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

const migration = await readFile(
  new URL(`../supabase/migrations/${VERSION}_${NAME}.sql`, import.meta.url),
  "utf8"
);
const body = migration
  .replace(/^\s*begin;\s*/i, "")
  .replace(/\s*commit;\s*$/i, "")
  .trim();
const sql = postgres(databaseUrl, { prepare: false, max: 1, idle_timeout: 20 });

async function state(client = sql) {
  const [result] = await client`
    select
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'identity_directory_lookup_requests'
          and column_name = 'public_actor_id'
      ) as public_actor_column,
      to_regclass('public.identity_device_challenges') is not null as challenge_table,
      to_regclass('public.identity_device_sessions') is not null as session_table,
      exists (
        select 1 from supabase_migrations.schema_migrations
        where version = ${VERSION}
      ) as migration_recorded
  `;
  return result;
}

function complete(value) {
  return value.public_actor_column
    && value.challenge_table
    && value.session_table
    && value.migration_recorded;
}

function absent(value) {
  return !value.public_actor_column
    && !value.challenge_table
    && !value.session_table
    && !value.migration_recorded;
}

try {
  const before = await state();
  if (mode === "--check") {
    console.log(JSON.stringify({ target: "preview", mode, ...before }));
  } else if (mode === "--rollback-test") {
    if (!absent(before)) throw new Error("Rollback test requires the migration to be absent");
    const expectedRollback = new Error("expected_rollback");
    try {
      await sql.begin(async (transaction) => {
        await transaction.unsafe(body);
        const inside = await state(transaction);
        if (!inside.public_actor_column || !inside.challenge_table || !inside.session_table) {
          throw new Error("Identity device controls were not created in the test transaction");
        }
        throw expectedRollback;
      });
    } catch (error) {
      if (error !== expectedRollback) throw error;
    }
    const after = await state();
    if (!absent(after)) throw new Error("Rollback test left persistent state");
    console.log(JSON.stringify({ target: "preview", mode, rollback: "verified" }));
  } else {
    if (!absent(before) && !complete(before)) {
      throw new Error("Migration state is inconsistent; manual review required");
    }
    if (absent(before)) {
      await sql.begin(async (transaction) => {
        await transaction.unsafe(body);
        await transaction`
          insert into supabase_migrations.schema_migrations (version, name, statements)
          values (${VERSION}, ${NAME}, ${[body]})
        `;
      });
    }
    const after = await state();
    if (!complete(after)) throw new Error("Migration verification failed");
    const [security] = await sql`
      select
        (select count(*)::int from public.identity_device_challenges) as challenge_rows,
        (select count(*)::int from public.identity_device_sessions) as session_rows,
        (select relrowsecurity from pg_class where oid = 'public.identity_device_challenges'::regclass) as challenge_rls,
        (select relforcerowsecurity from pg_class where oid = 'public.identity_device_challenges'::regclass) as challenge_force_rls,
        (select relrowsecurity from pg_class where oid = 'public.identity_device_sessions'::regclass) as session_rls,
        (select relforcerowsecurity from pg_class where oid = 'public.identity_device_sessions'::regclass) as session_force_rls,
        has_table_privilege('anon', 'public.identity_device_challenges', 'select') as anon_challenge_select,
        has_table_privilege('authenticated', 'public.identity_device_sessions', 'select') as authenticated_session_select
    `;
    if (
      security.challenge_rows !== 0
      || security.session_rows !== 0
      || !security.challenge_rls
      || !security.challenge_force_rls
      || !security.session_rls
      || !security.session_force_rls
      || security.anon_challenge_select
      || security.authenticated_session_select
    ) {
      throw new Error("Preview identity device security verification failed");
    }
    console.log(JSON.stringify({ target: "preview", mode, ...after, ...security }));
  }
} finally {
  await sql.end({ timeout: 5 });
}
