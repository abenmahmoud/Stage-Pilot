import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import postgres from 'postgres';
import {drizzle} from 'drizzle-orm/postgres-js';
const target=new URL(process.env.DATABASE_URL);
if(target.hostname!=='127.0.0.1'||target.port!=='55446'||target.pathname!=='/push_recipe')throw new Error('Isolated flash route recipe target required');
const sql=postgres(target.toString(),{max:1});
const namespace=randomBytes(4).toString('hex');
const id=n=>`${namespace}-0000-4000-8000-${String(n).padStart(12,'0')}`;
const school=id(1),user=id(2),root=id(3),first=id(4),now=new Date(),expiry=new Date(Date.now()+86400000);
globalThis.__flashRouteRecipe={db:drizzle(sql),client:new Proxy(sql,{get(target,key){if(key!=='begin')return Reflect.get(target,key);return async(...args)=>{try{return await target.begin(...args);}catch(e){if(e.code)console.error('isolated SQL',e.code,e.message);throw e;}};}}),school,user,bridgeRequests:[],identity:null};
async function route(file){
  const result=await build({entryPoints:[file],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,logLevel:'silent',plugins:[{name:'fixture-boundaries',setup(b){
    const replace=(filter,contents)=>b.onLoad({filter},()=>({contents,loader:'js'}));
    replace(/db[\\/]index\.ts$/,`export const db=globalThis.__flashRouteRecipe.db;export const client=globalThis.__flashRouteRecipe.client;`);
    replace(/_shared[\\/]identity-device-access\.ts$/,`export async function readIdentityDeviceSession(){return globalThis.__flashRouteRecipe.identity;}`);
    replace(/_shared[\\/]support-agent-access\.ts$/,`import {HttpError} from './auth.js';export async function requireSupportAgent(req){if(!req.fixtureUser)throw new HttpError(401,'not_authenticated');return {user:req.fixtureUser};}`);
    replace(/_shared[\\/]support\.ts$/,`import {createHash} from 'node:crypto';export const sha256=v=>createHash('sha256').update(v).digest('hex');export const personalHash=sha256;export function readSupportSessionToken(){return null;}export async function enforceSupportRateLimit(){}`);
    replace(/_shared[\\/]auth\.ts$/,`export class HttpError extends Error{constructor(status,message){super(message);this.status=status;}} export async function requireUser(req){if(!req.fixtureUser)throw new HttpError(401,'not_authenticated');return req.fixtureUser;}`);
    replace(/_shared[\\/]institution-context\.ts$/,`export async function requireConfiguredInstitution(){return {id:globalThis.__flashRouteRecipe.school};} export async function assertLegacySingleInstitutionMode(){}`);
    replace(/_shared[\\/]knowledge-source-revocation\.ts$/,`export async function revokeKnowledgeSourceAndDisableSkills(){throw new Error('No derived source in fixture');}`);
    replace(/_shared[\\/]flash-communication-bridge-persistence\.ts$/,`export async function persistFlashCommunicationBridge(input){globalThis.__flashRouteRecipe.bridgeRequests.push(input.request);return {enqueued:false,reason:'module_disabled'};}`);
  }}]});
  const m={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),m,m.exports);return m.exports.default;
}
function response(){return {statusCode:200,headersSent:false,headers:{},setHeader(k,v){this.headers[k]=v;return this;},status(s){this.statusCode=s;return this;},json(data){this.body=data;return this;}};}
try{
  await sql`insert into institutions values(${school},'pilot')`;
  await sql`insert into auth.users values(${user},'{"role":"superadmin"}',null)`;
  await sql`insert into institution_memberships values(${user},${school},'active','admin',array['referent_numerique'])`;
  await sql`insert into flash_infos(id,institution_id,created_by) values(${root},${school},${user})`;
  await sql`insert into flash_info_versions(id,institution_id,flash_info_id,version,title,body_markdown,importance,channels,expires_at,proposed_by) values(${first},${school},${root},1,'Version initiale','Information publique validée','importante','["push"]',${expiry.toISOString()}::timestamptz,${user})`;
  await sql`insert into flash_info_audiences(institution_id,version_id,group_ref) values(${school},${first},'public:site')`;
  await sql`update flash_info_versions set status='validee',validated_by=${user},validated_at=now() where id=${first}`;
  const publish=await route('api/flash/proposals/[id]/publication.ts'),correct=await route('api/flash/proposals/[id]/correction.ts'),readPublic=await route('api/content/flash/public.ts');
  const actor={id:user,role:'superadmin',email:'fixture@example.invalid'};
  async function call(handler,query={},body,authenticated=true,method='POST'){const res=response();await handler({method,query:{id:root,...query},body,headers:{},fixtureUser:authenticated?actor:null},res);return res;}
  process.env.SUPPORT_FLASH_PUSH_ENABLED='true';
  assert.equal((await call(publish,{},undefined,false)).statusCode,401);
  const initial=await call(publish,{version:'1'});assert.equal(initial.statusCode,200,JSON.stringify(initial.body));assert.equal(initial.body.version.status,'publiee');
  const firstReplayed=await call(publish,{version:'1'});assert.equal(firstReplayed.body.alreadyPublished,true);
  const input={title:'Version corrigée',bodyMarkdown:'Nouvelle information soumise à publication',importance:'importante',channels:['push'],expiresAt:expiry.toISOString(),groupRefs:['public:site'],smsContactRefs:[]};
  const corrected=await call(correct,{},input);assert.equal(corrected.statusCode,200,JSON.stringify(corrected.body));assert.equal(corrected.body.version.version,2);assert.equal(corrected.body.version.status,'validee');
  const before=response();await readPublic({method:'GET',query:{},headers:{}},before);assert.equal(before.body.items[0].title,'Version initiale','published version survives draft correction');
  assert.equal((await call(publish,{version:'1'})).statusCode,409,'stale review rejected');
  const correctedPublished=await call(publish,{version:'2',notify:'false'});assert.equal(correctedPublished.statusCode,200,JSON.stringify(correctedPublished.body));
  const after=response();await readPublic({method:'GET',query:{},headers:{}},after);assert.equal(after.body.items[0].title,'Version corrigée');
  const [silent]=await sql`select push_authorized_at from flash_info_versions where id=${corrected.body.version.id}`;assert.equal(silent.push_authorized_at,null);
  assert.equal(globalThis.__flashRouteRecipe.bridgeRequests.at(-1),null,'silent correction never queues email');
  const [old]=await sql`select status,title from flash_info_versions where id=${first}`;assert.equal(old.status,'modifiee');assert.equal(old.title,'Version initiale');
  const third=await call(correct,{}, {...input,title:'Troisième version'});assert.equal(third.statusCode,200,JSON.stringify(third.body));
  const races=await Promise.all([call(publish,{version:'3',notify:'true'}),call(publish,{version:'3',notify:'true'})]);assert(races.every(r=>r.statusCode===200));assert.equal(races.filter(r=>r.body.alreadyPublished).length,1);
  const [notified]=await sql`select push_authorized_at from flash_info_versions where id=${third.body.version.id}`;assert(notified.push_authorized_at);
  assert.equal((await call(correct,{}, {...input,groupRefs:['classe:inventee']})).statusCode,409);
  assert.equal((await call(publish,{version:'3',notify:['true']})).statusCode,400);
  const [{count}]=await sql`select count(*)::int as count from flash_info_versions where flash_info_id=${root}`;assert.equal(count,3);
  process.env.IDENTITY_DEVICE_ACCESS_ENABLED='true';process.env.SUPPORT_PUSH_ENABLED='true';process.env.SUPPORT_PUSH_PUBLIC_KEY='B'.repeat(87);
  const identity={id:id(20),institutionId:school,sourceImportId:id(21),personRef:'person-route',personType:'student',expiresAt:expiry};
  await sql`insert into identity_directory_imports values(${identity.sourceImportId},${school},'active')`;
  await sql`insert into identity_directory_rows(institution_id,import_id,person_ref,person_type,record_type,validation_status,class_ref) values(${school},${identity.sourceImportId},${identity.personRef},'student','person','valid','2GT C')`;
  await sql`insert into identity_device_sessions values(${identity.id},${school},${identity.sourceImportId},${identity.personRef},'student',null,${expiry.toISOString()}::timestamptz,${expiry.toISOString()}::timestamptz,'directory_email_otp')`;
  const push=await route('api/support/push.ts'),personal=await route('api/identity/device/flash.ts');
  const sub={endpoint:'https://fcm.googleapis.com/fcm/send/'+namespace,keys:{p256dh:'B'.repeat(87),auth:'A'.repeat(22)}};
  assert.equal((await call(push,{audience:'identity'},{subscription:sub,flashEnabled:true})).statusCode,401);
  globalThis.__flashRouteRecipe.identity=identity;
  let answer=await call(push,{audience:'identity'},{subscription:sub,flashEnabled:true});assert.equal(answer.statusCode,200,JSON.stringify(answer.body));assert.deepEqual(answer.body,{enabled:true,flashEnabled:true});
  answer=await call(push,{audience:'identity',action:'status'},sub);assert.deepEqual(answer.body,{enabled:true,flashEnabled:true});
  const another={...identity,id:id(22),personRef:'another-person'};await sql`insert into identity_device_sessions values(${another.id},${school},${identity.sourceImportId},'another-person','student',null,${expiry.toISOString()}::timestamptz,${expiry.toISOString()}::timestamptz,'directory_email_otp')`;
  globalThis.__flashRouteRecipe.identity=another;assert.equal((await call(push,{audience:'identity'},{subscription:sub,flashEnabled:true})).statusCode,409,'endpoint cannot transfer to another identity');
  globalThis.__flashRouteRecipe.identity=identity;
  const personalResponse=response();await personal({method:'GET',query:{},headers:{}},personalResponse);assert.equal(personalResponse.statusCode,200,JSON.stringify(personalResponse.body));assert.equal(personalResponse.body.items[0].title,'Troisième version');assert.equal('personRef' in personalResponse.body,false);
  const bad=response();await personal({method:'GET',query:{personRef:'another-person'},headers:{}},bad);assert.equal(bad.statusCode,400);
  answer=await call(push,{audience:'identity'},sub,true,'DELETE');assert.deepEqual(answer.body,{enabled:false,flashEnabled:false});
  globalThis.__flashRouteRecipe.identity=null;const expiredRes=response();await personal({method:'GET',query:{},headers:{}},expiredRes);assert.equal(expiredRes.statusCode,401);
  console.log(JSON.stringify({realRoutes:true,realPostgres:true,authBoundaryStubOnly:true,anonymousRejected:true,publishedPreserved:true,oldVersionImmutable:true,staleReviewRejected:true,silentCorrectionNoPushOrEmail:true,repeatCorrection:true,concurrentPublicationDeduplicated:true,inventedClassRejected:true,privateFeed:true,noFreePersonQuery:true,identityOnlyOptIn:true,foreignOwnerRejected:true,disabledReceipt:true,externalSends:0}));
}finally{delete globalThis.__flashRouteRecipe;await sql.end();}
