import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { dispatchSupportEmail, supportEmailEventKey, supportEmailErrorCode, assertSupportEmailAccess } from "../shared/support-email-dispatch.mjs";

if (process.argv.length !== 3 || process.argv[2] !== "--local-stack-only") throw new Error("local_stack_confirmation_required");
const db = postgres({ host: "127.0.0.1", port: 54322, database: "postgres", user: "postgres", password: "postgres", max: 8, prepare: false, connect_timeout: 5 });
const institutionId = randomUUID();
const requestId = randomUUID();
const base = { institution_id: institutionId, request_id: requestId, job_id: randomUUID(), job_type: "notify_requester_request_created", contact_id: randomUUID(), message_id: randomUUID() };
let checks = 0;
const check = (value, expected) => { assert.deepEqual(value, expected); checks++; };
try {
  await db`insert into institutions(id,slug,name,status) values (${institutionId}, ${`email-test-${institutionId}`}, 'Recette email fictive', 'draft')`;
  await db`insert into support_requests(id,institution_id,idempotency_key_hash,requester_type,requester_first_name,requester_last_name,beneficiary_type,category,subject,description,preferred_channel)
    values (${requestId},${institutionId},${randomUUID()},'parent','Fictif','Recette','self','autre','Recette fictive','Données fictives uniquement','email')`;
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const first = dispatchSupportEmail(db, base, async () => { calls++; entered(); await gate; return 'provider-fictitious-1'; });
  await started;
  const concurrent = await Promise.allSettled(Array.from({length:5}, () => dispatchSupportEmail(db, base, async () => { calls++; return 'unexpected'; })));
  check(concurrent.every(result => result.status === 'rejected' && result.reason.message === 'email_delivery_uncertain'), true);
  release();
  check(await first, 'provider-fictitious-1');
  check(await dispatchSupportEmail(db, {...base,job_id:randomUUID()},async()=>{calls++;return 'unexpected';}), 'provider-fictitious-1');
  check(calls,1);
  check(supportEmailEventKey(base), supportEmailEventKey({...base,job_id:randomUUID()}));
  const crashed = {...base,job_type:'send_requester_reply',message_id:randomUUID(),job_id:randomUUID()};
  await assert.rejects(dispatchSupportEmail(db,crashed,async()=>{calls++;throw new Error('network lost after acceptance');}), /email_delivery_uncertain/);checks++;
  await assert.rejects(dispatchSupportEmail(db,crashed,async()=>{calls++;return 'unexpected';}), /email_delivery_uncertain/);checks++;
  check(calls,2);
  const rejected = {...crashed,message_id:randomUUID(),job_id:randomUUID()};
  await assert.rejects(dispatchSupportEmail(db,rejected,async()=>{const error=new Error('too_many_requests');error.name='BrevoRejectedError';throw error;}), /too_many_requests/);checks++;
  check(await dispatchSupportEmail(db,rejected,async()=> 'provider-after-rejection'),'provider-after-rejection');
  const failedReceipt = {...crashed,message_id:randomUUID(),job_id:randomUUID()};
  const faulty = (strings,...values) => {
    if(strings.join('').includes("set state = 'sent'")) throw new Error('storage unavailable');
    return db(strings,...values);
  };
  await assert.rejects(dispatchSupportEmail(faulty,failedReceipt,async()=>{calls++;return 'provider-before-db-failure';}), /storage unavailable/); checks++;
  await assert.rejects(dispatchSupportEmail(db,failedReceipt,async()=>{calls++;return 'unexpected';}), /email_delivery_uncertain/);checks++;
  check(calls,3);
  const unavailable = () => { throw new Error('reservation database unavailable'); };
  await assert.rejects(dispatchSupportEmail(unavailable,base,async()=>{calls++;return 'unexpected';}), /reservation database unavailable/);checks++;
  check(calls,3);
  await assert.rejects(assertSupportEmailAccess(db,{...base,access_token:'fictitious'}),/support_access_expired/);checks++;
  check(supportEmailErrorCode(new Error('SQL contains private data')), 'email_worker_failed');
  check((await db`select count(*)::int as n from support_email_dispatches where institution_id=${institutionId}`)[0].n,4);
  const [rls] = await db`select relrowsecurity,relforcerowsecurity,has_table_privilege('anon','public.support_email_dispatches','SELECT') as anon_read from pg_class where oid='public.support_email_dispatches'::regclass`;
  check(rls,{relrowsecurity:true,relforcerowsecurity:true,anon_read:false});
} finally {
  await db`delete from support_requests where id=${requestId} and institution_id=${institutionId}`;
  await db`delete from institutions where id=${institutionId}`;
  check((await db`select count(*)::int as n from support_email_dispatches where institution_id=${institutionId}`)[0].n,0);
  await db.end();
}
console.log(JSON.stringify({checks,provider:'fake callback only',database:'loopback',residue:0}));
