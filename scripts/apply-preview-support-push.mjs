import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
const version='20260909000432';
const name='support_web_push';
const mode=process.argv[2]??'--check';
if (!['--check','--apply'].includes(mode)) throw new Error('Use --check or --apply');
const target=new URL(process.env.DATABASE_URL);
if (![target.hostname,target.username].some(value=>value.includes('xijocumlwivhbmffrnlj'))) throw new Error('This tool is locked to the active lycée pilot database');
const sql=postgres(target.toString(),{prepare:false,max:1});
try {
  const [before]=await sql`select exists(select 1 from supabase_migrations.schema_migrations where version=${version}) as recorded,
    to_regclass('public.support_push_subscriptions') is not null as present`;
  if (before.recorded!==before.present) throw new Error('Inconsistent push migration state');
  if (mode==='--apply' && !before.recorded) {
    const migration=await readFile(new URL(`../supabase/migrations/${version}_${name}.sql`,import.meta.url),'utf8');
    await sql.begin(async tx=>{
      await tx.unsafe(migration);
      await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${version},${name},${[migration]})`;
    });
  }
  const [state]=await sql`select count(*)::int as tables,count(*) filter(where relrowsecurity)::int as rls from pg_class where relname in ('support_push_subscriptions','support_push_deliveries') and relnamespace='public'::regnamespace`;
  if (mode==='--apply' && (state.tables!==2||state.rls!==2)) throw new Error('Push schema verification failed');
  console.log(JSON.stringify({target:'lycee-pilot',mode,...state}));
} finally {await sql.end();}
