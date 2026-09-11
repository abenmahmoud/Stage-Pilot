import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { schoolDayBoundsUtc } from '../shared/assistant-school-context.ts';
import { isPersonalHome } from '../shared/personal-home.ts';

const now = new Date('2026-09-14T06:00:00.000Z');
class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [now.getTime()])); } static now() { return now.getTime(); } }
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
function load(path, dependencies) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, Date: FixedDate, Intl, Promise, process: { env: {} }, require(name) { assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name]; } });
  return exports;
}
const { personalHomeService } = load('../api/_shared/personal-home-service.ts', {
  '../../shared/assistant-school-context.js': { schoolDayBoundsUtc }, './auth.js': { HttpError },
});
const identity = { id: 'session-one', institutionId: 'school-one', sourceImportId: 'active-import', personRef: 'person-one', personType: 'student', expiresAt: new Date('2026-09-14T18:00:00.000Z') };
const key = 'a'.repeat(64), childKey = 'b'.repeat(64);
const course = { subjectCode: 'MATH', subjectLabel: 'Mathématiques', roomCode: '204', startsAt: '2026-09-14T06:30:00.000Z', endsAt: '2026-09-14T07:30:00.000Z', state: 'scheduled' };
const goodSchedule = { ok: true, courses: [course], source: { versionId: 'version-one', sourceType: 'official_export', activatedAt: '2026-09-11T08:00:00.000Z', freshUntil: '2026-09-20T12:00:00.000Z' } };
function fixture(overrides = {}) {
  const calls = [];
  const readers = { identity: async () => identity, targets: async () => [{ key, label: 'Ma classe · 2DE1', personRef: identity.personRef }],
    schedule: async (target, bounds) => { calls.push({ target, bounds }); return goodSchedule; }, requests: async () => [], ...overrides };
  return { calls, run: (input = {}) => personalHomeService({ now, day: 0, ...input }, readers) };
}
test('anonymous and expired sessions never invoke private readers', async () => {
  for (const value of [null, { ...identity, expiresAt: new Date('2026-09-14T05:00:00.000Z') }]) {
    const fail = async () => { assert.fail('private reader called'); };
    const f = fixture({ identity: async () => value, targets: fail, schedule: fail, requests: fail });
    assert.equal(JSON.stringify(await f.run()), '{"status":"unavailable"}');
  }
});
test('current verified identity receives only a minimal authorized result', async () => {
  const f = fixture(), result = await f.run();
  assert.equal(result.status, 'verified'); assert.ok(isPersonalHome(result));
  assert.equal(result.schedule.value.courses[0].subjectLabel, 'Mathématiques');
  assert.equal(result.selectedTarget, key); assert.equal(result.date, '2026-09-14');
  for (const secret of ['person-one', 'school-one', 'session-one', 'active-import', 'version-one']) assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(f.calls.length, 1);
});
test('tomorrow uses Paris day boundaries and no client-selected date', async () => {
  const f = fixture(); await f.run({ day: 1 });
  assert.equal(f.calls[0].bounds.dayDate, '2026-09-15');
  assert.equal(f.calls[0].bounds.dayStart.toISOString(), '2026-09-14T22:00:00.000Z');
});
test('forged child key is refused before any schedule or requests are read', async () => {
  const f = fixture({ requests: async () => assert.fail('requests read for forbidden target') });
  await assert.rejects(f.run({ target: childKey }), error => error.status === 403);
  assert.equal(f.calls.length, 0);
});
test('parent may select only a target returned by the authorized relationship reader', async () => {
  const f = fixture({ identity: async () => ({ ...identity, personType: 'guardian' }), targets: async () => [
    { key, label: 'Enfant 1 · 2DE1', personRef: 'child-one' }, { key: childKey, label: 'Enfant 2 · 1G1', personRef: 'child-two' },
  ] });
  const result = await f.run({ target: childKey }); assert.equal(result.selectedTarget, childKey);
  assert.equal(f.calls[0].target.personRef, 'child-two'); assert.ok(isPersonalHome(result));
});
test('missing guardian relationship never substitutes a class or another person', async () => {
  const f = fixture({ identity: async () => ({ ...identity, personType: 'guardian' }), targets: async () => [] });
  const result = await f.run(); assert.equal(result.selectedTarget, null); assert.equal(f.calls.length, 0);
  assert.match(result.schedule.message, /lien avec un enfant/); assert.ok(isPersonalHome(result));
});
test('revocation, switch, retired import and expiration during a read discard all private results', async () => {
  for (const replacement of [null, { ...identity, id: 'second-session' }, { ...identity, personRef: 'other-person' },
    { ...identity, institutionId: 'other-school' }, { ...identity, sourceImportId: 'retired-import' }, { ...identity, expiresAt: new Date('2026-09-14T05:00:00.000Z') }]) {
    let reads = 0;
    const f = fixture({ identity: async () => ++reads === 1 ? identity : replacement });
    assert.equal(JSON.stringify(await f.run()), '{"status":"unavailable"}');
  }
});
test('unavailable, stale, unassociated, and conflicting timetables never become an empty free day', async () => {
  for (const reason of ['source_unavailable', 'source_stale', 'teacher_schedule_unavailable', 'conflicting_changes', 'no_authorized_course']) {
    const result = await fixture({ schedule: async () => ({ ok: false, reason }) }).run();
    assert.equal(result.schedule.status, 'unavailable'); assert.ok(isPersonalHome(result)); assert.ok(!('value' in result.schedule));
  }
});
test('a source which expires while the read is in flight is not displayed', async () => {
  const result = await fixture({ schedule: async () => ({ ...goodSchedule, source: { ...goodSchedule.source, freshUntil: '2026-09-14T05:59:59.000Z' } }) }).run();
  assert.equal(result.schedule.status, 'unavailable'); assert.ok(isPersonalHome(result));
});
test('reader outage does not leak error text or make successful requests disappear', async () => {
  const result = await fixture({ schedule: async () => { throw new Error('secret database information'); }, requests: async () => [{ publicCode: 'BC-2026-000001', subject: 'Document fictif', status: 'attente_demandeur', hasDocument: true }] }).run();
  assert.equal(result.requests.items.length, 1); assert.ok(isPersonalHome(result)); assert.ok(!JSON.stringify(result).includes('secret'));
  const other = await fixture({ requests: async () => { throw new Error('secret'); } }).run();
  assert.equal(other.schedule.status, 'ready'); assert.equal(other.requests.status, 'unavailable'); assert.ok(isPersonalHome(other));
});
test('bounded request preview preserves only three summaries and announces more', async () => {
  const result = await fixture({ requests: async () => Array.from({ length: 4 }, (_, index) => ({ publicCode: `BC-2026-00000${index}`, subject: 'Exemple', status: 'nouveau', hasDocument: false })) }).run();
  assert.equal(result.requests.items.length, 3); assert.equal(result.requests.more, true); assert.ok(isPersonalHome(result));
});
test('contract rejects extra identity data, malformed courses, unknown request statuses and forged selections', async () => {
  const valid = JSON.parse(JSON.stringify(await fixture().run()));
  for (const mutate of [v => { v.email = 'example@example.test'; }, v => { v.selectedTarget = childKey; }, v => { v.targets[0].personRef = 'secret'; },
    v => { v.schedule.value.courses[0].endsAt = v.schedule.value.courses[0].startsAt; },
    v => { v.requests.items = [{ publicCode: 'BC-2026-000001', subject: 'Exemple', status: 'bad-status', hasDocument: true }]; }]) {
    const altered = structuredClone(valid); mutate(altered); assert.equal(isPersonalHome(altered), false);
  }
});

