import { CalendarDays, MapPin, Printer } from 'lucide-react';
import type { SchedulePresentation } from '../../../shared/schedule-presentation';

const time = (value: string) => new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(value));
const date = (value: string) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date(value));
const groupNotice = 'Les cours de groupe ne sont affichés que si votre appartenance est confirmée. Cette liste peut être incomplète.';

function printSchedule(value: SchedulePresentation) {
  const popup = window.open('', '_blank');
  if (!popup) return;
  popup.opener = null;
  const doc = popup.document;
  doc.title = 'Emploi du temps — Lycée Blaise Cendrars';
  doc.documentElement.lang = 'fr';
  const style = doc.createElement('style');
  style.textContent = 'body{font:15px system-ui;color:#17344c;max-width:900px;margin:40px auto;padding:0 24px}h1{font-size:26px}table{border-collapse:collapse;width:100%;margin:24px 0}td,th{text-align:left;padding:14px 10px;border-bottom:1px solid #ddd}small{color:#526274}button{padding:12px 20px;border:0;border-radius:8px;background:#17344c;color:white;cursor:pointer}@media print{button{display:none}body{margin:0;padding:12px}tr{break-inside:avoid}}';
  doc.head.append(style);
  const append = (tag: string, content: string, parent: HTMLElement = doc.body) => { const el = doc.createElement(tag); el.textContent = content; parent.append(el); return el; };
  append('small', 'LYCÉE BLAISE CENDRARS · SEVRAN');
  append('h1', value.title);
  append('p', `Source validée le ${date(value.updatedAt)}. Les changements ultérieurs doivent être consultés sur le site du lycée.`);
  if (value.incompleteGroups) append('p', groupNotice);
  const table = append('table', '');
  const header = append('tr', '', table);
  for (const label of ['Date et horaire', 'Cours', 'Salle']) append('th', label, header);
  for (const course of value.courses) {
    const row = append('tr', '', table);
    append('td', `${date(course.startsAt)} · ${time(course.startsAt)} – ${time(course.endsAt)}`, row);
    append('td', `${course.subjectLabel}${course.state === 'cancelled' ? ' — Annulé' : course.state === 'moved' ? ' — Modifié' : ''}`, row);
    append('td', course.state === 'cancelled' ? '—' : course.roomCode ?? 'À confirmer', row);
  }
  if (!value.courses.length) append('p', value.incompleteGroups ? 'Aucun cours confirmé dans votre périmètre.' : 'Aucun cours prévu pour cette journée.');
  const button = append('button', 'Imprimer ou enregistrer en PDF');
  button.onclick = () => popup.print();
  popup.focus();
}

export default function ScheduleChatCard({ value }: { value: SchedulePresentation }) {
  return <section className="lycee-schedule-card" aria-label={value.title}>
    <header><CalendarDays aria-hidden="true" /><div><strong>{value.title}</strong><small>{value.courses.length} cours affiché{value.courses.length > 1 ? 's' : ''}</small></div></header>
    {value.incompleteGroups && <p className="lycee-schedule-notice">{groupNotice}</p>}
    <ol>{value.courses.map((course, index) => <li key={`${course.startsAt}-${course.subjectCode}-${index}`} data-state={course.state}>
      <div className="lycee-schedule-time"><strong>{time(course.startsAt)}</strong><span>{time(course.endsAt)}</span></div>
      <div className="lycee-schedule-course"><small>{date(course.startsAt)}</small><strong>{course.subjectLabel}</strong>
        {course.state === 'cancelled' ? <em>Cours annulé</em> : <span><MapPin aria-hidden="true" />{course.roomCode ? `Salle ${course.roomCode}` : 'Salle à confirmer'}{course.state === 'moved' ? ' · Modifié' : ''}</span>}</div>
    </li>)}</ol>
    {!value.courses.length && <p>{value.incompleteGroups ? 'Aucun cours confirmé dans votre périmètre.' : 'Aucun cours prévu pour cette journée.'}</p>}
    <footer><small>Source validée le {date(value.updatedAt)}</small><button type="button" onClick={() => printSchedule(value)}><Printer aria-hidden="true" />Imprimer / PDF</button></footer>
  </section>;
}
