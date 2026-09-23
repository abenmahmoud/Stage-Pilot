import test from 'node:test';
import assert from 'node:assert/strict';
import { requestsPcSessionAccess, ownPcSessionAccessAllowed, credentialsFromPcVault, validPcSessionAccessPayload } from '../shared/pc-session-self-service.ts';
import { requestsEntAccess } from '../shared/ent-self-service.ts';
import { requiresIdentityForPersonalSupport } from '../shared/support-service-intent.ts';
import { analyzeSupportConversation } from '../api/_shared/support-agent.ts';
process.env.OPENAI_API_KEY = '';
const msg = content => ({ role: 'requester', content });

test('PC credentials follow a dedicated journey, including after ENT', () => {
  for (const text of ['Je suis professeur et je veux mon code session PC', 'Mon accès KOXO', 'Mon identifiant Windows', 'Mes codes PC', 'Mon code session']) {
    const messages = [msg('Mon ENT'), msg(text)];
    assert.equal(requestsPcSessionAccess(messages), true, text);
    assert.equal(requestsEntAccess(messages), false, text);
    assert.equal(requiresIdentityForPersonalSupport(messages, 'logiciel'), true, text);
  }
  assert.equal(requestsPcSessionAccess([msg('Mes codes PC'), msg('Mon identifiant oublié')]), true);
  for (const text of ['Mon code ENT', 'Accès Pronote', 'Mon emploi de demain', 'Les horaires', 'Mon code cantine', 'Mon Chromebook']) {
    assert.equal(requestsPcSessionAccess([msg('Mon code KOXO'), msg(text)]), false, text);
  }
  for (const text of [
    "Le PC dont j'ai indiqué la référence n'a pas d'accès à Internet.",
    "La prise réseau du PC ne fonctionne pas.",
    "Panne de matériel : l'ordinateur ne démarre pas.",
  ]) assert.equal(requestsPcSessionAccess([msg(text)]), false, text);
});
test('teachers and students have only their own PC access; no child or other institution', () => {
  const target = { personRef: 'teacher.exemple28', institutionId: 'lycee-a' };
  for (const personType of ['staff', 'student']) {
    assert.equal(ownPcSessionAccessAllowed({ ...target, personType }, target), true);
    assert.equal(ownPcSessionAccessAllowed({ ...target, personType }, { ...target, personRef: 'other' }), false);
    assert.equal(ownPcSessionAccessAllowed({ ...target, personType }, { ...target, institutionId: 'lycee-b' }), false);
  }
  for (const personType of ['guardian', 'superadmin', 'anonymous', 'professeur']) assert.equal(ownPcSessionAccessAllowed({ ...target, personType }, target), false);
});
test('exact vault identifiers preserve suffixes and never synthesize logins', () => {
  assert.deepEqual(credentialsFromPcVault('Identifiant : prof.exemple28 | Code : TEST-PC-9'), { identifier: 'prof.exemple28', code: 'TEST-PC-9' });
  for (const value of ['TEST-PC-9', 'Identifiant :  | Code : TEST-PC-9', 'Identifiant : prof28 | Code : xx', 'Identifiant : prof28 | Code : TEST\nPC']) assert.equal(credentialsFromPcVault(value), null);
  const good = { status: 'ready', identifier: 'prof28', code: 'TEST-PC-9', expiresAt: new Date().toISOString() };
  assert.equal(validPcSessionAccessPayload(good), true);
  assert.equal(validPcSessionAccessPayload({ ...good, personRef: 'someone' }), false);
  assert.equal(validPcSessionAccessPayload({ status: 'available', code: 'TEST-PC-9' }), false);
  assert.equal(validPcSessionAccessPayload({ ...good, expiresAt: 'bad' }), false);
});
test('chat goes from verification to secure card without a forced form or AI call', async () => {
  for (const identityVerified of [false, true]) {
    const answer = await analyzeSupportConversation({ messages: [msg('Je suis professeur, je veux mon code session PC')], attachments: [], safetyIdentifier: 'synthetic-pc-test', identityVerified });
    assert.equal(answer.category, 'logiciel'); assert.equal(answer.action, 'continue'); assert.equal(answer.readyToCreate, false); assert.equal(answer.usedAi, false);
    assert.match(answer.reply, identityVerified ? /Ma session PC/ : /confirmons votre identité/);
    assert.equal('code' in answer, false);
  }
});
test('failed PC credentials offer human help instead of another disclosure loop', async () => {
  const messages = [msg('Mon code KOXO'), msg('Ce code ne fonctionne pas')];
  assert.equal(requiresIdentityForPersonalSupport(messages, 'logiciel'), false);
  const answer = await analyzeSupportConversation({ messages, attachments: [], safetyIdentifier: 'synthetic-pc-test', identityVerified: true });
  assert.equal(answer.action, 'offer_case'); assert.match(answer.reply, /référent numérique/); assert.doesNotMatch(answer.reply, /Ma session PC/);
});
