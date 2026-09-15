import test from 'node:test';
import assert from 'node:assert/strict';
import { requestsEntAccess,ownEntAccessAllowed,codeFromEntVault,validEntAccessPayload } from '../shared/ent-self-service.ts';
import { requiresIdentityForPersonalSupport } from '../shared/support-service-intent.ts';
import { analyzeSupportConversation } from '../api/_shared/support-agent.ts';
process.env.OPENAI_API_KEY='';
const msg=content=>({role:'requester',content});
test('ENT requests require identity and keep the exact account flow',()=>{
  for(const text of ['Je veux mon code ENT','Je suis parent, activer mon compte monlycee.net','ENT','Réinitialiser mon ENT']){
    assert.ok(requestsEntAccess([msg(text)]));assert.ok(requiresIdentityForPersonalSupport([msg(text)],'ent'));
  }
  assert.ok(requestsEntAccess([msg('mon ENT'),msg('mon identifiant') ]));
  for(const text of ['Mon EDT demain','Les horaires du lycée','Mon code cantine','Accès Pronote']) assert.equal(requestsEntAccess([msg('mon ENT'),msg(text)]),false);
});
test('guardian can only read their own account, never the child or another school',()=>{
  const parent={institutionId:'school-a',personRef:'parent.a8',personType:'guardian'};
  assert.ok(ownEntAccessAllowed(parent,parent));
  assert.equal(ownEntAccessAllowed(parent,{institutionId:'school-a',personRef:'child.a8'}),false);
  assert.equal(ownEntAccessAllowed(parent,{institutionId:'school-b',personRef:'parent.a8'}),false);
  assert.equal(ownEntAccessAllowed({...parent,personType:'anonymous'},parent),false);
});
test('active account never reveals an initial code; identifier suffix must match exactly',()=>{
  const a={identifier:'parent.test18',activationState:'inactive'};
  assert.equal(codeFromEntVault('Identifiant : parent.test18 | Code : SYNTHETIC8',a),'SYNTHETIC8');
  assert.equal(codeFromEntVault('Identifiant : parent.test | Code : SYNTHETIC8',a),null);
  assert.equal(codeFromEntVault('Identifiant : parent.test18 | Code : SYNTHETIC8',{...a,activationState:'active'}),null);
  assert.equal(validEntAccessPayload({status:'ready',account:{...a,activationState:'active'},profile:'guardian',code:'SYNTHETIC8',expiresAt:new Date().toISOString()}),false);
});
test('chat resumes ENT after verification without a forced form or model call',async()=>{
  for(const identityVerified of [false,true]){
    const r=await analyzeSupportConversation({messages:[msg('Je suis parent, je veux mon code ENT')],attachments:[],safetyIdentifier:'synthetic-ent-test',identityVerified});
    assert.equal(r.category,'ent');assert.equal(r.action,'continue');assert.equal(r.readyToCreate,false);assert.equal(r.usedAi,false);
    assert.match(r.reply,identityVerified ? /Mon accès ENT/ : /Confirmons votre identité/);
  }
});
test('failed recovery preserves human referral instead of repeating the same advice',async()=>{
  const r=await analyzeSupportConversation({messages:[msg('Mon ENT ne marche pas'),msg('J’ai déjà essayé, je ne reçois pas de code')],attachments:[],safetyIdentifier:'synthetic-ent-test',identityVerified:true});
  assert.match(r.reply,/référent numérique/);assert.doesNotMatch(r.reply,/Mon accès ENT/);
});
