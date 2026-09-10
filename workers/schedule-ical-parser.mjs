import { createHash } from 'node:crypto';

export const ICAL_LIMITS = Object.freeze({ bytes: 50 * 1024 * 1024, calendars: 250, events: 150_000, eventsPerCalendar: 5_000, line: 64_000 });
export class ScheduleIcalError extends Error {
  constructor(code, message) { super(message); this.name = 'ScheduleIcalError'; this.code = code; }
}
const fail = (code, message) => { throw new ScheduleIcalError(code, message); };
const hash = value => createHash('sha256').update(value).digest('hex');
const unescapeText = value => value.replace(/\\([nN,;\\])/g, (_, c) => /n/i.test(c) ? '\n' : c);
const text = value => unescapeText(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();

function instant(value) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value ?? '');
  if (!m) fail('unsupported_datetime', 'Exportez les occurrences datées avec leurs heures UTC (format PRONOTE).');
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z`;
  const date = new Date(iso);
  if (!Number.isFinite(+date) || date.toISOString() !== iso) fail('invalid_datetime', 'Une date du calendrier est invalide.');
  return iso;
}

function property(line) {
  let quoted = false, delimiter = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    if (line[i] === ':' && !quoted) { delimiter = i; break; }
  }
  if (delimiter < 1 || quoted) fail('invalid_property', 'Une propriété iCal est invalide.');
  const head = line.slice(0, delimiter);
  const key = head.split(';', 1)[0].toUpperCase();
  if (!/^[A-Z0-9-]+$/.test(key)) fail('invalid_property', 'Une propriété iCal est invalide.');
  return { key, value: line.slice(delimiter + 1), parameters: head.slice(key.length) };
}

function courseFromEvent(fields, stats) {
  // This importer consumes expanded official exports. Never silently discard
  // recurrence rules or reinterpret a local/floating date as UTC.
  if (['RRULE', 'EXRULE', 'RDATE', 'EXDATE', 'RECURRENCE-ID'].some(key => fields.has(key))) {
    fail('recurrence_requires_expansion', 'Ce calendrier contient des répétitions non développées. Exportez les occurrences datées avant l’import.');
  }
  const category = text(fields.get('CATEGORIES')?.value);
  const status = text(fields.get('STATUS')?.value).toUpperCase();
  if (status === 'CANCELLED') { stats.cancelled++; return null; }
  if (category && !/^cours(?:\b|\s)/i.test(category)) { stats.nonCourse++; return null; }
  const rawTitle = text(fields.get('SUMMARY')?.value);
  if (!rawTitle) fail('missing_subject', 'Un cours ne contient pas de matière.');
  const startsAt = instant(fields.get('DTSTART')?.value);
  const end = fields.get('DTEND');
  if (!end) fail('missing_end', 'Un cours ne contient pas d’heure de fin.');
  const endsAt = instant(end.value);
  if (+new Date(endsAt) <= +new Date(startsAt) || +new Date(endsAt) - +new Date(startsAt) > 18 * 3600_000) {
    fail('invalid_duration', 'La durée d’un cours doit être comprise entre une minute et dix-huit heures.');
  }
  const subjectLabel = rawTitle.split(/\s+-\s+/)[0].trim();
  const roomCode = text(fields.get('LOCATION')?.value) || null;
  if (subjectLabel.length < 2 || subjectLabel.length > 120 || (roomCode && roomCode.length > 40)) fail('label_too_long', 'Un intitulé ou une salle dépasse la taille autorisée.');
  const groupLabel = rawTitle.includes('<') ? rawTitle.slice(rawTitle.indexOf('<')).replace(/\s+-\s+\d+\s*$/, '').slice(0, 180) : null;
  const groupRef = groupLabel ? `ICALG:${hash(groupLabel).slice(0, 24).toUpperCase()}` : null;
  const uid = text(fields.get('UID')?.value);
  if (!uid || uid.length > 500) fail('invalid_uid', 'Un événement ne possède pas de référence iCal valide.');
  return { uidHash: hash(uid), subjectCode: `ICAL:${hash(subjectLabel).slice(0, 20).toUpperCase()}`, subjectLabel, roomCode, startsAt, endsAt, groupLabel, groupRef, weekPattern: null };
}

export function parseScheduleIcalBytes(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > ICAL_LIMITS.bytes) fail('invalid_size', 'Le dépôt iCal doit contenir entre 1 octet et 50 Mo.');
  let source;
  try { source = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { fail('invalid_encoding', 'Le calendrier doit être encodé en UTF-8.'); }
  if (source.includes('\0')) fail('invalid_encoding', 'Le calendrier contient des caractères invalides.');
  const lines = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const calendars = [];
  const stack = [];
  let current = null, fields = null, eventCount = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.length > ICAL_LIMITS.line) fail('line_too_long', 'Une ligne iCal dépasse la taille autorisée.');
    const p = property(line);
    if (p.key === 'BEGIN') {
      if (p.value === 'VCALENDAR') {
        if (stack.length || calendars.length >= ICAL_LIMITS.calendars) fail('invalid_calendar', 'Le nombre ou la structure des calendriers est invalide.');
        current = { calendarNumber: calendars.length + 1, label: '', events: [], stats: { nonCourse: 0, cancelled: 0, duplicates: 0, withoutRoom: 0, groupCourses: 0 }, seen: new Map(), version: '' };
      } else if (p.value === 'VEVENT') {
        if (stack.join('/') !== 'VCALENDAR') fail('invalid_calendar', 'Un cours est placé hors du calendrier.');
        if (++eventCount > ICAL_LIMITS.events) fail('too_many_events', 'Le dépôt dépasse 150 000 événements.');
        fields = new Map();
      } else if (!current || !['VTIMEZONE', 'STANDARD', 'DAYLIGHT', 'VALARM'].includes(p.value)) fail('unsupported_component', 'Un composant de ce calendrier n’est pas pris en charge.');
      if (stack.length >= 4) fail('invalid_calendar', 'La structure du calendrier est invalide.');
      stack.push(p.value);
      continue;
    }
    if (p.key === 'END') {
      if (stack.pop() !== p.value) fail('invalid_calendar', 'Le calendrier est incomplet ou mal formé.');
      if (p.value === 'VEVENT') {
        const course = courseFromEvent(fields, current.stats);
        if (course) {
          const key = course.uidHash;
          const signature = JSON.stringify(course);
          if (current.seen.has(key)) {
            if (current.seen.get(key) !== signature) fail('conflicting_uid', 'Deux versions contradictoires du même cours sont présentes.');
            current.stats.duplicates++;
          } else {
            if (current.events.length >= ICAL_LIMITS.eventsPerCalendar) fail('calendar_too_large', 'Un calendrier dépasse 5 000 cours.');
            current.seen.set(key, signature);
            current.events.push(course);
            if (!course.roomCode) current.stats.withoutRoom++;
            if (course.groupLabel) current.stats.groupCourses++;
          }
        }
        fields = null;
      } else if (p.value === 'VCALENDAR') {
        if (current.version !== '2.0' || !current.label) fail('missing_calendar_name', 'Chaque calendrier doit avoir une version 2.0 et un nom.');
        current.events.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.uidHash.localeCompare(b.uidHash));
        const { seen, version, ...calendar } = current;
        calendars.push(calendar);
        current = null;
      }
      continue;
    }
    if (stack.join('/') === 'VCALENDAR') {
      if (p.key === 'X-WR-CALNAME') {
        const label = text(p.value).replace(/^Calendrier\s+-\s+/i, '').replace(/\s+-\s+du\s+\d.*$/i, '').trim();
        if (!label || label.length > 180 || current.label) fail('invalid_calendar_name', 'Le nom d’un calendrier est invalide.');
        current.label = label;
      }
      if (p.key === 'VERSION') current.version = p.value;
    } else if (stack.join('/') === 'VCALENDAR/VEVENT') {
      if (['UID', 'SUMMARY', 'DTSTART', 'DTEND', 'LOCATION', 'CATEGORIES', 'STATUS', 'RRULE', 'RDATE', 'EXDATE', 'EXRULE', 'RECURRENCE-ID'].includes(p.key)) {
        if (fields.has(p.key)) fail('duplicate_property', 'Un cours possède une propriété en double.');
        fields.set(p.key, p);
      }
    }
  }
  if (stack.length || !calendars.length) fail('invalid_calendar', 'Le calendrier est incomplet ou vide.');
  if (new Set(calendars.map(c => c.label)).size !== calendars.length) fail('duplicate_calendar', 'Le même calendrier apparaît plusieurs fois dans ce dépôt.');
  return { checksum: hash(bytes), calendars, eventCount, courseCount: calendars.reduce((sum, c) => sum + c.events.length, 0) };
}
