import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestEntReply, isSupportReplySuggestion } from '../shared/support-reply-suggestion.ts';
const evidence = { state: 'inactive', code: 'available', checkedAt: '2026-09-15T12:00:00.000Z' };
test('inactive account with an assignment guides secure self-service', () => {
  const r = suggestEntReply(evidence, false);
  assert.match(r.draft, /Afficher mon code d’activation/);
  assert.match(r.draft, /code reçu par SMS ou email/);
  assert.match(r.draft, /propre nom, prénom et compte de parent/);
  assert.match(r.facts.join(' '), /contrôle final lors de la remise/);
});
test('active account gives reset, never initial activation', () => {
  const r = suggestEntReply({ ...evidence, state: 'active' }, false);
  assert.match(r.draft, /Mot de passe oublié/);
  assert.doesNotMatch(r.draft, /Afficher mon code d’activation/);
});
test('missing and defective codes require a referent instead of promising disclosure', () => {
  for (const code of ['missing', 'review']) {
    const r = suggestEntReply({ ...evidence, code }, false);
    assert.match(r.draft, /vérifié par le référent/);
    assert.doesNotMatch(r.draft, /Afficher mon code d’activation/);
  }
});
test('old or unbound requests do not invent a matching person', () => {
  const r = suggestEntReply({ ...evidence, state: 'unlinked' }, false);
  assert.match(r.facts[0], /n’a pas de lien/);
  assert.doesNotMatch(r.sources.join(' '), /import ENT|Attributions/);
  assert.match(r.draft, /Dans ce dossier, choisissez « Retrouver mon accès ENT »/);
  assert.match(r.draft, /sans créer une nouvelle demande/);
  assert.doesNotMatch(r.draft, /Écrivez « Je souhaite retrouver mon accès ENT »/);
});
test('a failed attempt avoids repeating the same recovery instructions', () => {
  for (const state of ['active', 'inactive', 'unlinked', 'unavailable']) {
    const r = suggestEntReply({ ...evidence, state }, true);
    assert.match(r.draft, /n’a pas fonctionné/);
    assert.doesNotMatch(r.draft, /choisissez « Mot de passe oublié|Afficher mon code d’activation/);
  }
});
test('public payload includes no arbitrary private fields and binds request revision', () => {
  const valid = { ...suggestEntReply(evidence, false), publicCode: 'BC-2026-000101', revision: evidence.checkedAt, checkedAt: evidence.checkedAt };
  assert.equal(isSupportReplySuggestion(valid, valid.publicCode, valid.revision), true);
  for (const bad of [{ ...valid, code: 'FAKE-SECRET' }, { ...valid, draft: '' }, { ...valid, draft: 'x'.repeat(5001) }, { ...valid, sources: [null] }]) {
    assert.equal(isSupportReplySuggestion(bad, valid.publicCode, valid.revision), false);
  }
  assert.equal(isSupportReplySuggestion(valid, 'BC-2026-000102', valid.revision), false);
  assert.equal(isSupportReplySuggestion(valid, valid.publicCode, '2026-09-15T13:00:00.000Z'), false);
});
