import assert from 'node:assert/strict';
import test from 'node:test';
import { familySchoolChatService } from '../api/_shared/family-school-chat-service.ts';
import { familySchoolAnswer } from '../api/_shared/family-school-chat-answer.ts';
import { analyzeSupportConversation } from '../api/_shared/support-agent.ts';
import { familySchoolIntent, isSchoolTargetChoices } from '../shared/family-school-chat.ts';
import { schoolChatTranscript, PRIVATE_SCHOOL_PLACEHOLDER } from '../shared/school-chat-privacy.ts';
import { parseSupportAssistantInput } from '../shared/support-assistant-input-policy.ts';
import { isValidSupportAssistantPayload } from '../shared/support-assistant-payload-policy.ts';

process.env.OPENAI_API_KEY = '';
const now = new Date('2026-09-14T06:00:00.000Z');
const identity = { id: 'session-parent', institutionId: 'school-test', sourceImportId: 'active-test', personRef: 'parent-test', personType: 'guardian', expiresAt: new Date('2026-09-14T06:30:00.000Z') };
const children = [{ key: 'a'.repeat(64), personRef: 'student-test-a', classRef: '2GT1', label: 'Enfant 1 · 2GT1' }, { key: 'b'.repeat(64), personRef: 'student-test-b', classRef: '2GT2', label: 'Enfant 2 · 2GT2' }];
const course = { subjectCode: 'MATH', subjectLabel: 'Mathématiques', roomCode: '204', startsAt: '2026-09-15T06:00:00.000Z', endsAt: '2026-09-15T07:00:00.000Z', state: 'scheduled' };
const schedule = { ok: true, courses: [course], source: { versionId: 'private-version', sourceType: 'official_export', activatedAt: '2026-09-13T09:00:00.000Z', freshUntil: '2026-09-20T09:00:00.000Z' } };
const intent = { kind: 'schedule', day: 1, explicitChild: true };
const message = content => ({ role: 'requester', content });
function fixture(overrides = {}) {
  const calls = [];
  const readers = { identity: async () => identity, targets: async () => children,
    schedule: async (target, bounds) => { calls.push({ target, bounds }); return schedule; }, clock: () => now, ...overrides };
  return { calls, readers, run: (key, wanted = intent) => familySchoolChatService(wanted, key, readers) };
}
const fail = async () => assert.fail('unauthorized private read');

