import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PgDialect } from 'drizzle-orm/pg-core';
import { parseSchedulePreviewRequest, parseScheduleAdminPreview, previewDayBounds } from '../shared/schedule-admin-preview.ts';
import { readScheduleAdminPreview } from '../api/_shared/schedule-admin-preview-reader.ts';

const institution = '33333333-3333-4333-8333-333333333333';
const request = { sourceId: '11111111-1111-4111-8111-111111111111', calendarId: '22222222-2222-4222-8222-222222222222', day: '2026-09-14' };
const source = { label: '2TEST', sourceKind: 'classes', sourceStatus: 'review', updatedAt: new Date('2026-09-13T14:00:00.000Z'), freshUntil: new Date('2026-09-20T21:59:59.999Z'), subjectRef: '2TEST', effectiveFrom: '2026-09-13', effectiveUntil: null };
const course = { subject: 'Français', room: 'B204', startsAt: new Date('2026-09-14T06:20:00.000Z'), endsAt: new Date('2026-09-14T07:20:00.000Z'), inGroup: false };
const dialect = new PgDialect();
function database(first = [source], second = [course]) {
  const queries = [];
  return { queries, execute: async query => { queries.push(dialect.sqlToQuery(query)); return queries.length === 1 ? first : second; } };
}

test('only scalar bound identifiers and real calendar dates are accepted', () => {
  assert.deepEqual(parseSchedulePreviewRequest(request), request);
  for (const bad of [{ ...request, day: '2026-02-30' }, { ...request, day: ['2026-09-14'] }, { ...request, calendarId: '2TEST' }, { ...request, studentRef: 'private' }, { ...request, sourceId: '../secret' }]) {
    assert.equal(parseSchedulePreviewRequest(bad), null);
  }
});
test('Paris day boundaries cover both changes of daylight saving time', () => {
  assert.equal(previewDayBounds('2026-09-14').dayStart.toISOString(), '2026-09-13T22:00:00.000Z');
  const spring = previewDayBounds('2026-03-29'), autumn = previewDayBounds('2026-10-25');
  assert.equal(spring.dayEnd - spring.dayStart + 1, 23 * 3600_000);
  assert.equal(autumn.dayEnd - autumn.dayStart + 1, 25 * 3600_000);
});
test('review source preview preserves saved times, room and group distinction without activating it', async () => {
  const tx = database([source], [course, { ...course, subject: 'Spécialité', inGroup: true }]);
  const result = await readScheduleAdminPreview(tx, institution, request);
  assert.equal(result.sourceStatus, 'review');
  assert.equal(result.courses.length, 2);
  assert.equal(result.courses[0].startsAt, '2026-09-14T06:20:00.000Z');
  assert.equal(result.courses[1].inGroup, true);
  assert.equal(result.courses[0].room, 'B204');
  assert.equal('subjectRef' in result, false);
  assert.equal('institutionId' in result, false);
  const [metadata, slots] = tx.queries;
  for (const query of tx.queries) {
    assert.doesNotMatch(query.sql, /\b(update|insert|delete)\b/i);
    assert.ok(query.params.includes(institution));
    assert.ok(query.params.includes(request.sourceId));
  }
  assert.ok(metadata.params.includes(request.calendarId));
  assert.match(metadata.sql, /c\.institution_id=s\.institution_id/);
  assert.match(metadata.sql, /p\.institution_id=s\.institution_id/);
  assert.match(metadata.sql, /c\.status='applied'.*c\.decision='include'/s);
  assert.match(metadata.sql, /p\.review_status='verified'/);
  assert.match(metadata.sql, /securityScan.*='clean'/);
  assert.ok(slots.params.includes(source.subjectRef));
  assert.match(slots.sql, /review_status='approved'/);
  assert.match(slots.sql, /limit 101/);
});
test('inaccessible, excluded or unvalidated source never triggers a slots read', async () => {
  const tx = database([]);
  await assert.rejects(readScheduleAdminPreview(tx, institution, request), { status: 404 });
  assert.equal(tx.queries.length, 1);
});
test('a date outside the applied validity window is rejected before any slots query', async () => {
  const tx = database();
  await assert.rejects(readScheduleAdminPreview(tx, institution, { ...request, day: '2026-09-01' }), { status: 400 });
  assert.equal(tx.queries.length, 1);
});
test('oversized day, malformed output and foreign day cannot be shown as a partial success', async () => {
  await assert.rejects(readScheduleAdminPreview(database([source], Array(101).fill(course)), institution, request), { status: 409 });
  await assert.rejects(readScheduleAdminPreview(database([source], [{ ...course, room: { secret: 'bad' } }]), institution, request), { status: 409 });
  await assert.rejects(readScheduleAdminPreview(database([source], [{ ...course, startsAt: new Date('2026-10-14T06:00:00Z'), endsAt: new Date('2026-10-14T07:00:00Z') }]), institution, request), { status: 409 });
});
test('browser binds preview to exact source, calendar and day; no injected field is accepted', async () => {
  const result = await readScheduleAdminPreview(database(), institution, request);
  assert.deepEqual(parseScheduleAdminPreview(result, request), result);
  for (const bad of [{ ...result, day: '2026-09-15' }, { ...result, calendarId: institution }, { ...result, sourceId: institution }, { ...result, storagePath: 'secret' }, { ...result, sourceStatus: 'quarantined' }, { ...result, courses: [{ ...result.courses[0], student: 'secret' }] }]) {
    assert.equal(parseScheduleAdminPreview(bad, request), null);
  }
});
test('teacher and empty-day previews remain source reads, not learner schedules', async () => {
  const result = await readScheduleAdminPreview(database([{ ...source, sourceKind: 'teachers', label: 'PROF FICTIF' }], []), institution, request);
  assert.equal(result.sourceKind, 'teachers');
  assert.deepEqual(result.courses, []);
});
test('HTTP route requires management authorization and a read-only consistent transaction', async () => {
  const route = await readFile(new URL('../api/schedule/admin/imports/[id]/preview.ts', import.meta.url), 'utf8');
  assert.match(route, /req\.method !== 'GET'/);
  assert.ok(route.indexOf('await requireScheduleManager(req)') < route.indexOf('await db.transaction'));
  assert.match(route, /readScheduleAdminPreview\(tx, context.institutionId, input\)/);
  assert.match(route, /accessMode: 'read only'/);
  assert.match(route, /isolationLevel: 'repeatable read'/);
  assert.match(route, /no-store/);
});
