import { useEffect,useRef,useState } from 'react';
import { validEntAccessPayload,type EntAccessPayload } from '../../../shared/ent-self-service';
import { listenForIdentitySessionChanges } from '../../lib/identity-session-events';
import './ent-access-chat.css';

export default function EntAccessChatCard({onHelp}:{onHelp:()=>void}) {
  const [data,setData]=useState<EntAccessPayload|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const request=useRef<AbortController|null>(null);
  const load=async(reveal=false)=>{
    request.current?.abort();const controller=new AbortController();request.current=controller;
    setBusy(true);setError('');setData(null);
    try {
      const res=await fetch('/api/identity/device/ent',{method:reveal?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,
        ...(reveal?{headers:{'Content-Type':'application/json'},body:'{}'}:{})});
      const value:unknown=await res.json();
      if (!res.ok) throw new Error(typeof (value as {error?:unknown})?.error==='string'?(value as {error:string}).error:'Le service ENT est momentanément indisponible.');
      if (!validEntAccessPayload(value)) throw new Error('Les informations ENT doivent être vérifiées.');
      if (!controller.signal.aborted) setData(value);
    } catch(e) { if (!controller.signal.aborted) setError(e instanceof Error?e.message:'Le service est indisponible.'); }
    finally {if(!controller.signal.aborted)setBusy(false);}
  };
  useEffect(()=>{
    void load();
    const clear=()=>{request.current?.abort();setData(null);setBusy(false);setError('Informations masquées. Vous pouvez consulter à nouveau votre accès.');};
    const hidden=()=>{if(document.hidden)clear();};
    const stop=listenForIdentitySessionChanges(clear);
    window.addEventListener('pagehide',clear);document.addEventListener('visibilitychange',hidden);
    return ()=>{request.current?.abort();stop();window.removeEventListener('pagehide',clear);document.removeEventListener('visibilitychange',hidden);};
  },[]);
  useEffect(()=>{
    if(data?.status!=='ready')return;
    const timeout=setTimeout(()=>{setData(null);setError('L’affichage a expiré. Consultez à nouveau votre accès si nécessaire.');},Math.max(0,Date.parse(data.expiresAt)-Date.now()));
    return ()=>clearTimeout(timeout);
  },[data]);
  return <section className="lycee-ent-access" aria-label="Mon accès ENT" aria-busy={busy}>
    <div className="lycee-ent-access-heading"><span aria-hidden="true">↗</span><div><strong>Mon accès ENT</strong><small>{data?.status==='ready'&&data.profile==='guardian'?'Votre compte personnel de parent':'Votre compte personnel monlycée.net'}</small></div></div>
    {busy?<p role="status">Je consulte votre compte dans l’annuaire du lycée…</p>:null}
    {error?<p role="status">{error}</p>:null}
    {data?.status==='unavailable'?<p>Votre accès ENT n’est pas encore disponible ici. Le référent numérique peut le vérifier ; vos informations déjà confirmées sont conservées pour votre demande.</p>:null}
    {data?.status==='ready'?<>
      <dl><dt>Votre identifiant exact</dt><dd>{data.account.identifier}</dd>{data.code?<><dt>Votre code d’activation</dt><dd>{data.code}</dd></>:null}</dl>
      {data.account.activationState==='active'?<p>Votre compte est déjà activé. Sur monlycée.net, choisissez <strong>« Mot de passe oublié »</strong> et utilisez cet identifiant pour réinitialiser votre mot de passe.</p>
        :<p>{data.code?'Copiez votre identifiant et votre code, puis utilisez-les sur monlycée.net pour votre première connexion. Choisissez ensuite votre mot de passe personnel.':'Votre compte attend sa première activation. Vous pouvez afficher votre code personnel ici.'}</p>}
      {data.code?<small>Affichage limité à 30 minutes, masqué lorsque vous quittez cette page. Ne partagez pas votre code.</small>:null}
      <div className="lycee-ent-access-actions">
        {data.account.activationState==='inactive'&&!data.code?<button type="button" disabled={busy} onClick={()=>void load(true)}>Afficher mon code d’activation</button>:null}
        <a href="https://monlycee.net" target="_blank" rel="noreferrer">Ouvrir monlycée.net ↗</a>
      </div>
    </>:null}
    {!busy&&!data?<button type="button" onClick={()=>void load()}>Consulter mon accès</button>:null}
    <button type="button" className="lycee-ent-access-help" onClick={onHelp}>Cela ne fonctionne pas / corriger mes coordonnées</button>
  </section>;
}
