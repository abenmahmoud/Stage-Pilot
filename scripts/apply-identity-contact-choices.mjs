import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
const VERSION = '20260909164806', NAME = 'identity_contact_choices';
const mode = process.argv[2] ?? '--check';
if (!['--check', '--rollback-test', '--apply'].includes(mode)) throw new Error('Invalid mode');
if (!process.env.DATABASE_URL?.includes('xijocumlwivhbmffrnlj')) throw new Error('Unexpected database target');
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const body = await readFile(new URL(`../supabase/migrations/${VERSION}_${NAME}.sql`, import.meta.url), 'utf8');
async function state(tx = sql) {
  const [row] = await tx`select
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='identity_directory_rows' and column_name='name_lookup_hash') as indexed,
    (select pg_get_constraintdef(oid) like '%identity%' from pg_constraint where conname='identity_directory_lookup_requests_search_type_check') as choice_type,
    (select relrowsecurity from pg_class where oid='public.identity_directory_rows'::regclass) as rls,
    has_table_privilege('anon','public.identity_directory_rows','select') as anon_read,
    has_table_privilege('authenticated','public.identity_directory_rows','select') as authenticated_read`;
  return row;
}
try {
  const before = await state();
  if (mode === '--rollback-test') {
    if (before.indexed) throw new Error('Migration is already present');
    const rollback = new Error('expected_rollback');
    try { await sql.begin(async tx => {
      await tx`set local lock_timeout='5s'`;
      await tx.unsafe(body);
      const inside = await state(tx);
      if (!inside.indexed || !inside.choice_type || !inside.rls || inside.anon_read || inside.authenticated_read) throw new Error('Security check failed');
      throw rollback;
    }); } catch (e) { if (e !== rollback) throw e; }
    if ((await state()).indexed) throw new Error('Rollback failed');
    console.log(JSON.stringify({ mode, rollback: true, security: true }));
  } else if (mode === '--apply') {
    if (!before.indexed) await sql.begin(async tx => {
      await tx`set local lock_timeout='5s'`;
      await tx.unsafe(body);
      await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${VERSION},${NAME},${[body]})`;
    });
    const after = await state();
    if (!after.indexed || !after.choice_type || !after.rls || after.anon_read || after.authenticated_read) throw new Error('Verification failed');
    console.log(JSON.stringify({ mode, ...after }));
  } else console.log(JSON.stringify({ mode, ...before }));
} finally { await sql.end({ timeout: 5 }); }
