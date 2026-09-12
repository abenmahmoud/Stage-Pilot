import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { filterIcalCalendars, prepareIcalDrafts } from '../shared/schedule-ical-review.ts';
import { parseIcalDecisions } from '../shared/schedule-ical-contract.ts';

const calendar = (overrides = {}) => ({ id: randomUUID(), calendarNumber: 1, label: 'Élodie TEST', suggestedRef: 'TEST.2', subjectRef: null, matchStatus: 'exact', status: 'pending', decision: null, courseCount: 80, groupCourses: 0, nonCourse: 0, withoutRoom: 2, firstDate: '2026-09-01', lastDate: '2027-07-01', failureCode: null, ...overrides });
const review = calendars => ({ sourceId: randomUUID(), sourceKind: 'teachers', sourceStatus: 'review', calendars });

test('bulk preparation preserves human choices and never includes uncertain or locked calendars', () => {
  const exact = calendar(), edited = calendar(), uncertain = calendar({ matchStatus: 'not_found' }), applied = calendar({ status: 'applied' }), queued = calendar({ status: 'queued' }), failed = calendar({ status: 'failed' });
  const choice = { id: edited.id, decision: 'exclude', subjectRef: null };
  const current = { [edited.id]: choice };
  const next = prepareIcalDrafts(review([exact, edited, uncertain, applied, queued, failed]), current, 'exact');
  assert.deepEqual(Object.keys(next).sort(), [edited.id, exact.id].sort());
  assert.deepEqual(next[edited.id], choice);
  assert.deepEqual(current, { [edited.id]: choice });
  assert.equal(next[exact.id].subjectRef, 'TEST.2');
  assert.ok(parseIcalDecisions({ decisions: Object.values(next) }));
});

test('empty exclusion is a draft, requires zero courses, and cannot affect approved versions', () => {
  const empty = calendar({ matchStatus: 'empty', courseCount: 0 }), contradictory = calendar({ matchStatus: 'empty' }), unknown = calendar({ courseCount: 0, matchStatus: 'not_found' });
  const source = review([empty, contradictory, unknown]);
  const next = prepareIcalDrafts(source, {}, 'empty');
  assert.deepEqual(next, { [empty.id]: { id: empty.id, decision: 'exclude', subjectRef: null } });
  assert.equal(empty.status, 'pending'); assert.equal(empty.decision, null);
  assert.deepEqual(prepareIcalDrafts({ ...source, sourceStatus: 'active' }, {}, 'empty'), {});
});

test('filters keep failed work visible, separate applied exclusions, and preserve numbered references', () => {
  const exact = calendar(), failed = calendar({ status: 'failed', label: 'Recette' }), empty = calendar({ matchStatus: 'empty', courseCount: 0 });
  const excluded = calendar({ status: 'applied', decision: 'exclude', matchStatus: 'empty', courseCount: 0 });
  const ambiguous = calendar({ matchStatus: 'ambiguous' });
  const all = [exact, failed, empty, excluded, ambiguous];
  assert.equal(filterIcalCalendars(all, 'pending', '').length, 4);
  assert.deepEqual(filterIcalCalendars(all, 'applied', ''), [excluded]);
  assert.deepEqual(filterIcalCalendars(all, 'empty', ''), [empty]);
  assert.deepEqual(filterIcalCalendars(all, 'unmatched', ''), [ambiguous]);
  assert.deepEqual(filterIcalCalendars(all, 'all', 'elodie TEST.2').includes(exact), true);
  assert.deepEqual(filterIcalCalendars(all, 'all', 'TEST.3'), []);
});

test('duplicate exact suggestions still require correction before submission', () => {
  const next = prepareIcalDrafts(review([calendar(), calendar()]), {}, 'exact');
  assert.equal(parseIcalDecisions({ decisions: Object.values(next) }), null);
});
