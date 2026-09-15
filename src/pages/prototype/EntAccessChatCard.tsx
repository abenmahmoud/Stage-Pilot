import { useEffect,useRef,useState } from 'react';
import { ENT_LOGIN_URL, ENT_RESET_STEPS, validEntAccessPayload,type EntAccessPayload } from '../../../shared/ent-self-service';
import { listenForIdentitySessionChanges } from '../../lib/identity-session-events';
import './ent-access-chat.css';

export default function EntAccessChatCard({onHelp,recoveryFailed=false}:{onHelp:()=>void;recoveryFailed?:boolean}) {
  const [data,setData]=useState<EntAccessPayload|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [copyMessage,setCopyMessage]=useState('');
  const [codeNeedsReview,setCodeNeedsReview]=useState(false);
  const request=useRef<AbortController|null>(null);
  const load=async(reveal=false)=>{
    request.current?.abort();const controller=new AbortController();request.current=controller;
    setBusy(true);setError('');setCopyMessage('');
    // Preserve the exact login if only the optional code display fails.
    if (!reveal) {setData(null);setCodeNeedsReview(false);}
    try {
      const res=await fetch('/api/identity/device/ent',{method:reveal?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,
        ...(reveal?{headers:{'Content-Type':'application/json'},body:'{}'}:{})});
      const value:unknown=await res.json();
      if (!res.ok) {
        if (res.status===401 && !controller.signal.aborted) setData(null);
        if (reveal && [409,429].includes(res.status) && !controller.signal.aborted) setCodeNeedsReview(true);
        throw new Error(typeof (value as {error?:unknown})?.error==='string'?(value as {error:string}).error:'Le service ENT est momentanément indisponible.');
      }
      if (!validEntAccessPayload(value)) {
        if (!controller.signal.aborted) setData(null);
        throw new Error('Les informations ENT doivent être vérifiées.');
      }
      if (!controller.signal.aborted) setData(value);
    } catch(e) { if (!controller.signal.aborted) setError(e instanceof Error?e.message:'Le service est indisponible.'); }
    finally {if(!controller.signal.aborted)setBusy(false);}
  };
  useEffect(()=>{
    void load();
    const clear=()=>{request.current?.abort();setData(null);setCopyMessage('');setBusy(false);setError('Informations masquées. Vous pouvez consulter à nouveau votre accès.');};
    const hidden=()=>{if(document.hidden)clear();};
    const stop=listenForIdentitySessionChanges(clear);
    window.addEventListener('pagehide',clear);document.addEventListener('visibilitychange',hidden);
    return ()=>{request.current?.abort();stop();window.removeEventListener('pagehide',clear);document.removeEventListener('visibilitychange',hidden);};
  },[]);
  useEffect(()=>{
    if(data?.status!=='ready')return;
    const timeout=setTimeout(()=>{setData(null);setCopyMessage('');setError('L’affichage a expiré. Consultez à nouveau votre accès si nécessaire.');},Math.max(0,Date.parse(data.expiresAt)-Date.now()));
    return ()=>clearTimeout(timeout);
  },[data]);
  const copyIdentifier=async()=>{
    if(data?.status!=='ready'||Date.parse(data.expiresAt)<=Date.now())return;
    try {await navigator.clipboard.writeText(data.account.identifier);setCopyMessage('Identifiant copié.');}
    catch {setCopyMessage('Sélectionnez votre identifiant pour le copier.');}
  };
  const resetSteps=<ol className="lycee-ent-access-steps">{ENT_RESET_STEPS.map(step=><li key={step}>{step}</li>)}</ol>;
  return <section className="lycee-ent-access" aria-label="Mon accès ENT" aria-busy={busy}>
    <div className="lycee-ent-access-heading"><span aria-hidden="true">↗</span><div><strong>Mon accès ENT</strong><small>{data?.status==='ready'&&data.profile==='guardian'?'Votre compte personnel de parent':'Votre compte personnel monlycée.net'}</small></div></div>
    {busy?<p role="status">Je consulte votre compte dans l’annuaire du lycée…</p>:null}
    {error?<p role="status">{error}</p>:null}
    {data?.status==='unavailable'?<p>Je ne retrouve pas votre identifiant ENT dans les données disponibles. Vous pouvez continuer sur monlycée.net si vous le connaissez déjà, ou demander au référent numérique de vérifier votre compte. Vos informations confirmées restent conservées pour cette demande.</p>:null}
    {data?.status==='ready'?<>
      <dl><dt>Votre identifiant exact</dt><dd>{data.account.identifier}</dd>{data.code?<><dt>Votre code d’activation</dt><dd>{data.code}</dd></>:null}</dl>
      {data.profile==='guardian'?<p>Il s’agit de votre compte de parent. Le choix d’un enfant ne change pas cet identifiant.</p>:null}
      {recoveryFailed||codeNeedsReview?<p>{recoveryFailed?'La récupération a déjà échoué.':'Le code nécessite une vérification.'} Gardez cet identifiant exact pour la vérification par le référent numérique ; vous n’avez pas à répéter la même tentative.</p>
        :data.account.activationState==='active'?<><p>Votre compte est déjà activé. Connectez-vous avec cet identifiant et votre mot de passe personnel. Si vous avez oublié le mot de passe :</p>{resetSteps}</>
        :<><p>Votre compte est indiqué comme non activé dans le dernier export du lycée.</p><ol className="lycee-ent-access-steps"><li>{data.code?'Copiez votre identifiant et votre code d’activation ci-dessus.':'Affichez votre code d’activation personnel avec le bouton ci-dessous.'}</li><li>Ouvrez monlycée.net et saisissez votre identifiant dans « Identifiant », puis le code d’activation dans « Mot de passe ».</li><li>Choisissez « Se connecter », puis suivez les étapes pour définir votre mot de passe personnel.</li></ol></>}
      {data.code?<small>Affichage limité à 30 minutes, masqué lorsque vous quittez cette page. Ne partagez pas votre code.</small>:null}
      <div className="lycee-ent-access-actions">{data.account.activationState==='inactive'&&!data.code&&!recoveryFailed&&!codeNeedsReview?<button type="button" disabled={busy} onClick={()=>void load(true)}>Afficher mon code d’activation</button>:null}<button type="button" disabled={busy} onClick={()=>void copyIdentifier()}>Copier mon identifiant</button></div>
      {copyMessage?<small role="status">{copyMessage}</small>:null}
      {data.account.activationState==='inactive'&&!recoveryFailed&&!codeNeedsReview?<details><summary>J’ai déjà activé mon compte</summary><p>Utilisez votre mot de passe personnel. En cas d’oubli :</p>{resetSteps}</details>:null}
    </>:null}
    {data?.status!=='ready'&&!busy?<details><summary>Comment me connecter ou réinitialiser mon mot de passe ?</summary><p>Si vous connaissez votre identifiant, connectez-vous avec votre mot de passe personnel. En cas d’oubli :</p>{resetSteps}<p>Si vous avez aussi oublié l’identifiant et qu’il n’est pas disponible ici, demandez la vérification de votre compte au référent numérique.</p></details>:null}
    <div className="lycee-ent-access-actions"><a href={ENT_LOGIN_URL} target="_blank" rel="noreferrer">Se connecter à monlycée.net ↗</a></div>
    {!busy&&!data?<button type="button" onClick={()=>void load()}>Consulter mon accès</button>:null}
    <button type="button" className="lycee-ent-access-help" onClick={onHelp}>Cela ne fonctionne pas / corriger mes coordonnées</button>
  </section>;
}
