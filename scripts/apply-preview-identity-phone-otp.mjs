import { readFile } from "node:fs/promises";
import postgres from "postgres";

const EXPECTED_PROJECT_REF = "xijocumlwivhbmffrnlj";
const VERSION = "20260909143000";
const NAME = "allow_identity_phone_otp";
const mode = process.argv[2] ?? "--check";
if (!["--check", "--apply"].includes(mode)) throw new Error("Use --check or --apply");

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
const sql = postgres(databaseUrl, { prepare: false, max: 1, idle_timeout: 20 });

async function state(client = sql) {
  const [result] = await client`
    select
      exists (
        select 1 from pg_constraint
        where conname = 'identity_device_sessions_assurance_level_check'
          and pg_get_constraintdef(oid) like '%directory_phone_otp%'
      ) as phone_assurance_allowed,
      exists (
        select 1 from supabase_migrations.schema_migrations
        where version = ${VERSION}
      ) as migration_recorded,
      (select count(*)::int from public.identity_device_sessions) as session_rows
  `;
  return result;
}

try {
  const before = await state();
  if (mode === "--apply" && !before.phone_assurance_allowed && !before.migration_recorded) {
    await sql.begin(async (transaction) => {
      await transaction.unsafe(migration);
      await transaction`
        insert into supabase_migrations.schema_migrations (version, name, statements)
        values (${VERSION}, ${NAME}, ${[migration]})
      `;
    });
  } else if (mode === "--apply" && before.phone_assurance_allowed !== before.migration_recorded) {
    throw new Error("Preview identity phone OTP migration state is inconsistent");
  }
  const after = await state();
  if (mode === "--apply" && (!after.phone_assurance_allowed || !after.migration_recorded)) {
    throw new Error("Preview identity phone OTP migration verification failed");
  }
  console.log(JSON.stringify({ target: "preview", mode, ...after }));
} finally {
  await sql.end({ timeout: 5 });
}
