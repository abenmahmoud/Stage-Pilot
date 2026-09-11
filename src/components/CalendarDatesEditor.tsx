import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import type { SchoolCalendarDate } from "../../shared/school-calendar";

export function CalendarDatesEditor({ value, onChange, articleTitle }: {
  value: SchoolCalendarDate[]; onChange: (events: SchoolCalendarDate[]) => void; articleTitle: string;
}) {
  const titleId = useId();
  function change(index: number, patch: Partial<SchoolCalendarDate>) {
    onChange(value.map((event, position) => position === index ? { ...event, ...patch } : event));
  }
  return <section className="border-t border-slate-200 pt-5" aria-labelledby={titleId}>
    <h2 id={titleId} className="flex items-center gap-2 font-bold text-slate-900"><CalendarDays className="h-5 w-5" /> Dans le calendrier</h2>
    <p className="mt-1 text-sm leading-6 text-slate-500">Ajoutez les rendez-vous annoncés dans cet article. Ils seront visibles après publication. Laissez les heures vides si elles ne sont pas encore connues.</p>
    <div className="mt-4 space-y-4">{value.map((event, index) => <fieldset key={event.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <legend className="px-1 text-sm font-semibold">Rendez-vous {index + 1}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">Titre du rendez-vous<input className="field mt-1 w-full bg-white" value={event.title} maxLength={180} onChange={e => change(index, { title: e.target.value })} /></label>
        <label className="text-sm font-medium">Date de début<input className="field mt-1 w-full bg-white" type="date" value={event.startDate} onChange={e => change(index, { startDate: e.target.value, ...(!event.endDate || event.endDate === event.startDate ? { endDate: e.target.value } : {}) })} /></label>
        <label className="text-sm font-medium">Dernier jour inclus<input className="field mt-1 w-full bg-white" type="date" value={event.endDate} min={event.startDate} onChange={e => change(index, { endDate: e.target.value })} /></label>
        <label className="text-sm font-medium">Heure de début · facultative<input className="field mt-1 w-full bg-white" type="time" value={event.startTime ?? ""} onChange={e => change(index, { startTime: e.target.value || null })} /></label>
        <label className="text-sm font-medium">Heure de fin · facultative<input className="field mt-1 w-full bg-white" type="time" value={event.endTime ?? ""} onChange={e => change(index, { endTime: e.target.value || null })} /></label>
        <label className="text-sm font-medium sm:col-span-2">Lieu · facultatif<input className="field mt-1 w-full bg-white" value={event.location} maxLength={180} placeholder="Ex. : salle polyvalente" onChange={e => change(index, { location: e.target.value })} /></label>
      </div>
      <button type="button" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-slate-600" onClick={() => onChange(value.filter((_, position) => position !== index))}><Trash2 className="h-4 w-4" /> Retirer cette date</button>
    </fieldset>)}</div>
    <button type="button" disabled={value.length >= 12} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-700 disabled:opacity-50" onClick={() => onChange([...value, { key: crypto.randomUUID(), title: articleTitle, startDate: "", endDate: "", startTime: null, endTime: null, location: "" }])}><Plus className="h-4 w-4" /> Ajouter une date</button>
  </section>;
}
