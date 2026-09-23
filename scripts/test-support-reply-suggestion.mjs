import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestEntReply, suggestPcSessionReply, suggestPronoteReply, suggestScheduleReply, isSupportReplySuggestion } from '../shared/support-reply-suggestion.ts';
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
test('schedule and Pronote drafts guide without inventing a personal timetable or identifier', () => {
  const schedule = suggestScheduleReply();
  assert.match(schedule.draft, /Confirmez votre identité/);
  assert.match(schedule.draft, /même dossier/);
  assert.doesNotMatch(schedule.draft, /Votre cours est|salle [A-Z0-9]/);
  const pronote = suggestPronoteReply();
  assert.match(pronote.draft, /PRONOTE passe par votre compte personnel monlycée.net/);
  assert.match(pronote.draft, /même dossier|ce dossier/);
  assert.doesNotMatch(pronote.draft, /Identifiant :|Code :/);
});

test('PC session draft uses OTP self-service without exposing credentials', () => {
  const pc = suggestPcSessionReply();
  assert.match(pc.draft, /Je veux mes codes de session PC/);
  assert.match(pc.draft, /SMS ou par email/);
  assert.match(pc.draft, /même dossier/);
  assert.doesNotMatch(pc.draft, /Identifiant\s*:\s*\S+|Code\s*:\s*\S+/);
});
