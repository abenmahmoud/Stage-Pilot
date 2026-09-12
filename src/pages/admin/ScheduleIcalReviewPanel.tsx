import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { isIcalDecisionReceipt, parseIcalDecisions, parseIcalReview, type IcalDecision, type IcalReview } from '../../../shared/schedule-ical-contract';
import { filterIcalCalendars, isUndecided, prepareIcalDrafts, type IcalReviewFilter } from '../../../shared/schedule-ical-review';

export default function ScheduleIcalReviewPanel({ importId, onApplied }: { importId: string; onApplied: () => void }) {
  const [review, setReview] = useState<IcalReview | null>(null);
  const [drafts, setDrafts] = useState<Record<string, IcalDecision>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [filter, setFilter] = useState<IcalReviewFilter>('pending');
  const [query, setQuery] = useState('');
  const [reading, setReading] = useState(true);
  const callback = useRef(onApplied);
  callback.current = onApplied;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let previousApplied = '';
    setReview(null);
    setDrafts({});
    setReading(true);
    async function read() {
      try {
        const payload = await apiFetch<unknown>(`schedule/admin/imports/${importId}/ical`);
        if (cancelled) return;
        const next = parseIcalReview(payload, importId);
        if (!next) throw new Error('Les correspondances reçues sont invalides.');
        setReview(next);
        setReading(false);
        setError('');
        const applied = next.calendars.filter(c => c.status === 'applied').map(c => c.id).join(',');
        if (applied !== previousApplied) { previousApplied = applied; callback.current(); }
        if (next.calendars.some(c => c.status === 'queued')) timer = setTimeout(() => void read(), 3000);
      } catch (reason) {
        if (!cancelled) { setError(reason instanceof Error ? reason.message : 'Lecture indisponible.'); setReading(false); setReview(null); }
      }
    }
    void read();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [importId, reload]);

  const selected = Object.values(drafts);
  const canValidate = !reading && review?.sourceStatus === 'review' && selected.every(d => review.calendars.some(c => c.id === d.id && isUndecided(c))) && !!parseIcalDecisions({ decisions: selected });
  const visible = review ? filterIcalCalendars(review.calendars, filter, query) : [];
  const pendingCount = review?.calendars.filter(isUndecided).length ?? 0;
  const excludedCount = selected.filter(d => d.decision === 'exclude').length;
  async function submit() {
    if (busy || !canValidate) return;
    setBusy(true); setError('');
    try {
      const receipt = await apiFetch<unknown>(`schedule/admin/imports/${importId}/ical`, { method: 'POST', body: JSON.stringify({ decisions: selected }) });
      if (!isIcalDecisionReceipt(receipt, importId, selected)) throw new Error('La validation n’a pas été confirmée. Actualisez avant de réessayer.');
      setReload(value => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Validation impossible.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-bold text-slate-950">Vérifier les calendriers iCal</h3>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">Les correspondances proposées viennent de l’annuaire actif. Vérifiez chaque rattachement avant de le valider. Une exclusion doit également être confirmée.</p></div>
      <button type="button" className="rounded-md border px-3 py-2 text-sm" disabled={busy} onClick={() => setReload(n => n + 1)}>Actualiser</button>
    </div>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    {!review && !error && <p role="status">Lecture des calendriers…</p>}
    {review && <>
      <div role="status" className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        <strong>{pendingCount} calendrier{pendingCount > 1 ? 's' : ''} à vérifier</strong>
        <span className="mt-1 block">{review.calendars.filter(c => c.status === 'applied' && c.decision === 'include').length} rattachés · {review.calendars.filter(c => c.status === 'applied' && c.decision === 'exclude').length} exclus · {review.calendars.length} au total{review.calendars.some(c => c.status === 'queued') ? ' · Enregistrement en cours…' : ''}</span>
      </div>
      {review.sourceKind === 'classes' && review.calendars.some(c => c.groupCourses > 0) && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Des cours concernent des groupes. Ils ne seront présentés à un élève qu’après confirmation de son appartenance au groupe. L’emploi du temps individuel peut donc être incomplet.</p>}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="text-sm font-medium text-slate-700">Rechercher un calendrier
          <input type="search" className="field mt-1 w-full bg-white" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nom ou référence de l’annuaire" />
        </label>
        <label className="text-sm font-medium text-slate-700">Afficher
          <select className="field mt-1 w-full bg-white" value={filter} onChange={e => setFilter(e.target.value as IcalReviewFilter)}>
            <option value="pending">À vérifier</option><option value="unmatched">Sans correspondance certaine</option><option value="empty">Sans cours</option><option value="applied">Déjà traités</option><option value="all">Tous les calendriers</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || review.sourceStatus !== 'review'} className="rounded-md border px-3 py-2 text-sm font-semibold disabled:opacity-50" onClick={() => setDrafts(current => prepareIcalDrafts(review, current, 'exact'))}>Sélectionner les correspondances exactes</button>
        {review.calendars.some(c => c.status === 'pending' && c.matchStatus === 'empty' && c.courseCount === 0) && <button type="button" disabled={busy || review.sourceStatus !== 'review'} className="rounded-md border px-3 py-2 text-sm disabled:opacity-50" onClick={() => { setDrafts(current => prepareIcalDrafts(review, current, 'empty')); setFilter('empty'); setQuery(''); }}>Préparer l’exclusion des calendriers vides</button>}
      </div>
      <p className="text-xs text-slate-500">Ces boutons préparent des choix pour toute la version, même avec un filtre. Rien n’est enregistré avant votre validation.</p>
      <div className="max-h-[32rem] divide-y overflow-y-auto">
        {visible.length === 0 && <p className="py-6 text-sm text-slate-600">{pendingCount === 0 && filter === 'pending' && !query ? 'Il ne reste aucun calendrier à décider. Consultez « Tous les calendriers » pour voir le bilan et les enregistrements en cours.' : 'Aucun calendrier ne correspond à ces filtres.'}</p>}
        {visible.map(c => {
          const draft = drafts[c.id];
          const locked = busy || c.status === 'queued' || c.status === 'applied' || review.sourceStatus !== 'review';
          return <div key={c.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_12rem_12rem] sm:items-center">
            <div className="min-w-0"><strong className="break-words text-sm">{c.label}</strong>
              <p className="text-xs text-slate-500">{c.courseCount.toLocaleString('fr-FR')} cours · {c.firstDate ?? 'Aucun cours daté'}{c.lastDate ? ` → ${c.lastDate}` : ''}</p>
              {c.withoutRoom > 0 && <p className="text-xs text-amber-800">{c.withoutRoom.toLocaleString('fr-FR')} cours sans salle renseignée</p>}
              <p className="text-xs text-slate-600">{c.status === 'applied' ? c.decision === 'exclude' ? 'Exclusion confirmée' : 'Enregistré' : c.status === 'queued' ? 'Enregistrement en cours' : c.status === 'failed' ? 'Échec de l’enregistrement — vérifiez puis réessayez' : ({ exact: 'Correspondance exacte proposée', not_found: 'À rattacher ou à exclure', ambiguous: 'Plusieurs personnes possibles', empty: 'Calendrier sans cours' }[c.matchStatus])}</p>
            </div>
            <select aria-label={`Décision pour ${c.label}`} className="field bg-white text-sm" disabled={locked} value={draft?.decision ?? c.decision ?? ''} onChange={e => setDrafts(current => {
              const next = { ...current }; const decision = e.target.value;
              if (!decision) delete next[c.id]; else next[c.id] = { id: c.id, decision: decision as 'include' | 'exclude', subjectRef: decision === 'include' ? c.subjectRef ?? c.suggestedRef ?? '' : null };
              return next;
            })}>
              <option value="">À décider</option><option value="include" disabled={!c.courseCount}>Rattacher</option><option value="exclude">Exclure de cette version</option>
            </select>
            {(draft?.decision ?? c.decision) === 'include' ? <input aria-label={`Référence pour ${c.label}`} className="field bg-white font-mono text-sm" maxLength={80} disabled={locked} value={draft?.subjectRef ?? c.subjectRef ?? c.suggestedRef ?? ''} onChange={e => setDrafts(current => ({ ...current, [c.id]: { id: c.id, decision: 'include', subjectRef: e.target.value.trim().toUpperCase() } }))} /> : <span className="text-xs text-slate-500">{c.suggestedRef ? `Référence proposée : ${c.suggestedRef}` : 'Aucune référence choisie'}</span>}
          </div>;
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <button type="button" disabled={busy || !canValidate} onClick={() => void submit()} className="rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Validation…' : `Valider les ${selected.length} décisions sélectionnées`}</button>
        {selected.length > 0 && <button type="button" disabled={busy} className="rounded-md px-3 py-2 text-sm underline" onClick={() => setDrafts({})}>Annuler la sélection</button>}
        <p className="w-full text-xs text-slate-600">{selected.length > 0 ? `${selected.length - excludedCount} rattachement(s) et ${excludedCount} exclusion(s) à confirmer, y compris ceux masqués par le filtre. ` : ''}La version doit ensuite être approuvée et activée.</p>
      </div>
    </>}
  </div>;
}
