import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parsePushConfig,parsePushState,pushInstallHint} from '../shared/push-client-policy.ts';
import {parsePersonalFlash} from '../shared/personal-flash.ts';
import {flashClassGroup,flashViewerGroups} from '../shared/flash-audience-groups.mjs';

test('push receipts fail closed for malformed configuration or contradictory state',()=>{
  assert(parsePushConfig({available:true,publicKey:'B'.repeat(87),flashAvailable:true}));
  for(const value of [{available:'true',publicKey:'B'.repeat(87),flashAvailable:true},{available:false,publicKey:null,flashAvailable:true},{available:true,publicKey:'invalid',flashAvailable:true}])assert.equal(parsePushConfig(value),null);
  for(const value of [true,{enabled:false,flashEnabled:true},{enabled:true,flashEnabled:false,contact:'private'}])assert.equal(parsePushState(value),null);
});
test('installation guidance distinguishes iPhone/iPad browser from an installed app',()=>{
  assert.equal(pushInstallHint('iPhone','iPhone',5,false),true);
  assert.equal(pushInstallHint('Mac','MacIntel',5,false),true);
  assert.equal(pushInstallHint('iPhone','iPhone',5,true),false);
  assert.equal(pushInstallHint('Android','Linux arm',5,false),false);
});
test('private payload rejects internal fields and mixed malformed records',()=>{
  const item={id:'11111111-1111-4111-8111-111111111111',title:'Info',bodyMarkdown:'Texte',importance:'normale',expiresAt:new Date(Date.now()+60000).toISOString()};
  const payload={validUntil:item.expiresAt,items:[item]};assert(parsePersonalFlash(payload));
  assert.equal(parsePersonalFlash({...payload,personRef:'private'}),null);
  assert.equal(parsePersonalFlash({...payload,items:[{...item,authorEmail:'private'}]}),null);
  assert.equal(parsePersonalFlash({...payload,items:[item,null]}),null);
  assert.equal(parsePersonalFlash({...payload,items:Array(21).fill(item)}),null);
});
test('class audiences distinguish students, guardians and exact directory classes',()=>{
  assert.notEqual(flashClassGroup('student','2GT A'),flashClassGroup('guardian','2GT A'));
  assert.notEqual(flashClassGroup('student','2GT A'),flashClassGroup('student','2GT-A'));
  assert.equal(flashViewerGroups('guardian',['2GT A','2GT A']).length,3);
  assert.deepEqual(flashViewerGroups('staff',['2GT A']),['public:site','profile:staff']);
});
const source=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
function worker(){
  const handlers={},notifications=[],opened=[],focused=[];
  const existing={url:'https://lycee.example/admin/contenus',navigate(){assert.fail('unsaved editor must not navigate');},focus(){focused.push(this.url);}};
  const self={location:{origin:'https://lycee.example'},addEventListener:(name,fn)=>handlers[name]=fn,registration:{showNotification:async(title,options)=>notifications.push({title,...options})},clients:{matchAll:async()=>[existing],openWindow:async(url)=>opened.push(url)}};
  vm.runInNewContext(source,{self,URL,caches:{}});
  return {handlers,notifications,opened,focused,existing};
}
test('service worker never displays source text or opens untrusted destinations',async()=>{
  const w=worker();let pending;
  w.handlers.push({data:{json:()=>({kind:'flash',body:'private name',title:'private class',destination:'https://attacker.example'})},waitUntil:p=>pending=p});await pending;
  assert(!JSON.stringify(w.notifications).includes('private'));
  assert.equal(w.notifications[0].data.destination,'/?view=home');
  w.handlers.notificationclick({notification:{data:{destination:'https://attacker.example'},close(){}},waitUntil:p=>pending=p});await pending;
  assert.equal(w.opened[0],'/?view=requests');assert.equal(w.focused.length,0);
});
test('clicking a flash focuses an existing exact home page and preserves a different editor',async()=>{
  const w=worker();w.existing.url='https://lycee.example/?view=home';let pending;
  w.handlers.notificationclick({notification:{data:{destination:'/?view=home'},close(){}},waitUntil:p=>pending=p});await pending;
  assert.equal(w.focused.length,1);assert.equal(w.opened.length,0);
});
