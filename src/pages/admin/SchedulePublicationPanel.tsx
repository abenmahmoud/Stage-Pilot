import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { parseSchedulePublicationPlan, parseSchedulePublicationReceipt, type SchedulePublicationPlan } from '../../../shared/schedule-publication';
import type { IcalReview } from '../../../shared/schedule-ical-contract';

export default function SchedulePublicationPanel({ review, onPublished }: { review: IcalReview; onPublished: () => void }) {
  const [plan, setPlan] = useState<SchedulePublicationPlan | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [justification, setJustification] = useState('Correspondances et aperçu des cours vérifiés. Les autres calendriers restent en attente.');
  const [revision, setRevision] = useState(0);
  const alive = useRef(true);
  const callback = useRef(onPublished); callback.current = onPublished;
  const version = review.calendars.map(c => `${c.id}:${c.status}:${c.decision}:${c.subjectRef}`).join('|');
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setPlan(null); setError(''); setConfirming(false); setConfirmation('');
    if (review.sourceStatus !== 'review') return;
    void apiFetch<unknown>(`schedule/admin/imports/${review.sourceId}/publish`, { signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return;
      const next = parseSchedulePublicationPlan(data, review.sourceId);
      if (!next) throw new Error('Le bilan de mise en service est incomplet. Actualisez.');
      setPlan(next);
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Bilan indisponible.'); });
    return () => controller.abort();
  }, [review.sourceId, review.sourceStatus, version, revision]);

  async function publish() {
    if (!plan || busy || confirmation !== 'ACTIVER' || justification.trim().length < 20) return;
    setBusy(true); setError('');
    try {
      const data = await apiFetch<unknown>(`schedule/admin/imports/${review.sourceId}/publish`, {
        method: 'POST', body: JSON.stringify({ token: plan.token, confirmation, justification }),
      });
      if (!alive.current) return;
      const receipt = parseSchedulePublicationReceipt(data, plan);
      if (!receipt) throw new Error('L’activation n’a pas pu être confirmée. Actualisez le bilan avant de réessayer.');
      setPlan({ ...plan, alreadyPublished: true, activeSourceId: receipt.activeSourceId });
      setConfirming(false); setConfirmation(''); callback.current();
    } catch (reason) {
      if (alive.current) { setError(reason instanceof Error ? reason.message : 'Activation non confirmée.'); setPlan(null); setConfirming(false); }
    } finally { if (alive.current) setBusy(false); }
  }
  if (review.sourceStatus !== 'review') return null;
  return <section id="edt-publication" aria-label="Mise en service des calendriers" className="scroll-mt-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-bold text-slate-950">Mettre les calendriers validés en service</h3>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">Les autres restent en attente dans cet import. Vous pourrez les rattacher et les ajouter plus tard.</p></div>
      <button type="button" className="rounded-md border bg-white px-3 py-2 text-sm disabled:opacity-50" disabled={busy} onClick={() => setRevision(n => n + 1)}>Actualiser le bilan</button>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    {!plan && !error && <p role="status" className="mt-3 text-sm">Vérification des calendriers disponibles…</p>}
    {plan && <>
      <p role="status" className="mt-3 font-semibold text-emerald-950">{plan.readyCount} calendrier{plan.readyCount > 1 ? 's' : ''} {plan.alreadyPublished ? 'en service' : 'prêt' + (plan.readyCount > 1 ? 's' : '')} · {plan.waitingCount} en attente{plan.excludedCount > 0 ? ` · ${plan.excludedCount} exclu(s) par décision` : ''}</p>
      {plan.alreadyPublished ? <p className="mt-2 text-sm text-slate-700">Ces calendriers sont disponibles pour les personnes dont l’identité et les droits sont confirmés. <a className="font-semibold underline" href="/">Voir mon espace personnel</a></p> : <>
        {plan.activeSourceId && <p className="mt-2 text-sm text-slate-600">Cette mise à jour remplacera la version en service. Les calendriers déjà disponibles seront conservés.</p>}
        {!confirming && <button type="button" className="mt-4 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || plan.readyCount === 0} onClick={() => setConfirming(true)}>Activer les {plan.readyCount} calendriers validés</button>}
        {confirming && <div className="mt-4 max-w-2xl space-y-3 border-t border-emerald-200 pt-4">
          <label className="block text-sm font-medium">Vérification effectuée<textarea className="field mt-1 w-full bg-white" rows={2} minLength={20} maxLength={1000} disabled={busy} value={justification} onChange={e => setJustification(e.target.value)} /></label>
          <label className="block text-sm font-medium">Saisissez ACTIVER pour mettre ces {plan.readyCount} calendriers en service<input className="field mt-1 w-full max-w-xs bg-white" autoComplete="off" disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value.toUpperCase())} /></label>
          <p className="text-sm text-slate-600">Les {plan.waitingCount} calendriers en attente ne seront ni publiés ni exclus.</p>
          <div className="flex flex-wrap gap-2"><button type="button" className="rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || confirmation !== 'ACTIVER' || justification.trim().length < 20} onClick={() => void publish()}>{busy ? 'Mise en service…' : 'Confirmer l’activation'}</button>
            <button type="button" className="rounded-lg px-4 py-3 text-sm underline" disabled={busy} onClick={() => { setConfirming(false); setConfirmation(''); }}>Annuler</button></div>
        </div>}
      </>}
    </>}
  </section>;
}
