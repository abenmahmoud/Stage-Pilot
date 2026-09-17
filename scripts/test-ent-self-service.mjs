import test from 'node:test';
import assert from 'node:assert/strict';
import { ENT_LOGIN_URL,asksHowToOpenPronote,requestsEntAccess,ownEntAccessAllowed,codeFromEntVault,validEntAccessPayload } from '../shared/ent-self-service.ts';
import { requiresIdentityForPersonalSupport } from '../shared/support-service-intent.ts';
import { analyzeSupportConversation } from '../api/_shared/support-agent.ts';
process.env.OPENAI_API_KEY='';
const msg=content=>({role:'requester',content});
test('ENT requests require identity and keep the exact account flow',()=>{
  for(const text of ['Je veux mon code ENT','Je suis parent, activer mon compte monlycee.net','ENT','Réinitialiser mon ENT']){
    assert.ok(requestsEntAccess([msg(text)]));assert.ok(requiresIdentityForPersonalSupport([msg(text)],'ent'));
  }
  assert.ok(requestsEntAccess([msg('mon ENT'),msg('mon identifiant') ]));
  for(const text of ['Mon EDT demain','Les horaires du lycée','Mon code cantine','Accès Pronote']) assert.equal(requestsEntAccess([msg('mon ENT'),msg(text)]),false,text);
  for(const text of ['Je veux mon code Pronote','J’ai perdu mon identifiant Pronote','Je n’arrive pas à me connecter à Pronote']) assert.equal(requestsEntAccess([msg(text)]),true);
  for(const text of ['Mon ENT est bloqué et je dois consulter mon emploi du temps demain','Je ne peux plus accéder à mon ENT depuis mon PC','Pronote ne marche plus']) assert.equal(requestsEntAccess([msg(text)]),true);
  for(const text of ['Mon emploi du temps demain sur Pronote','Mon code cantine ne marche pas dans ENT','Comment inscrire mon enfant à la cantine dans Pronote']) assert.equal(requestsEntAccess([msg(text)]),false);
  assert.equal(requestsEntAccess([msg('Mon ENT ne marche pas'),msg('Depuis hier')]),true);
  assert.equal(requestsEntAccess([msg('Mon ENT ne marche pas'),msg('Merci')]),false);
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
    assert.match(r.reply,identityVerified ? /Mon accès ENT/ : /confirmons votre identité/i);
  }
});

test('reset and forgotten identifier keep the ENT context without stealing another service',async()=>{
  for (const messages of [
    [msg('Comment réinitialiser mon ENT ?')],
    [msg('Je veux me connecter à monlycee.net'), msg('J’ai oublié mon identifiant')],
    [msg('Mon accès ENT'), msg('Comment réinitialiser le mot de passe ?')],
  ]) {
    assert.equal(requestsEntAccess(messages),true);
    const answer=await analyzeSupportConversation({messages,attachments:[],safetyIdentifier:'synthetic-reset-test',identityVerified:true});
    assert.equal(answer.action,'continue');assert.equal(answer.category,'ent');assert.equal(answer.usedAi,false);
    assert.match(answer.reply,/identifiant exact/);
  }
  assert.equal(requestsEntAccess([msg('Mon ENT'),msg('Ma messagerie académique'),msg('Identifiant oublié')]),false);
  assert.equal(requestsEntAccess([msg('Mon ENT'),msg('Mon compte Pronote'),msg('Comment réinitialiser ?')]),true);
});

test('PRONOTE opens from Monlycée.net without a separate login promise',async()=>{
  const messages=[msg('Comment accéder à Pronote ?')];
  assert.equal(asksHowToOpenPronote(messages),true);
  assert.equal(requiresIdentityForPersonalSupport(messages,'ent'),false);
  const answer=await analyzeSupportConversation({messages,attachments:[],safetyIdentifier:'synthetic-pronote-test',identityVerified:false});
  assert.equal(answer.category,'ent');assert.equal(answer.action,'continue');assert.equal(answer.usedAi,false);
  assert.match(answer.reply,/PRONOTE depuis l’ENT/);assert.ok(answer.reply.includes(ENT_LOGIN_URL));
  const own=[msg('Je suis parent, je veux mon code Pronote')];
  const personal=await analyzeSupportConversation({messages:own,attachments:[],safetyIdentifier:'synthetic-pronote-parent',identityVerified:false});
  assert.equal(personal.category,'ent');assert.equal(personal.readyToCreate,false);assert.equal(personal.usedAi,false);
  assert.match(personal.reply,/confirmons votre identité/);assert.doesNotMatch(personal.reply,/Code :/);
});

test('anonymous parent gets the public procedure, never credentials based on a child name',async()=>{
  const result=await analyzeSupportConversation({messages:[msg('Je suis parent de Camille Exemple, son nom ne figure pas. Je veux mon identifiant ENT et le code')],attachments:[],safetyIdentifier:'synthetic-parent-test',identityVerified:false});
  assert.equal(result.category,'ent');assert.equal(result.usedAi,false);assert.equal(result.readyToCreate,false);
  assert.ok(result.reply.includes(ENT_LOGIN_URL));assert.match(result.reply,/Mot de passe oublié/);
  assert.match(result.reply,/propre nom et prénom/);assert.equal('account' in result,false);assert.equal('code' in result,false);
});

test('missing child information does not prevent a verified parent from asking for their own ENT',async()=>{
  const first=await analyzeSupportConversation({messages:[msg('Quelle est la classe de mon enfant Camille Exemple ?')],attachments:[],safetyIdentifier:'synthetic-child-test',identityVerified:true,familySchoolReader:async()=>({status:'unavailable'})});
  assert.ok(first.reply.includes(ENT_LOGIN_URL));assert.match(first.reply,/Retrouver mon accès ENT/);
  assert.equal(first.action,'offer_case');
  const next=await analyzeSupportConversation({messages:[msg('Quelle est la classe de mon enfant Camille Exemple ?'),{role:'assistant',content:first.reply},msg('Je veux retrouver mon accès ENT personnel')],attachments:[],safetyIdentifier:'synthetic-child-test',identityVerified:true,familySchoolReader:async()=>{throw new Error('must not access child for personal ENT');}});
  assert.equal(next.category,'ent');assert.equal(next.action,'continue');assert.equal(next.readyToCreate,false);assert.equal(next.usedAi,false);
  let childReads=0;
  const mixed=await analyzeSupportConversation({messages:[msg('Mon enfant Camille Exemple est en classe de seconde, je veux retrouver mon identifiant ENT de parent')],attachments:[],safetyIdentifier:'synthetic-child-test',identityVerified:true,familySchoolReader:async()=>{childReads++;return {status:'unavailable'};}});
  assert.equal(mixed.category,'ent');assert.equal(mixed.action,'continue');assert.equal(childReads,0);
});
test('failed recovery preserves human referral instead of repeating the same advice',async()=>{
  const r=await analyzeSupportConversation({messages:[msg('Mon ENT ne marche pas'),msg('J’ai déjà essayé, je ne reçois pas de code')],attachments:[],safetyIdentifier:'synthetic-ent-test',identityVerified:true});
  assert.match(r.reply,/référent numérique/);assert.doesNotMatch(r.reply,/Mon accès ENT/);
});
