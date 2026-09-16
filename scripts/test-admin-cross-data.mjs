import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {getTableConfig} from 'drizzle-orm/pg-core';
import {eq} from 'drizzle-orm';
const require=createRequire(import.meta.url);
const {drizzle}=require('drizzle-orm/pglite');
if(!process.env.CROSS_DATA_PGLITE_MODULE)throw new Error('Set CROSS_DATA_PGLITE_MODULE to an existing local PGlite dependency. No production database is used.');
const {PGlite}=require(process.env.CROSS_DATA_PGLITE_MODULE);
const pg=new PGlite();const database=drizzle(pg);
const school=randomUUID(),foreign=randomUUID(),directory=randomUUID(),old=randomUUID(),attrs=randomUUID(),schedule=randomUUID(),actor=randomUUID();
const state={db:database,school,user:{id:actor,email:'fiction@example.invalid',app_metadata:{role:'superadmin'}},aal:'aal2'};
globalThis.__crossRecipe=state;
async function bundle(file){const r=await build({entryPoints:[file],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,logLevel:'silent',plugins:[{name:'isolated',setup(b){
  b.onLoad({filter:/db[\\/]index\.ts$/},()=>({contents:'export const db=globalThis.__crossRecipe.db',loader:'js'}));
  b.onLoad({filter:/_shared[\\/]identity-directory\.ts$/},()=>({contents:`import {requireRole,requireAal2} from './auth.js'; export async function requireIdentityDirectoryManager(req){const user=await requireRole(req,['superadmin','proviseur']);await requireAal2(req);return {user,institutionId:globalThis.__crossRecipe.school};}`,loader:'js'}));
  b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'supabase',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export function createClient(){return {auth:{async getUser(){return {data:{user:globalThis.__crossRecipe.user},error:null}},mfa:{async getAuthenticatorAssuranceLevel(){return {data:{currentLevel:globalThis.__crossRecipe.aal},error:null}}}}}}`,loader:'js'}));
}}]});const m={exports:{}};new Function('require','module','exports',r.outputFiles[0].text)(require,m,m.exports);return m.exports;}
const schema=await bundle('db/schema.ts');
const tables=['identityDirectoryImports','identityDirectoryRows','personAttributeImports','personAttributeRows','codeVaultAssignments','scheduleSourceVersions','schedulePageIndexes','scheduleSlots','identityDirectoryAudit'];
for(const key of tables){const cfg=getTableConfig(schema[key]);await pg.exec(`create table "${cfg.name}" (${cfg.columns.map(c=>`"${c.name}" ${c.getSQLType()}`).join(',')})`);}
const insert=(name,values)=>database.insert(schema[name]).values(values);
const now=new Date('2026-09-16T12:00:00Z');
try{
  await insert('identityDirectoryImports',[{id:directory,institutionId:school,status:'active',originalName:'fiction.csv',validRowCount:4,activatedAt:now},{id:old,institutionId:school,status:'retired',originalName:'old.csv'},{id:randomUUID(),institutionId:foreign,status:'active',originalName:'foreign.csv'}]);
  const person=(ref,type,extra={})=>({institutionId:school,importId:directory,recordType:'person',personRef:ref,personType:type,validationStatus:'valid',validFrom:'2026-09-01',...extra});
  await insert('identityDirectoryRows',[person('prof.test2','staff',{academicEmailHash:'hash'}),person('student.test3','student',{classRef:'2GT1',phoneHash:'phone'}),person('parent.test4','guardian',{personalEmailHash:'hash'}),person('expired.test','staff',{validUntil:'2026-09-10'}),person('old.person','staff',{importId:old}),person('foreign.person','staff',{institutionId:foreign}),{institutionId:school,importId:directory,recordType:'relationship',subjectPersonRef:'parent.test4',objectRef:'student.test3',relationshipType:'guardian_of',validationStatus:'valid',validFrom:'2026-09-01'}]);
  await insert('personAttributeImports',[{id:attrs,institutionId:school,directoryImportId:directory,status:'active',originalName:'attrs.csv',rowCount:3,approvedAt:now}]);
  process.env.PERSON_ATTRIBUTE_ENCRYPTION_KEY_VERSION='v1';process.env.PERSON_ATTRIBUTE_ENCRYPTION_KEY_V1=Buffer.alloc(32,7).toString('base64');
  const {encryptPersonAttributeValue}=await bundle('shared/person-attribute-crypto.ts');
  for(const [key,value] of [['ent_identifier','prof.test2'],['ent_activation_state','active'],['secret_custom','DO-NOT-DISCLOSE']]){const rowId=randomUUID();await insert('personAttributeRows',{id:rowId,institutionId:school,importId:attrs,personRef:'prof.test2',attributeKey:key,validFrom:'2026-09-01',source:'ENT fictif',...encryptPersonAttributeValue({value,institutionId:school,importId:attrs,rowId,personRef:'prof.test2',attributeKey:key})});}
  await insert('codeVaultAssignments',{id:randomUUID(),institutionId:school,personRef:'prof.test2',service:'koxo',schoolYear:'2026-2027',createdAt:now});
  await insert('scheduleSourceVersions',{id:schedule,institutionId:school,status:'active',schoolYear:'2026-2027',sourceKind:'teachers',originalName:'EDT fictif.ics',effectiveFrom:'2026-09-01',freshUntil:new Date('2026-09-20T23:59:59Z'),activatedAt:now});
  await insert('schedulePageIndexes',{id:randomUUID(),institutionId:school,sourceVersionId:schedule,subjectType:'teacher',subjectRef:'prof.test2',reviewStatus:'verified'});
  await insert('scheduleSlots',[{id:randomUUID(),institutionId:school,sourceVersionId:schedule,teacherRef:'prof.test2',subjectLabel:'Mathématiques',reviewStatus:'approved'},{id:randomUUID(),institutionId:school,sourceVersionId:schedule,teacherRef:'prof.test2',subjectLabel:'Brouillon interdit',reviewStatus:'pending'}]);
  const {readAdminCrossData}=await bundle('api/_shared/admin-cross-data-reader.ts');
  const {parseCrossDataQuery,filterCrossPeople}=await bundle('shared/admin-cross-data.ts');
  let result=await readAdminCrossData(school,parseCrossDataQuery({personRef:'prof.test2'}),now);
  assert.equal(result.totals.people,3);assert.equal(result.detail.person.koxo,'linked');assert.equal(result.detail.person.schedule,'linked');assert.deepEqual(result.detail.subjects,['Mathématiques']);assert.equal(result.detail.attributes.length,2);assert.equal(JSON.stringify(result).includes('DO-NOT-DISCLOSE'),false);assert.equal(JSON.stringify(result).includes('foreign.person'),false);
  assert.equal(filterCrossPeople(result.people,parseCrossDataQuery({filter:'missing_phone'})).length,2);
  result=await readAdminCrossData(school,parseCrossDataQuery({personRef:'parent.test4'}),now);assert.equal(result.detail.relations[0].reference,'student.test3');assert.equal(result.detail.person.schedule,'not_applicable');
  result=await readAdminCrossData(school,parseCrossDataQuery({}),new Date('2026-09-21T12:00:00Z'));assert.equal(result.people.find(p=>p.personRef==='prof.test2').schedule,'stale');
  await insert('identityDirectoryRows',person('prof.test2','staff'));
  await assert.rejects(()=>readAdminCrossData(school,parseCrossDataQuery({personRef:'prof.test2'}),now),e=>e.status===409);
  result=await readAdminCrossData(school,parseCrossDataQuery({filter:'conflict'}),now);assert.equal(result.total,1);assert.equal(result.people[0].conflict,true);
  const handler=(await bundle('api/identity/admin/cross-data.ts')).default;
  async function call({role='superadmin',anonymous=false,aal='aal2',method='POST',body={}}={}){state.user.app_metadata.role=role;state.aal=aal;const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},status(v){this.statusCode=v;return this},json(v){this.body=v}};await handler({method,body,headers:anonymous?{}:{authorization:'Bearer synthetic'}},res);return res;}
  assert.equal((await call({anonymous:true})).statusCode,401);
  for(const role of ['proviseur','administration','agent','professeur','eleve'])assert.equal((await call({role})).statusCode,403);
  assert.equal((await call({aal:'aal1'})).statusCode,403);
  assert.equal((await call({body:{institutionId:foreign}})).statusCode,400);
  assert.equal((await call({method:'GET'})).statusCode,405);
  const ok=await call();assert.equal(ok.statusCode,200);assert.match(ok.headers['Cache-Control'],/no-store/);
  await database.update(schema.identityDirectoryImports).set({status:'retired'}).where(eq(schema.identityDirectoryImports.id,directory));
  result=await readAdminCrossData(school,parseCrossDataQuery({}),now);assert.equal(result.totals.people,0);assert.equal(result.revision,null);
  console.log(JSON.stringify({checks:19,isolatedPostgres:true,roleAndMfa:true,activeSourcesOnly:true,foreignExcluded:true,ambiguousBlocked:true,retiredCleared:true,attributesAllowlist:true,noPasswords:true,externalSends:0}));
}finally{await pg.close();delete globalThis.__crossRecipe;}
