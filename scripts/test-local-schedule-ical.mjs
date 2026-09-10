// Disposable PostgreSQL only. Does not load any environment or contact production.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import postgres from 'postgres';
import { parseScheduleIcalBytes } from '../workers/schedule-ical-parser.mjs';
import { persistIcalReview, applyQueuedIcalCalendar, suggestIcalSubjects } from '../workers/schedule-ical-staging.mjs';
import { encryptIdentityVaultPayload } from '../workers/identity-directory-vault.mjs';

if (process.argv.length !== 3 || process.argv[2] !== '--disposable-ical-only') throw new Error('Disposable test confirmation required');
const sql = postgres('postgresql://postgres:ical-test-only@127.0.0.1:55432/postgres', { max: 2, prepare: false, onnotice: () => {} });
try {
  const [{ tables }] = await sql`select count(*)::int as tables from information_schema.tables where table_schema='public'`;
  assert.equal(tables, 0, 'Refuse an existing database');
  await sql.unsafe(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table public.institutions(id uuid primary key);
    create function public.support_set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
    create schema pgmq; create function pgmq.delete(text,bigint) returns boolean language sql as $$ select true $$;
    create table public.identity_directory_imports(id uuid primary key,institution_id uuid,status text);
    create table public.identity_directory_rows(id uuid primary key,institution_id uuid,import_id uuid,record_type text,person_ref text,person_type text,validation_status text,class_ref text,valid_from date,valid_until date);
    create table public.identity_directory_private_rows(institution_id uuid,import_id uuid,person_ref text,key_version text,payload_schema smallint,iv text,auth_tag text,ciphertext text);
  `);
  const directory = new URL('../supabase/migrations/', import.meta.url);
  const files = (await readdir(directory)).filter(f => f.includes('schedule') && !f.includes('document_scan_queue'));
  const migrationConnection = await sql.reserve();
  try { for (const name of files.sort()) await migrationConnection.unsafe(await readFile(new URL(name, directory), 'utf8')); }
  finally { migrationConnection.release(); }
  const institution = randomUUID(), actor = randomUUID(), sourceId = randomUUID(), directoryId = randomUUID();
  await sql`insert into institutions(id) values(${institution})`;
  await sql`insert into auth.users(id) values(${actor})`;
  await sql`insert into identity_directory_imports values(${directoryId},${institution},'active')`;
  await sql`insert into identity_directory_rows values(${randomUUID()},${institution},${directoryId},'person','ELEVE-TEST','student','valid','2TEST',null,null)`;
  await sql`insert into identity_directory_rows values(${randomUUID()},${institution},${directoryId},'person','ELEVE-TEST-3','student','warning','3TEST',null,null)`;
  await sql`insert into identity_directory_rows values(${randomUUID()},${institution},${directoryId},'person','PROF-TEST','staff','warning',null,null,null)`;
  const key=randomBytes(32); process.env.IDENTITY_DIRECTORY_ENCRYPTION_KEY_V1=key.toString('base64');
  const envelope=encryptIdentityVaultPayload({value:{firstName:'Camille',lastName:'Exemple',academicEmail:'camille@example.test',personalEmail:'',phone:''},institutionId:institution,importId:directoryId,personRef:'PROF-TEST',config:{version:'v1',key}});
  await sql`insert into identity_directory_private_rows values(${institution},${directoryId},'PROF-TEST',${envelope.keyVersion},${envelope.payloadSchema},${envelope.iv},${envelope.authTag},${envelope.ciphertext})`;
  const matches=await suggestIcalSubjects(sql,{institution_id:institution,source_kind:'classes'},[{label:'2TEST',events:[{}]},{label:'3TEST',events:[{}]}]);
  assert.deepEqual(matches.map(c=>c.suggestedRef),['2TEST','3TEST'],'Class digits remain significant');
  const teacher=await suggestIcalSubjects(sql,{institution_id:institution,source_kind:'teachers'},[{label:'EXEMPLE CAMILLE',events:[{}]}]);
  assert.equal(teacher[0].suggestedRef,'PROF-TEST','Non-blocking directory warnings do not hide known teachers');
  await sql`insert into schedule_source_versions(id,institution_id,source_kind,source_format,school_year,version,title,purpose_description,effective_from,effective_until,fresh_until,
      original_name,mime_type,size_bytes,storage_path,status,uploaded_by)
    values(${sourceId},${institution},'classes','ical_import','2026-2027',1,'Calendriers fictifs','Recette isolée sans données de personnes réelles','2026-09-01','2027-07-03','2027-07-03',
      'fictif.ics','text/calendar',1000,${`fictif/${sourceId}.ics`},'processing',${actor})`;
  const events = Array.from({length:1200}, (_, i) => {
    const start = new Date(Date.UTC(2026,8,1,6) + i*3600000);
    const end = new Date(start.getTime()+1800000);
    const stamp = d => d.toISOString().replace(/[-:]/g,'').replace('.000','');
    return `BEGIN:VEVENT\r\nUID:fixture-${i}\r\nDTSTART:${stamp(start)}\r\nDTEND:${stamp(end)}\r\nSUMMARY:Mathematiques - PROF FICTIF - 30\r\nLOCATION:B12\r\nCATEGORIES:Cours\r\nEND:VEVENT\r\n`;
  }).join('');
  const calendar = (name, events) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-WR-CALNAME:Calendrier - ${name} - du 01 septembre 2026 au 03 juillet 2027\r\n${events}END:VCALENDAR\r\n`;
  const parsed = parseScheduleIcalBytes(Buffer.from(calendar('2TEST',events)+calendar('INCONNU','')));
  await persistIcalReview(sql,{id:sourceId,institution_id:institution,source_kind:'classes',uploaded_by:actor},parsed,1);
  const candidates=await sql`select * from schedule_ical_candidates order by calendar_number`;
  assert.equal(candidates[0].suggested_ref,'2TEST'); assert.equal(candidates[1].match_status,'empty');
  assert.equal(await applyQueuedIcalCalendar(sql,candidates[0].id),'already_applied');
  await assert.rejects(sql`update schedule_ical_candidates set status='queued',decision='include',subject_ref='2TEST' where id=${candidates[0].id}`);
  await sql`update schedule_ical_candidates set status='queued',decision='include',subject_ref='2TEST',approved_by=${actor},approved_at=now() where id=${candidates[0].id}`;
  await Promise.all([applyQueuedIcalCalendar(sql,candidates[0].id),applyQueuedIcalCalendar(sql,candidates[0].id)]);
  assert.equal((await sql`select count(*)::int as n from schedule_slots`)[0].n,1200,'Concurrent workers do not duplicate');
  await sql`update schedule_ical_candidates set status='queued',decision='exclude',approved_by=${actor},approved_at=now() where id=${candidates[1].id}`;
  assert.equal(await applyQueuedIcalCalendar(sql,candidates[1].id),'ical_calendar_excluded');
  assert.equal((await sql`select count(*)::int as n from schedule_page_indexes where review_status='verified'`)[0].n,2);
  await assert.rejects(sql`update schedule_ical_candidates set events='[]'::jsonb where id=${candidates[0].id}`);
  await assert.rejects(sql.begin(async tx=>{ await tx`set local role anon`; return tx`select * from schedule_ical_candidates`; }));
  await sql`update schedule_source_versions set status='approved',approved_by=${actor},approved_at=now() where id=${sourceId}`;
  await sql`update schedule_source_versions set status='active',activated_by=${actor},activated_at=now() where id=${sourceId}`;
  await assert.rejects(sql`update schedule_slots set room_code='B13'`);
  console.log(JSON.stringify({ok:true,calendars:2,courses:1200,verified:'schema, worker, annual import, explicit exclusion, concurrent retries, anonymous denial, immutable source'}));
} finally { await sql.end(); }
