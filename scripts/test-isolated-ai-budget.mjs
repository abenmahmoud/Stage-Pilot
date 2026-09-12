import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import postgres from 'postgres';
import {drizzle} from 'drizzle-orm/postgres-js';
const target=new URL(process.env.DATABASE_URL);
if(target.hostname!=='127.0.0.1'||target.port!=='55447'||target.pathname!=='/budget_recipe')throw new Error('Isolated empty budget recipe database required');
const client=postgres(target.toString(),{max:12}),school='88888888-0000-4000-8000-000000000001',foreign='88888888-0000-4000-8000-000000000002',user='88888888-0000-4000-8000-000000000003';
const state={db:drizzle(client),school,role:'superadmin',aal:'aal2',user:{id:user,email:'fixture@example.invalid',app_metadata:{role:'superadmin'}}};
globalThis.__budgetRecipe=state;
Object.assign(process.env,{SUPPORT_MEMBERSHIP_SOURCE:'database',AGENT_PILOT_PASSWORD_ONLY_UNTIL:'',OPENAI_BUDGET_GUARD_ENABLED:'true',OPENAI_BUDGET_PRICED_MODEL:'gpt-5.6-luna',OPENAI_DAILY_BUDGET_EUR:'1',OPENAI_SUPPORT_MAX_CALL_EUR:'0.04',OPENAI_CONTENT_MAX_CALL_EUR:'0.04',OPENAI_COMMUNICATION_MAX_CALL_EUR:'0.04',OPENAI_TRANSLATION_MAX_CALL_EUR:'0.04',OPENAI_SUPPORT_INPUT_EUR_PER_MILLION_TOKENS:'0.172533',OPENAI_SUPPORT_OUTPUT_EUR_PER_MILLION_TOKENS:'1.035197',OPENAI_PRICING_USD_PER_EUR:'1.1592',OPENAI_PRICING_FX_DATE:'2026-09-11',OPENAI_PRICING_VERIFIED_AT:'2026-09-12'});
async function bundle(file){
  const result=await build({entryPoints:[file],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,logLevel:'silent',plugins:[{name:'isolated-boundaries',setup(b){
    b.onLoad({filter:/db[\\/]index\.ts$/},()=>({contents:'export const db=globalThis.__budgetRecipe.db;',loader:'js'}));
    b.onLoad({filter:/_shared[\\/]institution-context\.ts$/},()=>({contents:'export async function requireConfiguredInstitution(){return {id:globalThis.__budgetRecipe.school};}',loader:'js'}));
    b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'supabase-fixture',namespace:'fixture'}));
    b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export function createClient(){return {auth:{async getUser(){return {data:{user:globalThis.__budgetRecipe.user},error:null};},mfa:{async getAuthenticatorAssuranceLevel(){return {data:{currentLevel:globalThis.__budgetRecipe.aal},error:null};}}}};}`,loader:'js'}));
  }}]});
  const m={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),m,m.exports);return m.exports;
}
function res(){return {statusCode:200,headersSent:false,headers:{},setHeader(k,v){this.headers[k]=v;},status(v){this.statusCode=v;return this;},json(body){this.body=body;return this;}};}
try{
  const [{empty}]=await client`select not exists(select from information_schema.tables where table_schema='public') as empty`;assert(empty,'Use a fresh isolated database; never overwrite a populated database');
  await client.unsafe("create role anon;create role authenticated;create role service_role bypassrls;create table institutions(id uuid primary key,status text);create table institution_memberships(user_id uuid,institution_id uuid,role text,status text,service_codes text[]);");
  for(const name of ['20260830013502_create_agent_runtime_metrics.sql','20260901225812_create_agent_ai_budget_days.sql','20260912160352_agent_budget_reservations.sql'])await client.unsafe(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await client`insert into institutions values(${school},'pilot'),(${foreign},'pilot')`;
  await client`insert into institution_memberships values(${user},${school},'admin','active',array['referent_numerique'])`;
  const {reserveAgentAiDailyBudget:reserve,settleAgentAiBudget:settle}=await bundle('api/_shared/agent-ai-budget.ts');
  const ops=['support_assistant','content_assist','communication_assist','support_translation'];
  const results=await Promise.all(Array.from({length:60},(_,i)=>reserve(ops[i%4])));
  const allowed=results.filter(r=>r.status==='allowed');assert.equal(allowed.length,25,JSON.stringify(results));assert.equal(results.filter(r=>r.status==='exhausted').length,35);
  let [day]=await client`select * from agent_ai_budget_days`;assert.equal(Number(day.reserved_micros),1_000_000);
  await Promise.all(Array.from({length:20},()=>settle(allowed[0].reservationId,500)));
  [day]=await client`select * from agent_ai_budget_days`;assert.equal(Number(day.reserved_micros),960500,'settlement is idempotent');
  assert.equal((await reserve('support_assistant')).status,'exhausted','reservation cannot cross remaining balance');
  await Promise.all(allowed.slice(1).map(r=>settle(r.reservationId,500)));
  [day]=await client`select * from agent_ai_budget_days`;assert.equal(Number(day.reserved_micros),12500);
  const unknown=await reserve('support_translation');await settle(unknown.reservationId,null);
  [day]=await client`select * from agent_ai_budget_days`;assert.equal(Number(day.reserved_micros),52500,'unknown usage retains full envelope');
  process.env.OPENAI_TRANSLATION_MAX_CALL_EUR='0.001';assert.equal((await reserve('support_translation')).status,'unavailable','underpriced reservation blocked');process.env.OPENAI_TRANSLATION_MAX_CALL_EUR='0.04';
  for(const op of ops)await client`insert into agent_runtime_metrics(institution_id,operation,outcome,model,ai_attempted,used_ai,latency_ms,input_tokens,output_tokens) values(${school},${op},'model_success','gpt-5.6-luna',true,true,50,1000,100)`;
  await client`insert into agent_runtime_metrics(institution_id,operation,outcome,model,ai_attempted,latency_ms,input_tokens,output_tokens) values(${foreign},'support_assistant','model_success','gpt-5.6-luna',true,50,9000000,9000000),(${school},'support_assistant','provider_error','other-model',true,50,null,null)`;
  const handler=(await bundle('api/support/agent/budget.ts')).default;
  async function call({role='superadmin',anonymous=false,query={},method='GET',aal='aal2'}={}){state.user.app_metadata.role=role;state.aal=aal;const out=res();await handler({method,query,headers:anonymous?{}:{authorization:'Bearer fictitious'}},out);return out;}
  assert.equal((await call({anonymous:true})).statusCode,401);
  for(const role of ['administration','agent','proviseur','eleve','professeur'])assert.equal((await call({role})).statusCode,403,role);
  assert.equal((await call({aal:'aal1'})).statusCode,403,'superadmin still requires AAL2');
  assert.equal((await call({query:{institutionId:foreign}})).statusCode,400);
  assert.equal((await call({method:'POST'})).statusCode,405);
  const overview=await call();assert.equal(overview.statusCode,200,JSON.stringify(overview.body));assert.match(overview.headers['Cache-Control'],/no-store/);
  assert.equal(overview.body.guardStatus,'enabled');assert.equal(overview.body.period.calls,5);assert.equal(overview.body.period.measuredCalls,4);assert.equal(overview.body.period.unknownCalls,1);assert.equal(overview.body.period.estimatedCostMicros,1104);assert.equal(overview.body.operations.length,4);
  assert.equal(overview.body.today.committedMicros,52500);assert.equal(overview.body.today.settledMicros,12500);assert.equal(overview.body.today.pending,1);
  await client`update institution_memberships set status='suspended' where user_id=${user}`;assert.equal((await call()).statusCode,403,'revoked school membership blocks access');
  for(const role of ['anon','authenticated'])await assert.rejects(client.begin(async tx=>{await tx.unsafe(`set local role ${role}`);await tx`select * from agent_ai_budget_reservations`;}),{code:'42501'});
  await assert.rejects(client.begin(async tx=>{await tx.unsafe('set local role service_role');await tx`delete from agent_ai_budget_reservations`;}),{code:'42501'});
  await settle(unknown.reservationId,50000);
  assert.equal((await reserve('support_assistant')).status,'unavailable','an anomalous settlement suspends further calls');
  const [{count}]=await client`select count(*)::int as count from agent_ai_budget_reservations`;assert.equal(count,26,'suspended reservation rolled back');
  console.log(JSON.stringify({realPostgres:true,realRoleAndMembershipGuards:true,fictitiousAuthenticationProviderOnly:true,concurrentCalls:60,accepted:25,settlementExactlyOnce:true,unknownUsageReserved:true,underpricedRejected:true,superadminOnly:true,schoolRevocation:true,foreignSchoolExcluded:true,noStore:true,privateRls:true,externalSends:0}));
}finally{delete globalThis.__budgetRecipe;await client.end();}
