import assert from 'node:assert/strict';
import test from 'node:test';
import { servicePilotPasswordOnly } from '../shared/agent-pilot-access.ts';
import { schoolReferenceAnswer } from '../shared/school-reference-answers.ts';
import { parsePushSubscription, validPushEndpoint, pushNotice } from '../shared/web-push-policy.mjs';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

test('pilot access has a deadline, never elevates ordinary users or superadministrators', () => {
  const until = '2026-09-23T21:59:59Z';
  for (const role of ['agent','administration']) assert.equal(servicePilotPasswordOnly(role,until,Date.parse('2026-09-10')),true);
  for (const role of ['superadmin','proviseur','eleve','professeur','pp','']) assert.equal(servicePilotPasswordOnly(role,until,Date.parse('2026-09-10')),false);
  for (const expiry of [undefined, '', 'garbage', '2026-09-01T00:00:00Z']) assert.equal(servicePilotPasswordOnly('agent',expiry,Date.parse('2026-09-10')),false);
  assert.equal(servicePilotPasswordOnly('agent',until,Date.parse(until)),false);
});
test('only approved current public reference facts are answered', () => {
  const query = (content,date='2026-09-10') => schoolReferenceAnswer([{role:'requester',content}],new Date(date));
  assert.match(query('Quels sont les horaires du lycée ?').reply,/rendez-vous/);
  assert.match(query('Comment justifier une absence ?').reply,/48 heures/);
  assert.match(query('Quelle date pour la réunion des parents ?').reply,/22 septembre/);
  assert.doesNotMatch(query('Quelle date pour la réunion des parents ?').reply,/17 ?h ?30/);
  assert.equal(query('Qui est absent demain dans les personnels ?'),null);
  assert.equal(query('Quelle date pour la réunion des parents ?','2026-10-01'),null);
  assert.equal(query('Quels sont les horaires du lycée ?','2027-09-02'),null);
});
test('push subscription rejects local, arbitrary and lookalike destinations', () => {
  for (const url of ['http://fcm.googleapis.com/x','https://localhost/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.test/x','https://evil.test/x','https://user@web.push.apple.com/x','https://fcm.googleapis.com:8443/x']) assert.equal(validPushEndpoint(url),false,url);
  const valid={endpoint:'https://fcm.googleapis.com/fcm/send/fictitious',keys:{p256dh:'B'.repeat(87),auth:'A'.repeat(22)}};
  assert.deepEqual(parsePushSubscription(valid),valid);
  assert.throws(()=>parsePushSubscription({...valid,extra:true}));
  assert.throws(()=>parsePushSubscription({...valid,keys:{p256dh:'x',auth:'x'}}));
  assert.doesNotMatch(JSON.stringify(pushNotice(false)),/nom|classe|BC-2026|code secret/i);
});
test('service worker never trusts push text or an external click destination', async () => {
  const handlers={}, notifications=[], opened=[];
  const context={URL,self:{location:{origin:'https://lycee.test'},addEventListener:(event,handler)=>handlers[event]=handler,
    registration:{showNotification:async(title,body)=>notifications.push({title,...body})},clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}}};
  vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),context);
  let promise;
  handlers.push({data:{json:()=>({title:'secret',body:'sensitive',destination:'https://evil.test'})},waitUntil:p=>promise=p}); await promise;
  assert.equal(notifications[0].body,pushNotice(false).body);
  handlers.notificationclick({notification:{close(){},data:{destination:'https://evil.test'}},waitUntil:p=>promise=p});await promise;
  assert.equal(opened[0],'/?view=requests');
});
