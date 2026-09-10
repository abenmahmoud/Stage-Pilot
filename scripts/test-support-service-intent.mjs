import assert from 'node:assert/strict';
import test from 'node:test';
import { accessGuidanceKind, requestsOwnClass, requiresIdentityForPersonalSupport } from '../shared/support-service-intent.ts';
import { analyzeSupportConversation } from '../api/_shared/support-agent.ts';

process.env.OPENAI_API_KEY = '';
const messages = content => [{ role: 'requester', content }];
const analyze = (conversation, extra = {}) => analyzeSupportConversation({ messages: conversation, attachments: [], safetyIdentifier: 'synthetic-service-flow', ...extra });

test('class lookup has a narrow own-class intent, preserving timetable and third-party requests', () => {
  for (const text of ['Quelle est ma classe ?', 'Je voudrais connaître ma classe', 'Dans quelle classe suis-je ?', 'Ma classe']) {
    // Hyphenated wording must be recognized as ordinary French.
    assert.equal(requestsOwnClass(messages(text)), true, text);
  }
  for (const text of ['Mon emploi du temps de ma classe', 'La salle de ma classe', 'La classe de mon enfant', 'Changer ma classe', 'La liste des élèves de ma classe']) {
    assert.equal(requestsOwnClass(messages(text)), false, text);
  }
});

test('private class request still requires identity while public guidance does not', () => {
  assert.equal(requiresIdentityForPersonalSupport(messages('Quelle est ma classe ?'), 'affectation_classe'), true);
  assert.equal(requiresIdentityForPersonalSupport(messages('Dans quelle classe suis-je ?'), 'affectation_classe'), true);
  for (const text of ['Comment réinitialiser mon mot de passe ENT ?', 'Comment payer la cantine pour mon enfant ?', 'Quel formulaire pour une autorisation d’absence ?']) {
    assert.equal(requiresIdentityForPersonalSupport(messages(text), 'ent'), false, text);
  }
  assert.equal(requiresIdentityForPersonalSupport(messages('Donnez-moi mes codes ENT'), 'ent'), true);
});

test('failed recovery leads to a request on consent, without a repeated reset or OTP gate', async () => {
  const history = messages('Comment réinitialiser mon mot de passe ENT ?');
  const first = await analyze(history);
  assert.equal(first.readyToCreate, false);
  history.push({ role: 'assistant', content: first.reply }, { role: 'requester', content: 'J’ai déjà essayé, je ne reçois aucun email.' });
  assert.equal(accessGuidanceKind(history), 'recovery_failed');
  const failed = await analyze(history);
  assert.equal(failed.action, 'offer_case');
  assert.match(failed.reply, /pas à refaire/);
  assert.equal(requiresIdentityForPersonalSupport(history, failed.category), false);
  history.push({ role: 'assistant', content: failed.reply }, { role: 'requester', content: 'Oui' });
  const accepted = await analyze(history);
  assert.equal(accepted.readyToCreate, true);
  assert.equal(requiresIdentityForPersonalSupport(history, accepted.category), false);
});

test('own class is answered directly only through the authorized reader, never by the model', async () => {
  const history = messages('Quelle est ma classe ?');
  const anonymous = await analyze(history, { ownClassReader: async () => ({ ok: false, reason: 'identity_required' }) });
  assert.equal(anonymous.readyToCreate, false);
  assert.match(anonymous.reply, /identité/);
  const verified = await analyze(history, { ownClassReader: async () => ({ ok: true, classRef: '2GT-TEST' }) });
  assert.match(verified.reply, /2GT-TEST/);
  assert.equal(verified.readyToCreate, false);
  assert.equal(verified.usedAi, false);
  const unavailable = await analyze(history, { identityVerified: true, ownClassReader: async () => ({ ok: false, reason: 'class_unavailable' }) });
  assert.equal(unavailable.action, 'offer_case');
  assert.doesNotMatch(unavailable.reply, /confirmez votre identité|code de vérification/i);
  for (const classRef of ['', '<script>bad</script>', 'X'.repeat(81)]) {
    const invalid = await analyze(history, { ownClassReader: async () => ({ ok: true, classRef }) });
    assert.equal(invalid.action, 'offer_case');
    assert.doesNotMatch(invalid.reply, /<script>/);
  }
});

test('a third-party question cannot call the own-class reader', async () => {
  let reads = 0;
  await analyze(messages('Quelle est la classe de mon enfant ?'), { ownClassReader: async () => { reads++; return { ok: true, classRef: '2GT-TEST' }; } });
  assert.equal(reads, 0);
});
