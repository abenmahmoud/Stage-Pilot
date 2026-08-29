import { readFile } from "node:fs/promises";
import postgres from "postgres";

const EXPECTED_PROJECT_REF = "xijocumlwivhbmffrnlj";
const VERSION = "20260828234000";
const NAME = "create_knowledge_document_scan_queue";
const migrationUrl = new URL(
  `../supabase/migrations/${VERSION}_${NAME}.sql`,
  import.meta.url
);
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

const migration = await readFile(migrationUrl, "utf8");
const body = migration
  .replace(/^\s*begin;\s*/i, "")
  .replace(/\s*commit;\s*$/i, "")
  .trim();
const sql = postgres(databaseUrl, { prepare: false, max: 1, idle_timeout: 20 });

async function state() {
  const [result] = await sql`
    select
      to_regclass('pgmq.q_knowledge_document_scan') is not null as queue_exists,
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
  } else if (mode === "--rollback-test") {
    if (before.queue_exists || before.migration_recorded) {
      throw new Error("Rollback test requires the migration to be absent");
    }
    const rollback = new Error("expected_rollback");
    try {
      await sql.begin(async (transaction) => {
        await transaction.unsafe(body);
        const [inside] = await transaction`
          select to_regclass('pgmq.q_knowledge_document_scan') is not null as queue_exists
        `;
        if (!inside.queue_exists) throw new Error("Queue was not created inside the test transaction");
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
    const after = await state();
    if (after.queue_exists || after.migration_recorded) {
      throw new Error("Rollback test left persistent state");
    }
    console.log(JSON.stringify({ target: "preview", mode, rollback: "verified" }));
  } else {
    if (before.queue_exists !== before.migration_recorded) {
      throw new Error("Migration state is inconsistent; manual review required");
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
    if (!after.queue_exists || !after.migration_recorded) {
      throw new Error("Migration verification failed");
    }
    console.log(JSON.stringify({ target: "preview", mode, ...after }));
  }
} finally {
  await sql.end({ timeout: 5 });
}