test('HTTP route rejects arbitrary identities/dates and wrong methods without private reads', async () => {
  const route = load('../api/identity/device/today.ts', {
    '../../../shared/identity-device-access.js': { identityDeviceFeatureEnabled: () => true }, '../../../shared/personal-home.js': { isPersonalHome },
    '../../_shared/auth.js': { HttpError }, '../../_shared/identity-device-access.js': { readIdentityDeviceSession: async () => null },
    '../../_shared/personal-home-service.js': { personalHomeService }, '../../_shared/personal-news-reader.js': { readPersonalNewsFeed: async () => assert.fail() }, '../../_shared/personal-home-reader.js': { readPersonalHomeRequests: async () => assert.fail(), readPersonalHomeTargets: async () => assert.fail() },
    '../../_shared/schedule-identity-reader.js': { readCoursesForDayForVerifiedIdentity: async () => assert.fail() },
    '../../_shared/support.js': { enforceSupportRateLimit: async () => assert.fail(), personalHash: () => assert.fail() },
    '../../_shared/response.js': { handleApi: async (res, fn) => { try { res.body = await fn(); } catch (error) { res.statusCode = error.status; } }, methodNotAllowed: res => { res.statusCode = 405; } },
  }).default;
  const response = () => ({ statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; } });
  for (const query of [{ personRef: 'other-person' }, { day: '2026-09-14' }, { day: ['today'] }, { target: 'other-child' }, { target: ['a'.repeat(64)] }]) {
    const res = response(); await route({ method: 'GET', query }, res); assert.equal(res.statusCode, 400);
  }
  const res = response(); await route({ method: 'GET', query: { day: 'today' } }, res);
  assert.equal(JSON.stringify(res.body), '{"status":"unavailable"}'); assert.match(res.headers['Cache-Control'], /no-store/); assert.equal(res.headers.Vary, 'Cookie');
  const wrong = response(); await route({ method: 'POST', query: {} }, wrong); assert.equal(wrong.statusCode, 405);
});
