import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import postgres from 'postgres';
if(process.argv.length!==3||process.argv[2]!=='--local-stack-only')throw new Error('local_stack_confirmation_required');
const db=postgres({host:'127.0.0.1',port:54322,user:'postgres',password:'postgres',database:'postgres',max:1});
const requestId=randomUUID(),contactId=randomUUID(),jobId=randomUUID();
const token=randomBytes(32).toString('base64url'),secret=randomBytes(48).toString('base64url');
const dir=resolve('.vercel/email-worker-recipe');mkdirSync(dir,{recursive:true});
const bundle=resolve(dir,'worker.mjs'),mock=resolve(dir,'provider.mjs'),report=resolve(dir,'provider-result.json');
await build({entryPoints:['workers/support-email-worker.mjs'],outfile:bundle,bundle:true,platform:'node',format:'esm',target:'node20',external:['postgres']});
writeFileSync(mock,`import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createHash,createHmac} from 'node:crypto';
let calls=0;
globalThis.fetch=async (url,options)=>{
 assert.equal(url,'https://api.brevo.com/v3/smtp/email');
 const body=JSON.parse(options.body);
 assert.equal(body.to[0].email,'fixture@recipient.invalid');
 const digest=createHmac('sha256',process.env.SUPPORT_ACCESS_CODE_SECRET).update('lyceegest:support-access-code:v1:'+createHash('sha256').update(process.env.RECIPE_TOKEN).digest('hex')).digest();
 const code=String((digest.readUInt32BE(digest[digest.length-1]&15)&0x7fffffff)%1000000).padStart(6,'0');
 assert.ok(body.textContent.includes(code));assert.ok(body.htmlContent.includes(code));
 assert.ok(body.textContent.includes(process.env.RECIPE_TOKEN));
 assert.equal(body.headers.idempotencyKey,process.env.RECIPE_JOB);
 calls++;writeFileSync(process.env.RECIPE_REPORT,JSON.stringify({calls,codeInBothBodies:true,linkBoundToToken:true}));
 return new Response(JSON.stringify({messageId:'fake-provider-receipt'}),{status:201,headers:{'content-type':'application/json'}});
};`);
try{
 assert.equal(Number((await db`select count(*) from pgmq.q_support_jobs`)[0].count),0,'local queue must be empty');
 const institutions=await db`select id,slug from institutions where status in ('pilot','active')`;
 assert.equal(institutions.length,1);const institution=institutions[0];
 await db`insert into support_requests(id,institution_id,idempotency_key_hash,requester_type,requester_first_name,requester_last_name,beneficiary_type,category,subject,description,preferred_channel)
 values (${requestId},${institution.id},${randomUUID()},'parent','Fictif','Recette','self','autre','Recette email','Test local seulement','email')`;
 await db`insert into support_contacts(id,request_id,person_type,channel,value,normalized_hash,usage_scope,is_primary) values (${contactId},${requestId},'requester','email','fixture@recipient.invalid',${createHash('sha256').update(randomUUID()).digest('hex')},'support',true)`;
 await db`insert into support_magic_tokens(request_id,contact_id,token_hash,purpose,expires_at) values (${requestId},${contactId},${createHash('sha256').update(token).digest('hex')},'support_access',now()+interval '30 minutes')`;
 const job={job_id:jobId,institution_id:institution.id,request_id:requestId,contact_id:contactId,message_id:randomUUID(),access_token:token,job_type:'notify_requester_request_created'};
 for(const value of [job,{...job,job_id:randomUUID()}])await db`select pgmq.send('support_jobs',${db.json(value)})`;
 const env={...process.env,DATABASE_URL:'postgres://postgres:postgres@127.0.0.1:54322/postgres',BREVO_API_KEY:'fake-only',SUPPORT_FROM_EMAIL:'sender@example.org',SUPPORT_ACCESS_CODE_SECRET:secret,SUPPORT_PUBLIC_URL:'https://portal.example.org/prototype',SUPPORT_INSTITUTION_SLUG:institution.slug,RECIPE_TOKEN:token,RECIPE_JOB:jobId,RECIPE_REPORT:report};
 const run=spawnSync(process.execPath,['--import',pathToFileURL(mock).href,bundle],{env,encoding:'utf8',timeout:30000});
 assert.equal(run.status,0,run.stderr);
 assert.deepEqual(JSON.parse(readFileSync(report,'utf8')),{calls:1,codeInBothBodies:true,linkBoundToToken:true});
 const runs=await db`select status from support_job_runs where request_id=${requestId}`;
 assert.equal(runs.length,2);assert.ok(runs.every(row=>row.status==='success'));
 assert.equal(Number((await db`select count(*) from pgmq.q_support_jobs`)[0].count),0);
 const absent=spawnSync(process.execPath,['--import',pathToFileURL(mock).href,bundle],{env:{...env,SUPPORT_ACCESS_CODE_SECRET:''},encoding:'utf8',timeout:30000});
 assert.equal(absent.status,1);assert.match(absent.stderr,/support_access_code_secret_invalid/);
 console.log(JSON.stringify({worker:'actual VPS bundle',emails:1,queuedJobs:2,codeAndLink:true,provider:'mock only',missingSecret:'blocked'}));
}finally{
 await db`delete from pgmq.q_support_jobs where message->>'request_id'=${requestId}`;
 await db`delete from support_requests where id=${requestId}`;
 await db.end();
}