test('anonymous, expired and non-parent identities cannot read children', async () => {
  for (const value of [null, { ...identity, expiresAt: now }]) {
    const f = fixture({ identity: async () => value, targets: fail, schedule: fail });
    assert.equal((await f.run()).status, 'identity_required');
    assert.equal(await f.run(undefined, { ...intent, explicitChild: false }), null);
  }
  for (const personType of ['student', 'staff']) {
    const f = fixture({ identity: async () => ({ ...identity, personType }), targets: fail, schedule: fail });
    assert.equal((await f.run()).status, 'forbidden');
    assert.equal(await f.run(undefined, { ...intent, explicitChild: false }), null);
  }
});
test('several linked children require a choice; neither names nor ordinal claims authorize access', async () => {
  const f = fixture(), result = await f.run();
  assert.equal(result.status, 'choose_child'); assert.equal(f.calls.length, 0);
  assert.ok(isSchoolTargetChoices(result.choices, now.getTime()));
  assert.equal(result.choices.options.length, 2);
  for (const hidden of ['student-test-a', 'parent-test', 'school-test', 'active-test']) assert.equal(JSON.stringify(result).includes(hidden), false);
});
test('a single linked child is selected directly; class lookup does not read the timetable', async () => {
  const f = fixture({ targets: async () => [children[1]] });
  assert.equal((await f.run()).label, children[1].label);
  assert.equal(f.calls[0].target.personRef, children[1].personRef);
  const c = fixture({ targets: async () => [children[1]], schedule: fail });
  assert.equal((await c.run(undefined, { ...intent, kind: 'class' })).classRef, '2GT2');
});
test('an opaque selection resolves only against the current authorized children and Paris day bounds', async () => {
  const f = fixture(); const result = await f.run(children[1].key);
  assert.equal(result.status, 'schedule'); assert.equal(f.calls[0].target.personRef, children[1].personRef);
  assert.equal(f.calls[0].bounds.dayDate, '2026-09-15');
  assert.equal(f.calls[0].bounds.dayStart.toISOString(), '2026-09-14T22:00:00.000Z');
  for (const key of ['c'.repeat(64), children[1].personRef, 'Enfant 1']) {
    const forbidden = fixture({ schedule: fail }); assert.equal((await forbidden.run(key)).status, 'forbidden');
  }
});
test('missing day is clarified after choosing a child, with no timetable read', async () => {
  const result = await fixture({ schedule: fail }).run(children[1].key, { ...intent, day: null });
  assert.equal(result.status, 'day_required'); assert.equal(result.label, children[1].label);
});
test('missing, duplicate, malformed or excessive relationships fail closed', async () => {
  for (const targets of [[], [children[0], children[0]], [{ ...children[0], personRef: 'x' }], [{ ...children[0], classRef: '<bad>' }],
    [{ ...children[0], key: 'client-name' }], [{ ...children[0], label: 'a\nb' }], Array.from({ length: 21 }, (_, i) => ({ ...children[0], key: String(i).padStart(64, 'a') }))]) {
    assert.equal((await fixture({ targets: async () => targets, schedule: fail }).run()).status, 'unavailable');
  }
});
test('changed identity, retired source and expired session discard an in-flight response', async () => {
  for (const replacement of [null, { ...identity, id: 'other-session' }, { ...identity, personRef: 'other-parent' },
    { ...identity, sourceImportId: 'other-import' }, { ...identity, institutionId: 'other-school' }, { ...identity, personType: 'staff' }, { ...identity, expiresAt: now }]) {
    let reads = 0;
    const f = fixture({ identity: async () => ++reads === 1 ? identity : replacement });
    assert.equal((await f.run(children[0].key)).status, 'identity_required');
  }
});
test('revoked or modified links during reads cannot release choices, classes or courses', async () => {
  for (const target of [undefined, children[0].key]) for (const newTargets of [[], [{ ...children[0], classRef: 'OTHER' }, children[1]], [{ ...children[0], personRef: 'other-child' }, children[1]]]) {
    let reads = 0;
    assert.equal((await fixture({ targets: async () => ++reads === 1 ? children : newTargets }).run(target)).status, 'unavailable');
  }
});
test('freshness and course structure are checked before release', async () => {
  for (const altered of [{ ...schedule, source: { ...schedule.source, freshUntil: now.toISOString() } },
    { ...schedule, source: { ...schedule.source, freshUntil: 'invalid' } }, { ...schedule, courses: [{ ...course, personRef: 'private-child' }] },
    { ...schedule, courses: [{ ...course, endsAt: course.startsAt }] }]) {
    assert.equal((await fixture({ schedule: async () => altered }).run(children[0].key)).status, 'unavailable');
  }
});
test('expiration during the final relationship check discards the response', async () => {
  let time = now, reads = 0;
  const result = await fixture({ clock: () => time, targets: async () => { if (++reads === 2) time = identity.expiresAt; return children; } }).run();
  assert.equal(result.status, 'identity_required');
});
test('unsupported days and new subjects do not silently reuse today or another request', () => {
  for (const text of ['Les cours de mon enfant demain', 'L’emploi du temps de ma fille demain']) assert.equal(familySchoolIntent([message(text)]).day, 1);
  assert.equal(familySchoolIntent([message('Quelle est la classe de mon fils ?')]).kind, 'class');
  for (const text of ['Les cours de mon fils lundi', 'Les cours de mon enfant la semaine prochaine']) assert.equal(familySchoolIntent([message(text)]).day, null);
  const context = [message('Je veux les cours de mon enfant'), message('oui demain'), message('aujourd’hui')];
  assert.equal(familySchoolIntent(context).day, 0); assert.equal(familySchoolIntent(context).explicitChild, true);
  assert.equal(familySchoolIntent([message('Les cours de mon enfant'), message('Je veux le menu'), message('demain')]), null);
  for (const text of ['Signaler l’absence de mon fils', 'Changer la classe de mon enfant', 'Les cours d’un autre enfant']) assert.equal(familySchoolIntent([message(text)]), null);
});
test('school replies never appear in saved or model-bound history; conversation order is kept', () => {
  const wire = schoolChatTranscript([message('Les cours de mon enfant demain'), { role: 'assistant', content: 'PRIVATE TIMETABLE', privateSchoolReply: true, schoolTargets: children }, message('Et aujourd’hui ?')]);
  assert.equal(wire[1].content, PRIVATE_SCHOOL_PLACEHOLDER);
  assert.equal(JSON.stringify(wire).includes('PRIVATE'), false);
  assert.ok(parseSupportAssistantInput({ sessionId: 'session-test-123456', messages: wire }));
});
test('strict input accepts only an opaque optional selector, never a raw person reference', () => {
  const input = { sessionId: 'session-test-123456', messages: [message('Les cours de mon enfant demain')] };
  assert.equal(parseSupportAssistantInput({ ...input, schoolTargetKey: children[0].key }).schoolTargetKey, children[0].key);
  for (const key of [null, undefined, '', 'student-test-a', ['a'.repeat(64)], 'a'.repeat(65)]) assert.equal(parseSupportAssistantInput({ ...input, schoolTargetKey: key }), null);
  assert.equal(parseSupportAssistantInput({ ...input, targetPersonRef: 'student-test-a' }), null);
});
const payload = result => ({ ...result, routingReceipt: null, routingReceiptExpiresAt: null, normalizationReceipt: null, normalizationReceiptExpiresAt: null, requestActionAuthorized: false });
async function answerFor(content, reader) {
  return analyzeSupportConversation({ messages: [message(content)], attachments: [], safetyIdentifier: 'test-session', now, identityVerified: true, familySchoolReader: reader,
    knowledgeContextLoader: fail, scheduleDayReader: fail, ownClassReader: fail });
}
test('chat routes directly to the protected reader and validates choice and timetable payloads', async () => {
  const f = fixture();
  for (const key of [undefined, children[1].key]) {
    const result = await answerFor('Je veux les cours de mon enfant demain', i => f.run(key, i));
    assert.equal(result.usedAi, false); assert.equal(result.readyToCreate, false);
    assert.ok(isValidSupportAssistantPayload(payload(result), now.getTime()));
    if (key) { assert.match(result.schedule.title, /Enfant 2/); assert.equal(result.schedule.courses[0].subjectLabel, 'Mathématiques'); }
    else assert.equal(result.schoolTargets.options.length, 2);
  }
});
test('SafeScol is intercepted before any school reader; normal student schedule still uses its existing reader', async () => {
  const safe = await answerFor('Mon enfant est victime de harcèlement', fail);
  assert.equal(safe.scope, 'safescol');
  let ownReads = 0;
  const student = await analyzeSupportConversation({ messages: [message('Mon emploi du temps demain')], attachments: [], safetyIdentifier: 'test', now,
    familySchoolReader: async () => null, scheduleDayReader: async () => { ownReads++; return schedule; } });
  assert.equal(ownReads, 1); assert.equal(student.schedule.courses.length, 1);
});
test('the old third-party rule yields only to the authenticated narrow reader for class and timetable requests', async () => {
  for (const text of ['Quelle est la classe de mon enfant ?', 'Je veux l’emploi du temps de ma fille demain']) {
    const result = await answerFor(text, i => fixture().run(undefined, i));
    assert.equal(result.schoolTargets.options.length, 2); assert.equal(result.readyToCreate, false);
    const anonymous = await answerFor(text, async () => ({ status: 'identity_required' }));
    assert.match(anonymous.reply, /confirmez votre identité/i); assert.equal(anonymous.readyToCreate, false);
  }
  for (const text of ['Je veux les absences de mon enfant', 'Je veux les notes de mon enfant et sa classe', 'Je veux les coordonnées de mon enfant et sa classe', 'Je veux la classe d’un autre élève']) {
    const result = await answerFor(text, fail); assert.equal(result.schoolTargets, undefined); assert.equal(result.schedule, undefined);
  }
});
test('verified missing school data produces one useful fallback, without another OTP request', async () => {
  for (const result of [{ status: 'unavailable' }, { status: 'forbidden' }, { status: 'class', label: 'Enfant 1', classRef: null },
    { status: 'schedule', label: 'Enfant 1', day: 1, result: { ok: false, reason: 'source_unavailable' } }]) {
    const answer = await answerFor('Les cours de mon enfant demain', async () => result);
    assert.equal(answer.action, 'offer_case'); assert.equal(answer.readyToCreate, true); assert.equal(answer.schoolTargets, undefined);
    assert.doesNotMatch(answer.reply, /code|confirmez votre identité/i); assert.ok(isValidSupportAssistantPayload(payload(answer), now.getTime()));
  }
  const outage = await answerFor('Les cours de mon enfant demain', async () => { throw new Error('private DB error'); });
  assert.equal(outage.action, 'offer_case'); assert.doesNotMatch(outage.reply, /private DB/);
  const empty = await answerFor('La classe de mon enfant', async () => null);
  assert.equal(empty.action, 'offer_case'); assert.equal(empty.usedAi, false);
});
test('choice response forbids extra identity fields, expired keys and model generated selections', async () => {
  const valid = payload(await answerFor('Les cours de mon enfant demain', i => fixture().run(undefined, i)));
  for (const mutate of [v => { v.schoolTargets.options[0].personRef = 'secret'; }, v => { v.schoolTargets.expiresAt = now.toISOString(); },
    v => { v.schoolTargets.options[0].key = 'raw-person'; }, v => { v.usedAi = true; }, v => { v.readyToCreate = true; },
    v => { v.schoolTargets.options.push(v.schoolTargets.options[0]); }, v => { v.schoolTargets.email = 'secret'; }]) {
    const v = structuredClone(valid); mutate(v); assert.equal(isValidSupportAssistantPayload(v, now.getTime()), false);
  }
});
