import { useEffect, useRef, useState } from 'react';
import { CalendarDays, LoaderCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { schoolDayBoundsUtc } from '../../../shared/assistant-school-context';
import { parseScheduleAdminPreview, type ScheduleAdminPreview, type SchedulePreviewCourse } from '../../../shared/schedule-admin-preview';
import type { IcalReview } from '../../../shared/schedule-ical-contract';

const time = (value: string) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const date = (value: string) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full' }).format(new Date(value + 'T12:00:00Z'));
function Courses({ courses }: { courses: SchedulePreviewCourse[] }) {
  return <ol className="space-y-2">{courses.map((course, i) => <li key={i} className="grid min-w-0 gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-center">
    <span className="text-sm font-semibold tabular-nums text-emerald-800">{time(course.startsAt)} – {time(course.endsAt)}</span>
    <span className="min-w-0 break-words font-semibold text-slate-900">{course.subject}</span>
    <span className="break-words text-sm text-slate-600">{course.room ? `Salle ${course.room}` : 'Salle non renseignée'}</span>
  </li>)}</ol>;
}

export default function ScheduleAdminPreviewPanel({ review }: { review: IcalReview }) {
  const calendars = review.calendars.filter(c => c.status === 'applied' && c.decision === 'include');
  const [calendarId, setCalendarId] = useState('');
  const [day, setDay] = useState(() => schoolDayBoundsUtc(new Date(), 1).dayDate);
  const [preview, setPreview] = useState<ScheduleAdminPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  function clear() {
    request.current?.abort();
    setPreview(null); setError(''); setBusy(false);
  }
  async function show() {
    clear();
    if (!calendarId || !day) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true);
    const expected = { sourceId: review.sourceId, calendarId, day };
    try {
      const payload = await apiFetch<unknown>(`schedule/admin/imports/${review.sourceId}/preview?${new URLSearchParams({ calendarId, day })}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const result = parseScheduleAdminPreview(payload, expected);
      if (!result) throw new Error('L’aperçu reçu ne correspond pas au calendrier et au jour demandés. Réessayez.');
      setPreview(result);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'L’aperçu est momentanément indisponible.');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const visible = preview && preview.sourceStatus === review.sourceStatus
    && calendars.some(c => c.id === preview.calendarId) ? preview : null;
  const wholeClass = visible?.courses.filter(c => !c.inGroup) ?? [];
  const groups = visible?.courses.filter(c => c.inGroup) ?? [];
  if (!calendars.length) return null;
  return <section id="edt-apercu" className="scroll-mt-6 space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4" aria-label="Tester une journée">
    <div className="flex items-start gap-3"><CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /><div>
      <h3 className="font-bold text-slate-950">Tester une journée</h3>
      <p className="mt-1 text-sm text-slate-600">Contrôlez les horaires, les matières et les salles avant activation. Cet aperçu reste réservé à la gestion.</p>
    </div></div>
    <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-end">
      <label className="min-w-0 text-sm font-medium text-slate-700">{review.sourceKind === 'classes' ? 'Classe à vérifier' : 'Professeur à vérifier'}
        <select className="field mt-1 min-w-0 bg-white" value={calendarId} onChange={e => { clear(); setCalendarId(e.target.value); }}>
          <option value="">Choisir un calendrier validé</option>
          {calendars.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
      <label className="min-w-0 text-sm font-medium text-slate-700">Jour à vérifier
        <input className="field mt-1 min-w-0 bg-white" type="date" value={day} onChange={e => { clear(); setDay(e.target.value); }} />
      </label>
      <button type="button" disabled={busy || !calendarId || !day} onClick={() => void show()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
        {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}Afficher les cours
      </button>
    </div>
    {busy && <p role="status" className="text-sm text-slate-600">Lecture de la journée…</p>}
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    {preview && !visible && <p role="status" className="text-sm text-amber-900">La version a changé. Actualisez les calendriers puis relancez l’aperçu.</p>}
    {visible && <section className="space-y-4" aria-label="Aperçu des cours">
      <div><h4 className="break-words font-bold text-slate-950">{visible.label} · {date(visible.day)}</h4>
        <p className="mt-1 text-xs text-slate-600">Horaires de Paris · {visible.sourceStatus === 'active' ? 'Version active' : visible.sourceStatus === 'superseded' ? 'Ancienne version remplacée' : 'Aperçu de l’import — consultez le bilan de mise en service ci-dessus'}</p>
      </div>
      {Date.parse(visible.freshUntil) < Date.now() && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Cette version doit être recontrôlée. Cet aperçu décrit le fichier importé et ne confirme pas les horaires actuels.</p>}
      {review.sourceKind === 'classes' && <p className="text-sm text-slate-600">Cours en classe entière : {wholeClass.length}. Les cours en groupe sont présentés séparément ; leur attribution à chaque élève reste à vérifier.</p>}
      {wholeClass.length ? <Courses courses={wholeClass} /> : <p className="rounded-lg bg-white p-3 text-sm text-slate-600">Aucun cours {review.sourceKind === 'classes' ? 'en classe entière ' : ''}enregistré pour cette journée. Consultez aussi les groupes et la source EDT.</p>}
      {!!groups.length && <details className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-amber-950">Voir les cours en groupe ({groups.length})</summary>
        <div className="mt-3 space-y-3"><p className="text-sm text-amber-900">Ces cours peuvent concerner des élèves différents et se dérouler en parallèle. Les liens élèves–groupes doivent être confirmés avant de construire un emploi du temps personnel complet.</p><Courses courses={groups} /></div>
      </details>}
      <p className="text-xs text-slate-500">Comparez cette journée avec EDT ou PRONOTE. Un créneau absent de cet aperçu ne prouve pas qu’une salle est libre.</p>
    </section>}
  </section>;
}
