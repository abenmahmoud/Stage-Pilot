import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { parseContentTargeting, contentMatchesIdentity } from '../shared/content-targeting.ts';
import { parseSiteContentInput, isSiteContentPublicAt } from '../shared/site-content.ts';
import { publicCalendarEvents } from '../shared/school-calendar-public.ts';
import { schoolCalendarIcal } from '../shared/school-calendar-ical.ts';
import { authorizedNews, isPersonalNewsFeed, isPersonalNewsArticle, isNewsId } from '../shared/personal-news.ts';
const now = new Date('2026-09-14T06:00:00.000Z');
const id='123e4567-e89b-42d3-a456-426614174001', assetId='123e4567-e89b-42d3-a456-426614174002';
const date={key:'sortie',title:'Sortie fictive',startDate:'2026-09-16',endDate:'2026-09-16',startTime:null,endTime:null,location:'Au lycée'};
const snapshot={contentType:'article',title:'Sortie fictive',slug:'sortie-fictive',summary:'Information fictive pour la recette.',bodyMarkdown:'Document pédagogique fictif.',category:'Vie du lycée',audience:'eleves',targeting:{profiles:['eleves','parents'],classRefs:['2DE1']},calendarEvents:[date],assets:[{assetId,assetRole:'document',publicLabel:'Fiche fictive',position:0}]};
const publication={id,status:'brouillon',publishedVersion:1,publishedAt:'2026-09-12T06:00:00.000Z'};
const scope={personType:'student',classRefs:['2DE1']};
test('targeting is explicit and bounded, never an empty audience expanded to everyone',()=>{
  assert.equal(parseContentTargeting(undefined),null);
  for(const value of [{profiles:[],classRefs:[]},{profiles:['eleves','eleves'],classRefs:[]},{profiles:['admin'],classRefs:[]},{profiles:['eleves'],classRefs:['*'] ,extra:true},{profiles:['personnels'],classRefs:['2DE1']},{profiles:['eleves'],classRefs:['2DE1','2DE1']}])assert.throws(()=>parseContentTargeting(value));
  assert.throws(()=>parseSiteContentInput({...snapshot,audience:'tous'}));
});
test('student, guardian, staff and exact class boundaries are independent',()=>{
  const c=parseSiteContentInput(snapshot);
  assert.equal(contentMatchesIdentity(c,scope),true);
  assert.equal(contentMatchesIdentity(c,{personType:'guardian',classRefs:['2DE1','1G2']}),true);
  for(const s of [{personType:'guardian',classRefs:[]},{personType:'student',classRefs:['2DE10']},{personType:'student',classRefs:['2de1']},{personType:'staff',classRefs:['2DE1']}])assert.equal(contentMatchesIdentity(c,s),false);
  assert.equal(contentMatchesIdentity({audience:'professeurs'},{personType:'staff',classRefs:[]}),false);
  assert.equal(contentMatchesIdentity({audience:'personnels'},{personType:'staff',classRefs:[]}),true);
});
test('targeted articles never enter public news, calendar or exports',()=>{
  const c=parseSiteContentInput(snapshot);assert.equal(isSiteContentPublicAt(c,now),false);
  assert.deepEqual(publicCalendarEvents({...publication,audience:'eleves'},snapshot,'2026-09',now),[]);
  assert.throws(()=>publicCalendarEvents({...publication,audience:'tous'},{...snapshot,audience:'tous'},'2026-09',now));
});
test('published snapshot remains authoritative while a new draft awaits validation',()=>{
  const row={item:publication,snapshot}; const entry=authorizedNews(row,scope,now);assert.equal(entry.preview.title,'Sortie fictive');
  assert.equal(entry.preview.version,1);assert.deepEqual(entry.preview.calendarEvents,[date]);
  for(const patch of [{status:'archive'},{publishedVersion:null},{publishedAt:null},{publishedAt:'2026-09-15T06:00:00.000Z'}])assert.equal(authorizedNews({...row,item:{...publication,...patch}},scope,now),null);
  for(const patch of [{expiresAt:now.toISOString()},{publishAt:'2026-09-15T06:00:00.000Z'},{targeting:{profiles:['parents'],classRefs:['1G1']}}])assert.equal(authorizedNews({...row,snapshot:{...snapshot,...patch}},scope,now),null);
});
test('personal exports use private classification and a protected entry, without inventing a time',()=>{
  const entry=authorizedNews({item:publication,snapshot},scope,now);
  const ics=schoolCalendarIcal([{...date,id:`${id}:sortie`,articleId:id,articleSlug:'sortie-fictive',articleTitle:entry.preview.title,summary:entry.preview.summary,category:'Vie du lycée',version:1,updatedAt:publication.publishedAt,articleExpired:false,image:null}],{personal:true});
  assert.match(ics,/CLASS:PRIVATE/);assert.match(ics,/URL:https:\/\/lycee-blaise-cendrars-sevran.fr\/\?view=home/);
  assert.match(ics,/DTSTART;VALUE=DATE:20260916/);assert.match(ics,/DTEND;VALUE=DATE:20260917/);assert.ok(!ics.includes('/site/sortie-fictive'));
});
test('client contracts reject raw identity, unbounded feeds and malformed dates',()=>{
  const preview=authorizedNews({item:publication,snapshot},scope,now).preview;
  const feed={status:'available',items:[preview],more:false,validUntil:'2026-09-14T06:01:00.000Z'};
  assert.ok(isPersonalNewsFeed(feed));assert.equal(isPersonalNewsFeed({...feed,personRef:'secret'}),false);
  assert.equal(isPersonalNewsFeed({...feed,items:Array(9).fill(preview)}),false);
  assert.equal(isPersonalNewsFeed({...feed,items:[{...preview,calendarEvents:[{...date,startDate:'2026-02-30'}]}]}),false);
  assert.equal(isPersonalNewsArticle({item:preview,bodyMarkdown:'Fictif',assets:[],validUntil:feed.validUntil}),true);
});
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now.getTime()]));}static now(){return now.getTime();}}
function fixture({authorized=true,identities,assetReady=true}={}){
  const identity={id:'session',institutionId:'school',personRef:'person',sourceImportId:'active',personType:'student',expiresAt:new Date('2026-09-14T18:00:00Z')};
  let n=0,reads=0,signs=0;
  const entry=authorizedNews({item:publication,snapshot},scope,now);
  const dependencies={
    'drizzle-orm':{and:()=>null,eq:()=>null,inArray:()=>null},'../../../db/index.js':{db:{select:()=>({from:()=>({where:async()=>assetReady?[{id:assetId,mimeType:'application/pdf',path:'private/fictif.pdf'}]:[]})})}},
    '../../../db/schema.js':{siteContentAssets:{}},'../../../shared/identity-device-access.js':{identityDeviceFeatureEnabled:()=>true},
    '../../../shared/personal-news.js':{isNewsId,isPersonalNewsArticle},'../../../shared/school-calendar-ical.js':{schoolCalendarIcal},
    '../../_shared/identity-device-access.js':{readIdentityDeviceSession:async()=>identities?identities[n++]:identity},
    '../../_shared/personal-home-reader.js':{readPersonalHomeTargets:async()=>[{personRef:'person',classRef:'2DE1'}]},
    '../../_shared/personal-news-reader.js':{readAuthorizedNews:async()=>{reads++;return authorized?[entry]:[];}},
    '../../_shared/site-content.js':{signedAssetUrl:async(path,ttl)=>{signs++;assert.equal(path,'private/fictif.pdf');assert.ok(ttl<=60);return 'https://example.test/file';}},
    '../../_shared/support.js':{enforceSupportRateLimit:async()=>{},personalHash:()=>''},'../../_shared/auth.js':{HttpError},
    '../../_shared/response.js':{methodNotAllowed:res=>{res.code=405;},handleApi:async(res,fn)=>{try{res.body=await fn();}catch(e){res.code=e.status??500;}}},
  };
  const exports={};const code=ts.transpileModule(readFileSync(new URL('../api/identity/device/news.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,Date:FixedDate,require:name=>{assert.ok(name in dependencies,name);return dependencies[name];}});
  return {identity,get reads(){return reads;},get signs(){return signs;},run:async(query={article:id},method='GET')=>{
    const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v;},redirect(code,url){this.code=code;this.url=url;},status(code){this.code=code;return this;},send(body){this.sent=body;}};
    await exports.default({method,query},res);return res;
  }};
}
test('direct article, asset and calendar requests authenticate before any content read',async()=>{
  for(const query of [{article:id},{article:id,asset:assetId},{article:id,format:'ics'}]){
    const f=fixture({identities:[null]});const res=await f.run(query);assert.equal(res.code,401);assert.equal(f.reads,0);assert.equal(f.signs,0);assert.match(res.headers['Cache-Control'],/no-store/);
  }
});
test('foreign, archived or outside-class articles cannot sign documents',async()=>{
  const f=fixture({authorized:false});assert.equal((await f.run({article:id,asset:assetId})).code,404);assert.equal(f.signs,0);
});
test('revocation and directory replacement during read discard the article and its attachments',async()=>{
  const {identity}=fixture();for(const replacement of [null,{...identity,sourceImportId:'new'},{...identity,id:'other'},{...identity,personRef:'other'},{...identity,expiresAt:now}]){
    const f=fixture({identities:[identity,replacement]});assert.equal((await f.run({article:id,asset:assetId})).code,401);assert.equal(f.signs,0);
  }
});
test('validated article, clean attachment and ICS share the same publication',async()=>{
  const f=fixture();const article=await f.run();assert.equal(article.code,200);assert.ok(isPersonalNewsArticle(article.body));
  assert.equal((await f.run({article:id,asset:assetId})).code,302);assert.equal(f.signs,1);
  const ics=await f.run({article:id,format:'ics'});assert.match(ics.sent,/SUMMARY:Sortie fictive/);
  assert.equal((await fixture({assetReady:false}).run({article:id,asset:assetId})).code,404);
  assert.equal((await f.run({article:id,asset:'123e4567-e89b-42d3-a456-426614174099'})).code,404);
});
test('free identity parameters, malformed identifiers and wrong verbs fail before reads',async()=>{
  for(const query of [{article:id,personRef:'other'},{article:[id]},{article:id,format:'json'},{article:id,asset:assetId,format:'ics'}]){
    const f=fixture();assert.equal((await f.run(query)).code,400);assert.equal(f.reads,0);
  }
  const f=fixture();assert.equal((await f.run({article:id},'POST')).code,405);assert.equal(f.reads,0);
});
