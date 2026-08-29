import { readFile } from "node:fs/promises";
import postgres from "postgres";

const EXPECTED_PROJECT_REF = "xijocumlwivhbmffrnlj";
const VERSION = "20260829010855";
const NAME = "create_identity_directory_vault";
const migrationUrl = new URL(`../supabase/migrations/${VERSION}_${NAME}.sql`, import.meta.url);
const mode = process.argv[2] ?? "--check";
if (!["--check", "--rollback-test"].includes(mode)) {
  throw new Error("Use --check or --rollback-test");
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
      to_regclass('public.identity_directory_private_rows') is not null as vault_table,
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
    console.log(JSON.stringify({ target: "preview", mode, ...before }));
  } else {
    if (before.vault_table || before.migration_recorded) {
      throw new Error("Rollback test requires the migration to be absent");
    }
    const rollback = new Error("expected_rollback");
    try {
      await sql.begin(async (transaction) => {
        await transaction.unsafe(body);
        const [inside] = await transaction`
          select to_regclass('public.identity_directory_private_rows') is not null as vault_table
        `;
        if (!inside.vault_table) throw new Error("Vault table was not created in the test transaction");
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
    const after = await state();
    if (after.vault_table || after.migration_recorded) {
      throw new Error("Rollback test left persistent state");
    }
    console.log(JSON.stringify({ target: "preview", mode, rollback: "verified" }));
  }
} finally {
  await sql.end({ timeout: 5 });
}
