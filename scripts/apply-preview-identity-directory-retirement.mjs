import { readFile } from "node:fs/promises";
import postgres from "postgres";

const EXPECTED_PROJECT_REF = "xijocumlwivhbmffrnlj";
const VERSION = "20260829004115";
const NAME = "add_identity_directory_retirement";
const migrationUrl = new URL(`../supabase/migrations/${VERSION}_${NAME}.sql`, import.meta.url);
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

const migration = process.env.MIGRATION_B64
  ? Buffer.from(process.env.MIGRATION_B64, "base64").toString("utf8")
  : await readFile(migrationUrl, "utf8");
const body = migration
  .replace(/^\s*begin;\s*/i, "")
  .replace(/\s*commit;\s*$/i, "")
  .trim();
const sql = postgres(databaseUrl, { prepare: false, max: 1, idle_timeout: 20 });

async function state() {
  const [result] = await sql`
    select
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'identity_directory_imports'
          and column_name = 'retired_at'
      ) as retired_column,
      to_regprocedure('public.identity_directory_require_active_source()') is not null as source_guard,
      exists (
        select 1 from pg_trigger
        where tgrelid = 'public.school_identities'::regclass
          and tgname = 'school_identities_require_active_source'
          and not tgisinternal
      ) as identity_trigger,
      exists (
        select 1 from pg_trigger
        where tgrelid = 'public.school_relationships'::regclass
          and tgname = 'school_relationships_require_active_source'
          and not tgisinternal
      ) as relationship_trigger,
      exists (
        select 1 from supabase_migrations.schema_migrations
        where version = ${VERSION}
      ) as migration_recorded
  `;
  return result;
}

function complete(value) {
  return value.retired_column
    && value.source_guard
    && value.identity_trigger
    && value.relationship_trigger
    && value.migration_recorded;
}

function absent(value) {
  return !value.retired_column
    && !value.source_guard
    && !value.identity_trigger
    && !value.relationship_trigger
    && !value.migration_recorded;
}

try {
  const before = await state();
  if (mode === "--check") {
    console.log(JSON.stringify({ target: "preview", mode, ...before }));
  } else if (mode === "--rollback-test") {
    if (!absent(before)) throw new Error("Rollback test requires the migration to be absent");
    const rollback = new Error("expected_rollback");
    try {
      await sql.begin(async (transaction) => {
        await transaction.unsafe(body);
        const [inside] = await transaction`
          select
            exists (
              select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'identity_directory_imports'
                and column_name = 'retired_at'
            ) as retired_column,
            to_regprocedure('public.identity_directory_require_active_source()') is not null as source_guard
        `;
        if (!inside.retired_column || !inside.source_guard) {
          throw new Error("Lifecycle controls were not created inside the test transaction");
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
    const structural = [
      before.retired_column,
      before.source_guard,
      before.identity_trigger,
      before.relationship_trigger,
    ];
    if (structural.some(Boolean) && !structural.every(Boolean)) {
      throw new Error("Migration state is inconsistent; manual review required");
    }
    if (before.migration_recorded !== structural.every(Boolean)) {
      throw new Error("Migration record and schema state differ; manual review required");
    }
    if (!before.migration_recorded) {
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
    console.log(JSON.stringify({ target: "preview", mode, ...after }));
  }
} finally {
  await sql.end({ timeout: 5 });
}
