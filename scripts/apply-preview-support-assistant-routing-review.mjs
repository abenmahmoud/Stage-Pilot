import { readFile } from "node:fs/promises";
import postgres from "postgres";

const EXPECTED_PROJECT_REF = "xijocumlwivhbmffrnlj";
const VERSION = "20260830090000";
const NAME = "create_support_assistant_routing_reviews";
const migrationUrl = new URL(`../supabase/migrations/${VERSION}_${NAME}.sql`, import.meta.url);
const recipeUrl = new URL("../supabase/tests/support_assistant_routing_review_security.test.sql", import.meta.url);
const mode = process.argv[2] ?? "--check";

if (!["--check", "--rollback-test", "--apply", "--recipe"].includes(mode)) {
  throw new Error("Use --check, --rollback-test, --apply or --recipe");
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const target = new URL(databaseUrl);
if (![target.hostname, target.username].some((value) => value.includes(EXPECTED_PROJECT_REF))) {
  throw new Error("This script is locked to the Supabase preview branch");
}

const migration = await readFile(migrationUrl, "utf8");
const migrationBody = migration
  .replace(/^\s*begin;\s*/i, "")
  .replace(/\s*commit;\s*$/i, "")
  .trim();
const sql = postgres(databaseUrl, { prepare: false, max: 1, idle_timeout: 20 });

async function state() {
  const [result] = await sql`
    select
      to_regclass('public.support_assistant_routing_reviews') is not null as review_table,
      exists (
        select 1 from supabase_migrations.schema_migrations
        where version = ${VERSION}
      ) as migration_recorded
  `;
  return result;
}

try {
  const before = await state();
  if (mode === "--check") {
    const columns = await sql`
      select column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema = 'supabase_migrations'
        and table_name = 'schema_migrations'
      order by ordinal_position
    `;
    const latest = await sql`
      select version, name
      from supabase_migrations.schema_migrations
      order by version desc
      limit 5
    `;
    console.log(JSON.stringify({ target: "preview", mode, ...before, columns, latest }));
  } else if (mode === "--rollback-test") {
    if (before.review_table || before.migration_recorded) {
      throw new Error("Rollback test requires the migration to be absent");
    }
    const expectedRollback = new Error("expected_rollback");
    try {
      await sql.begin(async (transaction) => {
        await transaction.unsafe(migrationBody);
        const [inside] = await transaction`
          select to_regclass('public.support_assistant_routing_reviews') is not null as review_table
        `;
        if (!inside.review_table) throw new Error("Review table was not created in the test transaction");
        throw expectedRollback;
      });
    } catch (error) {
      if (error !== expectedRollback) throw error;
    }
    const after = await state();
    if (after.review_table || after.migration_recorded) {
      throw new Error("Rollback test left persistent state");
    }
    console.log(JSON.stringify({ target: "preview", mode, rollback: "verified" }));
  } else if (mode === "--apply") {
    if (before.review_table !== before.migration_recorded) {
      throw new Error("Migration state is inconsistent; refusing to apply");
    }
    if (!before.review_table) {
      await sql.begin(async (transaction) => {
        await transaction.unsafe(migrationBody);
        await transaction`
          insert into supabase_migrations.schema_migrations (version, statements, name)
          values (${VERSION}, ${[migrationBody]}, ${NAME})
        `;
      });
    }
    const after = await state();
    if (!after.review_table || !after.migration_recorded) {
      throw new Error("Migration was not applied atomically");
    }
    console.log(JSON.stringify({ target: "preview", mode, applied: !before.review_table, ...after }));
  } else {
    if (!before.review_table || !before.migration_recorded) {
      throw new Error("Apply the migration before running the recipe");
    }
    const recipe = await readFile(recipeUrl, "utf8");
    await sql.unsafe(recipe);
    const [residue] = await sql`
      select
        count(*) filter (where id::text like '00000000-0000-4000-8000-000000006%')::integer as review_rows
      from public.support_assistant_routing_reviews
    `;
    if (residue.review_rows !== 0) throw new Error("Recipe left persistent review rows");
    console.log(JSON.stringify({ target: "preview", mode, rollback: "verified", residue }));
  }
} finally {
  await sql.end({ timeout: 5 });
}
