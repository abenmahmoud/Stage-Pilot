import assert from 'node:assert/strict';
import test from 'node:test';
import { parseScheduleIcalBytes } from '../workers/schedule-ical-parser.mjs';
const event = (extra = '') => `BEGIN:VEVENT\r\nUID:fake-course-1\r\nDTSTART:20261026T072000Z\r\nDTEND:20261026T082000Z\r\nSUMMARY;LANGUAGE=fr:MATHEMATIQUES - ENSEIGNANT FICTIF - 30\r\nLOCATION;LANGUAGE=fr:B204\r\nCATEGORIES:Cours\r\n${extra}END:VEVENT\r\n`;
const calendar = events => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-WR-CALNAME;LANGUAGE=fr:Calendrier - 2TEST - du 01 septembre 2026 au\r\n 03 juillet 2027\r\n${events}END:VCALENDAR\r\n`;
const parse = value => parseScheduleIcalBytes(Buffer.from(value));
test('reads folded calendar names, language parameters, room and UTC instants', () => {
  const result = parse(calendar(event()));
  assert.equal(result.calendars[0].label, '2TEST');
  assert.equal(result.courseCount, 1);
  assert.equal(result.calendars[0].events[0].subjectLabel, 'MATHEMATIQUES');
  assert.equal(result.calendars[0].events[0].roomCode, 'B204');
  assert.equal(result.calendars[0].events[0].startsAt, '2026-10-26T07:20:00.000Z');
  assert.equal(result.calendars[0].events[0].groupRef, null);
});
test('keeps group courses distinct without inferring student membership', () => {
  const result = parse(calendar(event().replace(' - 30', ' - <2TEST> <LVA> ALL1')));
  assert.match(result.calendars[0].events[0].groupRef, /^ICALG:/);
  assert.equal(result.calendars[0].stats.groupCourses, 1);
});
test('deduplicates identical UID but blocks contradictory versions', () => {
  assert.equal(parse(calendar(event() + event())).courseCount, 1);
  assert.throws(() => parse(calendar(event() + event().replace('B204', 'B205'))), { code: 'conflicting_uid' });
});
test('reports cancelled and non-course events without turning them into lessons', () => {
  const result = parse(calendar(event('STATUS:CANCELLED\r\n') + event().replace('CATEGORIES:Cours', 'CATEGORIES:Vacances')));
  assert.equal(result.courseCount, 0);
  assert.equal(result.calendars[0].stats.cancelled, 1);
  assert.equal(result.calendars[0].stats.nonCourse, 1);
});
test('fails closed on recurring, floating, malformed or incomplete calendars', () => {
  assert.throws(() => parse(calendar(event('RRULE:FREQ=WEEKLY\r\n'))), { code: 'recurrence_requires_expansion' });
  assert.throws(() => parse(calendar(event().replace('DTSTART:20261026T072000Z', 'DTSTART;TZID=Europe/Paris:20261026T082000'))), { code: 'unsupported_datetime' });
  assert.throws(() => parse(calendar(event()).replace('END:VCALENDAR', '')), { code: 'invalid_calendar' });
  assert.throws(() => parse(calendar(event().replace('20261026T072000Z', '20260230T072000Z'))), { code: 'invalid_datetime' });
  assert.throws(() => parse(calendar(event('DTSTART:20261026T072000Z\r\n'))), { code: 'duplicate_property' });
});
test('handles a multi-calendar annual export without the old 80-row limit', () => {
  const annual = calendar(Array.from({ length: 1200 }, (_, i) => event().replace('fake-course-1', `course-${i}`)).join(''));
  const result = parse(annual + calendar(event()).replace('2TEST', '2OTHER'));
  assert.equal(result.calendars.length, 2);
  assert.equal(result.courseCount, 1201);
  assert.throws(() => parse(annual + annual), { code: 'duplicate_calendar' });
});
