import assert from 'node:assert/strict';
import { test } from 'node:test';
import { directoryIdentityMatches, directoryContactOptions, publicIdentityContactOptions } from '../shared/identity-contact-choices.mjs';
import { parseIdentityDeviceIdentifyInput } from '../shared/identity-device-access.ts';

const claim = { claimedProfile: 'guardian', claimedFirstName: 'Élodie', claimedLastName: 'Le-Martin', deviceId: 'device-test-1234567890', rememberDevice: false };
test('identify accepts identity alone, rejects client supplied destinations', () => {
  assert.deepEqual(parseIdentityDeviceIdentifyInput(claim), claim);
  for (const injected of [{ contact: 'intruder@example.test' }, { contactType: 'phone' }, { personRef: 'x' }]) {
    assert.throws(() => parseIdentityDeviceIdentifyInput({ ...claim, ...injected }));
  }
});
test('matching preserves accents, multiple given names and profile boundary', () => {
  const person = { firstName: 'Elodie Marie', lastName: 'LE MARTIN', personType: 'guardian' };
  assert.equal(directoryIdentityMatches(claim, person), true);
  assert.equal(directoryIdentityMatches({ ...claim, claimedFirstName: 'Elo' }, person), false);
  assert.equal(directoryIdentityMatches(claim, { ...person, personType: 'student' }), false);
  assert.equal(directoryIdentityMatches({ ...claim, claimedLastName: 'Martin' }, person), false);
});
test('only known contacts, deduplicated and masked; no clear personal address or phone in public payload', () => {
  const options = directoryContactOptions({ phone: '06 00 00 00 57', academicEmail: 'Camille@example.test', personalEmail: 'camille@example.test' });
  assert.equal(options.length, 2);
  assert.deepEqual(publicIdentityContactOptions(options), [
    { id: 'phone', type: 'phone', label: '06 ** ** ** 57' },
    { id: 'academic_email', type: 'email', label: 'c***@example.test' },
  ]);
  assert.doesNotMatch(JSON.stringify(publicIdentityContactOptions(options)), /camille|33600000057|value|personRef/);
});
test('missing contacts and a French landline cannot manufacture an SMS option', () => {
  assert.deepEqual(directoryContactOptions({}), []);
  assert.deepEqual(directoryContactOptions({ phone: '01 00 00 00 00', personalEmail: 'invalid' }), []);
  assert.equal(directoryContactOptions({ personalEmail: 'parent@example.test' })[0].type, 'email');
});
