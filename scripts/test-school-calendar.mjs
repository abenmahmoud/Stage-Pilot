import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validCalendarDay, parisToday, calendarMonthBounds, calendarMonthDays, shiftCalendarMonth, parseSchoolCalendarDates, calendarArticleHref } from '../shared/school-calendar.ts';
import { publicCalendarEvents } from '../shared/school-calendar-public.ts';
import { schoolCalendarIcal } from '../shared/school-calendar-ical.ts';
import { parseSiteContentInput } from '../shared/site-content.ts';

const date = { key:'reunion', title:'Réunion des parents', startDate:'2026-09-14', endDate:'2026-09-15', startTime:null, endTime:null, location:'Salle polyvalente' };
const content = { contentType:'article', slug:'rentree', title:'La rentrée', summary:'Les dates de rentrée.', bodyMarkdown:'Rendez-vous au lycée.', category:'Vie du lycée', audience:'tous', assets:[], calendarEvents:[date] };
const item = { id:'11111111-1111-4111-8111-111111111111', status:'publie', audience:'tous', publishedVersion:2, publishedAt:'2026-09-10T08:00:00Z' };
const now = new Date('2026-09-11T08:00:00Z');
const event = publicCalendarEvents(item,content,'2026-09',now)[0];

test('dates réelles, mois complets et minuit de Paris', () => {
  assert.equal(validCalendarDay('2026-02-29'),false);
  assert.equal(validCalendarDay('2028-02-29'),true);
  assert.equal(validCalendarDay('2026-13-01'),false);
  assert.deepEqual(calendarMonthBounds('2028-02'),{start:'2028-02-01',end:'2028-02-29'});
  assert.equal(shiftCalendarMonth('2026-12',1),'2027-01');
  assert.equal(calendarMonthDays('2026-09')[0],'2026-08-31');
  assert.equal(calendarMonthDays('2026-09').at(-1),'2026-10-04');
  assert.equal(parisToday(new Date('2026-09-11T22:10:00Z')),'2026-09-12');
  assert.equal(parisToday(new Date('2026-12-31T23:10:00Z')),'2027-01-01');
});
test('heures inconnues conservées, entrées invalides refusées', () => {
  assert.equal(parseSchoolCalendarDates([date])[0].startTime,null);
  assert.equal(parseSiteContentInput(content).calendarEvents.length,1);
  assert.deepEqual(parseSiteContentInput({...content,calendarEvents:undefined}).calendarEvents,[]);
  for (const invalid of [ {startDate:'2026-02-30'}, {endDate:'2026-09-01'}, {endTime:'18:00'}, {startTime:'25:00'}, {key:'bad\nBEGIN:VEVENT'}, {title:'X\r\nLOCATION:private'}, {unexpected:'value'} ]) {
    assert.throws(() => parseSchoolCalendarDates([{...date,...invalid}]));
  }
  assert.throws(() => parseSchoolCalendarDates([date,date]));
  assert.throws(() => parseSchoolCalendarDates(Array(13).fill(date)));
});
test('seules les versions publiées et destinées à tous alimentent le calendrier', () => {
  assert.equal(publicCalendarEvents(item,content,'2026-09',now).length,1);
  for (const override of [{publishedVersion:null},{publishedAt:null},{status:'archive'},{audience:'parents'},{publishedAt:'2027-01-01T00:00:00Z'}]) assert.deepEqual(publicCalendarEvents({...item,...override},content,'2026-09',now),[]);
  assert.deepEqual(publicCalendarEvents(item,{...content,audience:'parents'},'2026-09',now),[]);
  assert.deepEqual(publicCalendarEvents(item,{...content,publishAt:'2027-01-01T00:00:00Z'},'2026-09',now),[]);
  // Un brouillon de correction ne retire pas la version déjà publiée.
  assert.equal(publicCalendarEvents({...item,status:'brouillon'},content,'2026-09',now).length,1);
  const api = readFileSync(new URL('../api/content/calendar.ts',import.meta.url),'utf8');
  assert.match(api,/eq\(siteContentVersions\.version, siteContentItems\.publishedVersion\)/);
  assert.doesNotMatch(api,/eq\(siteContentVersions\.version, siteContentItems\.version\)/);
});
test('plages à cheval sur deux mois et archives lisibles', () => {
  const spanning = {...content,calendarEvents:[{...date,startDate:'2026-09-21',endDate:'2026-10-02'}]};
  assert.equal(publicCalendarEvents(item,spanning,'2026-10',now).length,1);
  assert.equal(publicCalendarEvents(item,spanning,'2026-11',now).length,0);
  const expired=publicCalendarEvents(item,{...content,expiresAt:'2026-09-15T21:59:00Z'},'2026-09',new Date('2026-10-01T08:00:00Z'))[0];
  assert.equal(expired.articleExpired,true);
  assert.equal(calendarArticleHref(expired),'/site/rentree?archive=expired');
});
test('ICS : fin exclusive, UTF-8, échappement et identité stable', () => {
  const title='Réunion école; parents, '+ 'élèves '.repeat(17);
  const ics=schoolCalendarIcal([{...event,title}]);
  assert.match(ics,/DTSTART;VALUE=DATE:20260914\r\nDTEND;VALUE=DATE:20260916/);
  assert.doesNotMatch(ics,/T000000|TZID/);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line,'utf8')<=75);
  const unfolded=ics.replace(/\r\n[ \t]/g,'');
  assert.ok(unfolded.includes('SUMMARY:'+title.replace(/;/g,'\\;').replace(/,/g,'\\,')));
  assert.match(unfolded,/UID:11111111-1111-4111-8111-111111111111-reunion@lycee-blaise-cendrars-sevran.fr/);
  assert.match(ics,/SEQUENCE:2/);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});
test('ICS : heure de Paris connue, durée jamais inventée', () => {
  const timed={...event,endDate:event.startDate,startTime:'17:30',endTime:null};
  const ics=schoolCalendarIcal([timed]);
  assert.match(ics,/TZID:Europe\/Paris/);
  assert.match(ics,/DTSTART;TZID=Europe\/Paris:20260914T173000/);
  assert.doesNotMatch(ics,/DTEND/);
  assert.match(schoolCalendarIcal([{...timed,endTime:'19:00'}]),/DTEND;TZID=Europe\/Paris:20260914T190000/);
});
