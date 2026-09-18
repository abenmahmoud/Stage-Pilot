import test from 'node:test';
import assert from 'node:assert/strict';
import { canRequesterResolve, shouldReopenOnRequesterMessage } from '../shared/support-requester-resolution.ts';

test('requester may confirm resolution of an active dossier, including one awaiting the school', () => {
  for (const status of ['nouveau', 'a_qualifier', 'assigne', 'en_cours', 'attente_demandeur', 'attente_interne']) {
    assert.equal(canRequesterResolve(status), true, status);
  }
  for (const status of ['resolu', 'clos', 'indesirable']) {
    assert.equal(canRequesterResolve(status), false, status);
  }
});

test('a new requester message reopens a resolved dossier but cannot reopen a closed or unwanted one', () => {
  assert.equal(shouldReopenOnRequesterMessage('resolu'), true);
  assert.equal(shouldReopenOnRequesterMessage('attente_demandeur'), true);
  assert.equal(shouldReopenOnRequesterMessage('clos'), false);
  assert.equal(shouldReopenOnRequesterMessage('indesirable'), false);
});
