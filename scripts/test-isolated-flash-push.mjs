import assert from 'node:assert/strict';
import postgres from 'postgres';
import {dispatchFlashPush} from '../workers/flash-push-worker.mjs';
import {flashClassGroup} from '../shared/flash-audience-groups.mjs';
const target=new URL(process.env.DATABASE_URL);
if(target.hostname!=='127.0.0.1'||target.port!=='55446'||target.pathname!=='/push_recipe')throw new Error('Isolated push recipe target required');
const sql=postgres(target.toString(),{max:1});
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const school=id(1),otherSchool=id(2),actor=id(3),imp=id(4);
const subscription=n=>({endpoint:`https://fcm.googleapis.com/fcm/send/fictitious-${n}`,keys:{p256dh:'B'.repeat(87),auth:'A'.repeat(22)}});
let seq=100;
try {
  await sql`insert into institutions values(${school},'pilot'),(${otherSchool},'pilot')`;
  await sql`insert into auth.users values(${actor},'{"role":"superadmin"}',null)`;
  await sql`insert into identity_directory_imports values(${imp},${school},'active')`;
  for(const [n,profile,cls] of [[10,'student','2GT A'],[11,'student','2GT B'],[12,'guardian',null],[13,'staff',null],[14,'student','2GT A'],[15,'student','2GT A']]) {
    await sql`insert into identity_directory_rows(institution_id,import_id,person_ref,person_type,record_type,validation_status,class_ref) values(${school},${imp},${'person-'+n},${profile},'person','valid',${cls})`;
    await sql`insert into identity_device_sessions values(${id(n)},${school},${imp},${'person-'+n},${profile},null,now()+interval '1 day',now()+interval '2 days','directory_email_otp')`;
    await sql`insert into support_push_subscriptions(id,institution_id,identity_session_id,identity_owner_hash,endpoint_hash,subscription,flash_since) values(${id(n+20)},${school},${id(n)},${'a'.repeat(64)},${'flash-'+n},${sql.json(subscription(n))},now()-interval '1 hour')`;
  }
  await sql`update identity_device_sessions set revoked_at=now() where id=${id(14)}`;
  await sql`update support_push_subscriptions set flash_since=null where id=${id(35)}`;
  // A verified guardian relationship, never a matching family name or email.
  await sql`insert into identity_directory_rows(institution_id,import_id,record_type,validation_status,relationship_type,subject_person_ref,object_ref,valid_from) values(${school},${imp},'relationship','valid','guardian_of','person-12','person-10',current_date)`;
  async function publish(groups,{root=null,version=1,previous=null,notify=true,importance='importante',institution=school,expired=false}={}) {
    const rootId=root??id(seq++),versionId=id(seq++);
    if(!root)await sql`insert into flash_infos(id,institution_id,created_by) values(${rootId},${institution},${actor})`;
    await sql`insert into flash_info_versions(id,institution_id,flash_info_id,version,previous_version_id,title,body_markdown,importance,channels,expires_at,proposed_by,created_at)
      values(${versionId},${institution},${rootId},${version},${previous},'Information privée fictive','Ne jamais afficher ceci dans une notification',${importance},${sql.json(importance==='normale'?[]:['push'])},${new Date(Date.now()+(expired?-1000:86400000))},${actor},now()-interval '1 day')`;
    for(const group of groups)await sql`insert into flash_info_audiences(institution_id,version_id,group_ref) values(${institution},${versionId},${group})`;
    await sql`update flash_info_versions set status='validee',validated_by=${actor},validated_at=now() where id=${versionId}`;
    await sql`update flash_info_versions set status='publiee',published_by=${actor},published_at=now(),push_authorized_at=${notify?new Date():null} where id=${versionId}`;
    await sql`update flash_infos set current_version=${version},published_version=${version} where id=${rootId}`;
    return {root:rootId,versionId};
  }
  const calls=[];const send=async(sub,body)=>calls.push({endpoint:sub.endpoint,...JSON.parse(body)});
  const a=await publish([flashClassGroup('student','2GT A'),'profile:student']);
  assert.equal((await dispatchFlashPush(sql,send)).sent,2,'only two eligible active students, one push each across overlapping groups');
  await dispatchFlashPush(sql,async()=>assert.fail('duplicate'));
  assert(!JSON.stringify(calls).includes('privée'),'no private content on lock screen');
  await publish([flashClassGroup('guardian','2GT A')]);
  const guardian=[];assert.equal((await dispatchFlashPush(sql,async(s)=>guardian.push(s.endpoint))).sent,1);assert(guardian[0].endsWith('-12'));
  await publish([flashClassGroup('guardian','2GT B')]);assert.equal((await dispatchFlashPush(sql,send)).sent,0);
  const b=await publish(['profile:staff'],{root:a.root,version:2,previous:a.versionId,notify:false});
  assert.equal((await dispatchFlashPush(sql,send)).sent,0,'silent correction never sends');
  const c=await publish(['profile:staff'],{root:a.root,version:3,previous:b.versionId});
  const correction=[];assert.equal((await dispatchFlashPush(sql,async(s,p)=>correction.push(JSON.parse(p)))).sent,3);
  assert.equal(correction.filter(n=>n.kind==='flash_removed').length,2,'removed students receive only generic withdrawal');
  await publish(['profile:staff'],{root:a.root,version:4,previous:c.versionId,importance:'normale'});
  assert.equal((await dispatchFlashPush(sql,send)).sent,1,'normal correction only repeats to previously notified eligible staff');
  await publish(['profile:student'],{institution:otherSchool});await publish(['profile:student'],{expired:true});
  assert.equal((await dispatchFlashPush(sql,send)).sent,0,'other school and expired publication excluded');
  await publish(['profile:staff']);assert.equal((await dispatchFlashPush(sql,async()=>{throw new Error('network uncertainty')})).uncertain,1);
  assert.equal((await dispatchFlashPush(sql,async()=>assert.fail('uncertain replay'))).sent,0);
  await publish(['profile:staff']);assert.equal((await dispatchFlashPush(sql,async()=>{throw Object.assign(new Error('gone'),{statusCode:410})})).rejected,1);
  const [gone]=await sql`select disabled_at from support_push_subscriptions where id=${id(33)}`;assert(gone.disabled_at);
  await sql`update identity_directory_imports set status='retired' where id=${imp}`;
  await publish(['public:site']);assert.equal((await dispatchFlashPush(sql,async()=>assert.fail('retired directory'))).sent,0);
  const [{allowed}]=await sql`select has_table_privilege('anon','flash_info_versions','select') or has_table_privilege('authenticated','support_push_deliveries','select') as allowed`;assert.equal(allowed,false);
  console.log(JSON.stringify({isolatedPostgres:true,realMigrations:true,overlapDeduplicated:true,guardianScope:true,revokedExcluded:true,optOutExcluded:true,silentCorrection:true,removedGeneric:true,normalNoNewAudience:true,otherSchoolExcluded:true,expiredExcluded:true,uncertainNotRetried:true,goneDisabled:true,retiredDirectoryExcluded:true,externalSends:0}));
}finally{await sql.end();}
