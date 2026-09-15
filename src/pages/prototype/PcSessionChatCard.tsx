import { useEffect, useRef, useState } from 'react';
import { validPcSessionAccessPayload, type PcSessionAccessPayload } from '../../../shared/pc-session-self-service';
import { listenForIdentitySessionChanges } from '../../lib/identity-session-events';
import './ent-access-chat.css';

export default function PcSessionChatCard({ onHelp }: { onHelp: () => void }) {
  const [data, setData] = useState<PcSessionAccessPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef<AbortController | null>(null);
  const load = async (reveal = false) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setData(null); setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/identity/device/pc-session', {
        method: reveal ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        ...(reveal ? { headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}),
      });
      const value: unknown = await response.json();
      if (!response.ok) {
        if (response.status === 401 && !controller.signal.aborted) setData({ status: 'verification_required' });
        throw new Error(typeof (value as { error?: unknown })?.error === 'string' ? (value as { error: string }).error : 'Votre accès PC est momentanément indisponible.');
      }
      if (!validPcSessionAccessPayload(value)) throw new Error('Les informations PC doivent être vérifiées.');
      if (!controller.signal.aborted) setData(value);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Le service est indisponible.');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  };
  useEffect(() => {
    void load();
    const clear = () => { request.current?.abort(); setData(null); setBusy(false); setNotice(''); setError('Informations masquées. Vous pouvez consulter à nouveau votre accès.'); };
    const hidden = () => { if (document.hidden) clear(); };
    const stop = listenForIdentitySessionChanges(clear);
    window.addEventListener('pagehide', clear);
    document.addEventListener('visibilitychange', hidden);
    return () => { request.current?.abort(); stop(); window.removeEventListener('pagehide', clear); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  useEffect(() => {
    if (data?.status !== 'ready') return;
    const timeout = setTimeout(() => { setData({ status: 'verification_required' }); setNotice(''); }, Math.max(0, Date.parse(data.expiresAt) - Date.now()));
    return () => clearTimeout(timeout);
  }, [data]);
  const copyIdentifier = async () => {
    if (data?.status !== 'ready' || Date.parse(data.expiresAt) <= Date.now()) return;
    try { await navigator.clipboard.writeText(data.identifier); setNotice('Identifiant copié.'); }
    catch { setNotice('Sélectionnez votre identifiant pour le copier.'); }
  };
  return <section className="lycee-ent-access" aria-label="Ma session PC" aria-busy={busy}>
    <div className="lycee-ent-access-heading"><span aria-hidden="true">↗</span><div><strong>Ma session PC</strong><small>Votre compte personnel sur les ordinateurs du lycée</small></div></div>
    {busy ? <p role="status">Je consulte votre accès sécurisé…</p> : null}
    {error ? <p role="status">{error}</p> : null}
    {data?.status === 'unavailable' ? <p>Votre identifiant et votre code PC ne sont pas encore disponibles dans le coffre du lycée. Vous pouvez demander au référent numérique de les ajouter. Votre identité confirmée sera reprise dans la demande.</p> : null}
    {data?.status === 'available' ? <><p>Votre accès personnel est disponible.</p><div className="lycee-ent-access-actions"><button type="button" disabled={busy} onClick={() => void load(true)}>Afficher mon identifiant et mon code</button></div></> : null}
    {data?.status === 'verification_required' ? <p>Pour protéger votre accès PC, utilisez « Vérifier à nouveau mon identité » sous cet échange. Un seul code reçu par SMS ou par email suffit.</p> : null}
    {data?.status === 'ready' ? <>
      <dl><dt>Votre identifiant exact</dt><dd>{data.identifier}</dd><dt>Votre code de session</dt><dd>{data.code}</dd></dl>
      <p>Sur un ordinateur du lycée, saisissez cet identifiant et ce code pour ouvrir votre session personnelle.</p>
      <small>Affichage limité à la durée de votre vérification, au maximum 30 minutes. Les informations sont masquées lorsque vous quittez la page. Ne partagez pas votre code.</small>
      <div className="lycee-ent-access-actions"><button type="button" onClick={() => void copyIdentifier()}>Copier mon identifiant</button><button type="button" onClick={() => { setData(null); setNotice(''); }}>Masquer mes accès</button></div>
      {notice ? <p role="status">{notice}</p> : null}
    </> : null}
    {!data && !busy ? <div className="lycee-ent-access-actions"><button type="button" onClick={() => void load()}>Consulter mon accès PC</button></div> : null}
    <button className="lycee-ent-access-help" type="button" onClick={() => { request.current?.abort(); setData(null); setNotice(''); onHelp(); }}>{data?.status === 'ready' ? 'Ces accès ne fonctionnent pas' : 'Demander une vérification au référent numérique'}</button>
  </section>;
}
