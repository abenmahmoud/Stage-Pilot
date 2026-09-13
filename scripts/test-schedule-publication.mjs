import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSchedulePublicationPlan, parseSchedulePublicationInput, parseSchedulePublicationReceipt } from '../shared/schedule-publication.ts';

const sourceId = '10000000-0000-4000-8000-000000000001';
const activeSourceId = '10000000-0000-4000-8000-000000000002';
const plan = { sourceId, token: 'a'.repeat(64), readyCount: 88, waitingCount: 16, excludedCount: 0, activeSourceId: null, alreadyPublished: false };
test('publication plan is scoped and bounded without private calendar content', () => {
  assert.deepEqual(parseSchedulePublicationPlan(plan, sourceId), plan);
  for (const bad of [{ ...plan, sourceId: activeSourceId }, { ...plan, token: 'bad' }, { ...plan, readyCount: 250 }, { ...plan, waitingCount: -1 }, { ...plan, storagePath: 'private' }, { ...plan, alreadyPublished: true }]) assert.equal(parseSchedulePublicationPlan(bad, sourceId), null);
});
test('publishing requires explicit ACTIVER and a bounded justification; no arbitrary reference lists', () => {
  const input = { token: plan.token, confirmation: 'ACTIVER', justification: 'Calendriers vérifiés dans EDT et dans l’aperçu.' };
  assert.equal(parseSchedulePublicationInput(input).token, plan.token);
  for (const bad of [{ ...input, confirmation: '' }, { ...input, justification: 'ok' }, { ...input, calendarIds: [] }, { ...input, token: null }]) assert.throws(() => parseSchedulePublicationInput(bad));
});
test('success receipt must match the approved plan exactly, including waiting calendars', () => {
  const receipt = { sourceId, token: plan.token, activeSourceId, readyCount: 88, waitingCount: 16, duplicate: false };
  assert.deepEqual(parseSchedulePublicationReceipt(receipt, plan), receipt);
  for (const bad of [{ ...receipt, readyCount: 104 }, { ...receipt, waitingCount: 0 }, { ...receipt, token: 'b'.repeat(64) }, { ...receipt, sourceId: activeSourceId }, { ...receipt, rows: [] }]) assert.equal(parseSchedulePublicationReceipt(bad, plan), null);
});
test('route keeps manager authorization, read-only preview, bounded body, no-store wrapper and uncertain-commit cleanup', async () => {
  const route = await readFile(new URL('../api/schedule/admin/imports/[id]/publish.ts', import.meta.url), 'utf8');
  assert.ok(route.indexOf('await requireScheduleManager(req)') < route.indexOf('readSchedulePublication(tx'));
  assert.match(route, /handleApi/); assert.match(route, /accessMode: 'read only'/); assert.match(route, /sizeLimit: '4kb'/);
  assert.match(route, /publicationUuid\.test/); assert.match(route, /parseSchedulePublicationInput\(req.body\)/);
  assert.match(route, /if \(!references.length\)/); assert.match(route, /pg_advisory_xact_lock/);
});
