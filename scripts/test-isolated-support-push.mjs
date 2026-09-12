import {addPushFlashSchema} from './fixtures/push-flash-schema.mjs';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFile } from 'node:fs/promises';
import { dispatchSupportPush } from '../workers/support-push-worker.mjs';
const target = new URL(process.env.DATABASE_URL);
if (target.hostname !== '127.0.0.1' || target.port !== '55446' || target.pathname !== '/push_recipe') throw new Error('Isolated push recipe target required');
const sql = postgres(target.toString(), { max: 1 });
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
try {
  await sql.unsafe(`do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end $$;
    create schema auth;
    create table auth.users(id uuid primary key,raw_app_meta_data jsonb,banned_until timestamptz);
    create table public.institutions(id uuid primary key,status text);
    create table public.institution_memberships(user_id uuid,institution_id uuid,status text,role text,service_codes text[]);
    create table public.support_device_sessions(id uuid primary key,revoked_at timestamptz,expires_at timestamptz,access_contact_id uuid);
    create table public.support_contacts(id uuid primary key,request_id uuid,channel text,usage_scope text,disabled_at timestamptz);
    create table public.support_requests(id uuid primary key,institution_id uuid,assigned_team text);
    create table public.support_session_requests(session_id uuid,request_id uuid);
    create table public.support_events(id bigint generated always as identity primary key,request_id uuid,event_type text,actor_type text,created_at timestamptz default now());`);
  await sql.unsafe(await readFile(new URL('../supabase/migrations/20260909000432_support_web_push.sql',import.meta.url),'utf8'));
  await addPushFlashSchema(sql);
  await sql`insert into public.institutions values (${id(1)},'pilot'),(${id(2)},'pilot')`;
  await sql`insert into auth.users values (${id(3)},' {"role":"agent"}',null),(${id(4)},'{"role":"agent"}',null)`;
  await sql`insert into public.institution_memberships values (${id(3)},${id(1)},'active','agent',array['intendance']),(${id(4)},${id(1)},'active','agent',array['ddfpt'])`;
  await sql`insert into public.support_device_sessions values(${id(5)},null,now()+interval '1 day',null),(${id(6)},now(),now()+interval '1 day',null),(${id(15)},null,now()+interval '1 day',${id(16)})`;
  await sql`insert into public.support_contacts values(${id(16)},${id(7)},'email','support',now())`;
  await sql`insert into public.support_requests(id,institution_id,assigned_team) values(${id(7)},${id(1)},'intendance'),(${id(8)},${id(2)},'intendance')`;
  await sql`insert into public.support_session_requests values(${id(5)},${id(7)}),(${id(6)},${id(7)}),(${id(15)},${id(7)})`;
  const subscription = {endpoint:'https://fcm.googleapis.com/fcm/send/fictitious',keys:{p256dh:'B'.repeat(87),auth:'A'.repeat(22)}};
  for (const [n,session,user] of [[9,id(5),null],[10,id(6),null],[11,null,id(3)],[12,null,id(4)],[17,id(15),null]]) {
    await sql`insert into public.support_push_subscriptions(id,institution_id,session_id,user_id,endpoint_hash,subscription)
      values(${id(n)},${id(1)},${session},${user},${'fake-'+n},${sql.json(subscription)})`;
  }
  await sql`insert into public.support_events(request_id,event_type,actor_type) values(${id(7)},'reply.queued','agent'),(${id(7)},'request.created','requester'),(${id(8)},'request.created','requester')`;
  const notices=[];
  const first=await dispatchSupportPush(sql,async(_sub,body)=>notices.push(JSON.parse(body)));
  assert.equal(first.sent,2,'one matching service and one valid requester session');
  assert.equal(notices.filter(n=>n.destination==='/?view=agent').length,1);
  assert.equal((await dispatchSupportPush(sql,async()=>assert.fail('duplicate push'))).sent,0);
  // A later commit with an older sequence must still be noticed.
  await sql`insert into public.support_events(request_id,event_type,actor_type) values(${id(7)},'message.received','requester')`;
  const failed=await dispatchSupportPush(sql,async()=>{throw new Error('uncertain_delivery')});
  assert.equal(failed.uncertain,1);
  await dispatchSupportPush(sql,async()=>assert.fail('uncertain delivery must not be retried'));
  await sql`update public.institution_memberships set status='suspended' where user_id=${id(3)}`;
  await sql`insert into public.support_events(request_id,event_type,actor_type) values(${id(7)},'message.received','requester')`;
  await dispatchSupportPush(sql,async()=>assert.fail('revoked service must not receive push'));
  const [{rls}] = await sql`select count(*)::int as rls from pg_class where relname in ('support_push_subscriptions','support_push_deliveries') and relrowsecurity`;
  assert.equal(rls,2);
  const [{allowed}] = await sql`select has_table_privilege('anon','public.support_push_subscriptions','select') or has_table_privilege('authenticated','public.support_push_subscriptions','select') as allowed`;
  assert.equal(allowed,false);
  console.log(JSON.stringify({isolated:true,firstSent:first.sent,duplicateSent:0,revokedSessionSent:0,revokedContactSent:0,wrongServiceSent:0,otherInstitutionSent:0,uncertainRecorded:1,uncertainRetried:0,rlsTables:rls,externalSends:0}));
} finally { await sql.end(); }
