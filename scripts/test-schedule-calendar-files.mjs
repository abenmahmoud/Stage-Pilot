import assert from 'node:assert/strict';
import test from 'node:test';
import { ZipWriter, BlobWriter, TextReader } from '@zip.js/zip.js';
import { prepareCalendarFiles } from '../src/lib/schedule-calendar-files.ts';
import { parseScheduleIcalBytes } from '../workers/schedule-ical-parser.mjs';
import { SCHEDULE_IMPORT_MAX_BYTES } from '../shared/schedule-import-input.ts';

const calendar = n => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-WR-CALNAME:Calendrier - TEST-${n}\r\nBEGIN:VEVENT\r\nUID:test-${n}\r\nDTSTART:20261026T072000Z\r\nDTEND:20261026T082000Z\r\nSUMMARY:FRANÇAIS - PROFESSEUR FICTIF - 30\r\nLOCATION:B204\r\nCATEGORIES:Cours\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
const ics = n => new File(['\uFEFF' + calendar(n)], `test-${n}.ics`);
async function zip(entries) {
  const writer = new ZipWriter(new BlobWriter('application/zip'), { useWebWorkers: false });
  for (const [name, content, options] of entries) await writer.add(name, new TextReader(content), options);
  return new File([await writer.close()], 'export.zip', { type: 'application/zip' });
}
const prepare = (files, options) => prepareCalendarFiles(files, 'calendriers-classes-2026-2027.ics', options);

test('45 ICS in ZIP become one valid private-import ICS, with accents, labels, rooms and times intact', async () => {
  const file = await zip(Array.from({ length: 45 }, (_, i) => [`EDT/Classe-${i}.ics`, '\uFEFF' + calendar(i)]));
  const progress = [];
  const result = await prepare([file], { onProgress: n => progress.push(n) });
  assert.equal(result.fileCount, 45);
  assert.equal(result.calendarCount, 45);
  assert.equal(result.file.type, 'text/calendar');
  assert.match(result.file.name, /\.ics$/);
  assert.equal(progress.at(-1), 45);
  const parsed = parseScheduleIcalBytes(Buffer.from(await result.file.arrayBuffer()));
  assert.equal(parsed.calendars.length, 45);
  assert.equal(parsed.courseCount, 45);
  assert.equal(parsed.calendars[44].label, 'TEST-44');
  assert.equal(parsed.calendars[0].events[0].subjectLabel, 'FRANÇAIS');
  assert.equal(parsed.calendars[0].events[0].roomCode, 'B204');
  assert.equal(parsed.calendars[0].events[0].startsAt, '2026-10-26T07:20:00.000Z');
});

test('multiple loose ICS still work and per-file BOM does not corrupt calendars', async () => {
  const result = await prepare([ics(1), ics(2)]);
  assert.equal(parseScheduleIcalBytes(Buffer.from(await result.file.arrayBuffer())).courseCount, 2);
});
test('does not silently discard other documents or mix ZIP and loose ICS', async () => {
  const file = await zip([['1.ics', calendar(1)], ['annuaire.csv', 'private']]);
  await assert.rejects(prepare([file]), /uniquement les fichiers .ics/);
  await assert.rejects(prepare([file, ics(2)]), /sans les mélanger/);
  await assert.rejects(prepare([new File(['bad'], 'document.txt')]), /uniquement des fichiers/);
});
test('empty ZIP, corrupt ZIP, encrypted ZIP and non-calendar content fail clearly', async () => {
  await assert.rejects(prepare([await zip([])]), /aucun fichier/);
  await assert.rejects(prepare([new File(['not a zip'], 'bad.zip')]), /incomplet ou endommagé/);
  await assert.rejects(prepare([await zip([['1.ics', calendar(1), { password: 'synthetic-only' }]])]), /mot de passe/);
  await assert.rejects(prepare([await zip([['bad.ics', '<html>bad</html>']])]), /calendrier iCal complet/);
});
test('traversal, absolute names, symlinks and canonical duplicates are rejected', async () => {
  for (const name of ['../bad.ics', '/absolute.ics', 'C:\\bad.ics']) {
    await assert.rejects(prepare([await zip([[name, calendar(1)]])]), /structure du ZIP|incomplet ou endommagé/);
  }
  await assert.rejects(prepare([await zip([['link.ics', calendar(1), { unixMode: 0o120777 }]])]), /structure du ZIP/);
  await assert.rejects(prepare([await zip([['A.ics', calendar(1)], ['a.ics', calendar(2)]])]), /en double/);
});
test('Windows/macOS metadata is ignored without dropping any ICS', async () => {
  const result = await prepare([await zip([['export/', '', { directory: true }], ['export/1.ics', calendar(1)], ['__MACOSX/._1.ics', 'metadata'], ['export/Thumbs.db', 'metadata']])]);
  assert.equal(result.fileCount, 1);
});
test('both loose-file count and actual calendar count are capped at the worker limit', async () => {
  await assert.rejects(prepare(Array.from({ length: 251 }, (_, n) => ics(n))), /250 fichiers/);
  await assert.rejects(prepare([new File([Array.from({ length: 251 }, (_, n) => calendar(n)).join('')], 'lot.ics')]), /250 calendriers/);
  await assert.rejects(prepare([await zip(Array.from({ length: 251 }, (_, n) => [`${n}.ics`, calendar(n)]))]), /250 fichiers/);
});
test('oversized decompressed ZIP and loose inputs are rejected before upload', async () => {
  const huge = 'A'.repeat(SCHEDULE_IMPORT_MAX_BYTES + 1);
  await assert.rejects(prepare([new File([huge], 'lot.ics')]), /50 Mo/);
  const file = await zip([['lot.ics', huge]]);
  assert.ok(file.size < 1024 * 1024);
  await assert.rejects(prepare([file]), /50 Mo/);
});
test('CRC damage cannot produce an apparently successful partial lot', async () => {
  const file = await zip([['1.ics', calendar(1), { level: 0 }], ['2.ics', calendar(2), { level: 0 }]]);
  const bytes = Buffer.from(await file.arrayBuffer());
  const index = bytes.indexOf(Buffer.from('TEST-2'));
  assert.ok(index > 0); bytes[index] = 88;
  await assert.rejects(prepare([new File([bytes], 'corrupt.zip')]), /incomplet ou endommagé/);
});
test('invalid UTF-8, empty calendars and cancelled preparation are rejected', async () => {
  await assert.rejects(prepare([new File([new Uint8Array([255, 255])], 'bad.ics')]), /UTF-8/);
  await assert.rejects(prepare([new File([], 'empty.ics')]), /vide/);
  const controller = new AbortController();
  await assert.rejects(prepare([ics(1), ics(2)], { signal: controller.signal, onProgress: () => controller.abort() }), { name: 'AbortError' });
});
