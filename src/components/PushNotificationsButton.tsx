import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { parsePushConfig, parsePushState, pushInstallHint, type PushConfig } from '../../shared/push-client-policy';

function registration():Promise<ServiceWorkerRegistration> {
  return Promise.race([navigator.serviceWorker.ready,new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('Ouvrez de nouveau l’application puis réessayez.')),8000))]);
}
export function PushNotificationsButton({audience='requester'}:{audience?:'requester'|'agent'|'identity'}) {
  const route=`support/push?audience=${audience}`;
  const [config,setConfig]=useState<PushConfig|null>(null);
  const [enabled,setEnabled]=useState(false),[flash,setFlash]=useState(false),[savedFlash,setSavedFlash]=useState(false);
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[capability,setCapability]=useState<'ready'|'install'|'unsupported'>('unsupported');
  const mounted=useRef(true);
  const [loaded,setLoaded]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{
    mounted.current=true;let active=true;
    const standalone=matchMedia('(display-mode: standalone)').matches||(navigator as Navigator & {standalone?:boolean}).standalone===true;
    const needsInstall=pushInstallHint(navigator.userAgent,navigator.platform,navigator.maxTouchPoints,standalone);
    const supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
    setCapability(needsInstall?'install':supported?'ready':'unsupported');
    setEnabled(false);setConfig(null);setNotice('');setLoaded(false);setFlash(audience==='identity');
    if(supported&&!needsInstall)void (async()=>{
      try {
        const next=parsePushConfig(await apiFetch<unknown>(route));
        if(!next)throw new Error();
        if(!active)return;
        setConfig(next);
        if(!next.available)return;
        const sub=await (await registration()).pushManager.getSubscription();
        if(!active||!sub||Notification.permission!=='granted')return;
        const state=parsePushState(await apiFetch<unknown>(`${route}&action=status`,{method:'POST',body:JSON.stringify(sub.toJSON())}));
        if(!active||!state)return;
        setEnabled(state.enabled);setFlash(state.flashEnabled);setSavedFlash(state.flashEnabled);
        if(state.enabled)await apiFetch(route,{method:'POST',body:JSON.stringify({subscription:sub.toJSON(),flashEnabled:state.flashEnabled})});
      }catch{if(active)setNotice('Impossible de vérifier les notifications pour le moment.');}finally{if(active)setLoaded(true);}
    })();
    return()=>{active=false;mounted.current=false;};
  },[route,retry,audience]);
  async function enable() {
    if(busy||!config?.available)return;
    setBusy(true);setNotice('');
    // Keep the permission request in the user gesture, before asynchronous work.
    try {
      const permission=Notification.permission==='default'?Notification.requestPermission():Promise.resolve(Notification.permission);
      const choice=await permission;
      if(choice!=='granted'){setNotice(choice==='denied'?'Notifications bloquées : autorisez-les dans les réglages du navigateur ou du téléphone.':'Vous pourrez activer les notifications plus tard.');return;}
      const reg=await registration();
      let sub=await reg.pushManager.getSubscription();
      if(sub){
        const state=parsePushState(await apiFetch<unknown>(`${route}&action=status`,{method:'POST',body:JSON.stringify(sub.toJSON())}));
        if(!state)throw new Error('L’accès aux notifications n’a pas pu être vérifié.');
        if(!state.enabled){if(!await sub.unsubscribe())throw new Error('Fermez puis rouvrez l’application pour renouveler cet abonnement.');sub=null;}
      }
      const key=Uint8Array.from(atob(config.publicKey!.replace(/-/g,'+').replace(/_/g,'/')+'='),c=>c.charCodeAt(0));
      sub??=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
      if(!mounted.current)return;
      const state=parsePushState(await apiFetch<unknown>(route,{method:'POST',body:JSON.stringify({subscription:sub.toJSON(),flashEnabled:flash})}));
      if(!state?.enabled)throw new Error('L’enregistrement des notifications n’a pas été confirmé.');
      if(mounted.current){setEnabled(true);setSavedFlash(state.flashEnabled);setNotice('Préférences enregistrées sur cet appareil.');}
    }catch(error){if(mounted.current)setNotice(error instanceof Error?error.message:'Les notifications ne peuvent pas être activées pour le moment.');}
    finally{if(mounted.current)setBusy(false);}
  }
  async function disable(){
    setBusy(true);setNotice('');
    try{
      const sub=await (await registration()).pushManager.getSubscription();
      if(sub){const state=parsePushState(await apiFetch<unknown>(route,{method:'DELETE',body:JSON.stringify(sub.toJSON())}));if(!state||state.enabled)throw new Error('La désactivation n’a pas été confirmée.');await sub.unsubscribe();}
      setEnabled(false);setSavedFlash(false);setFlash(false);setNotice('Notifications désactivées sur cet appareil.');
    }catch(error){setNotice(error instanceof Error?error.message:'Réessayez la désactivation.');}finally{setBusy(false);}
  }
  return <section className="lycee-push-control" aria-label="Notifications sur cet appareil">
    <div><strong><Bell aria-hidden="true"/>Notifications sur cet appareil</strong><p>{audience==='agent'?'Les demandes de votre service et les infos du lycée.':audience==='identity'?'Les informations qui vous concernent, même lorsque l’application est fermée.':'Une alerte lorsqu’une réponse est disponible.'}</p></div>
    {capability==='install'?<p>Sur iPhone ou iPad, utilisez <b>Partager → Sur l’écran d’accueil</b>, puis ouvrez l’application depuis son icône pour activer les notifications.</p>:capability==='unsupported'?<p>Ce navigateur ne prend pas en charge les notifications. Vos informations restent dans votre espace.</p>:config?.available?<>
      {config.flashAvailable&&<label><input type="checkbox" checked={flash} disabled={busy} onChange={e=>setFlash(e.target.checked)}/>Recevoir aussi les informations flash importantes du lycée</label>}
      <div className="lycee-push-actions"><button type="button" disabled={busy||(enabled&&flash===savedFlash)} onClick={()=>void enable()}><Bell aria-hidden="true"/>{busy?'Un instant…':enabled?(flash!==savedFlash?'Enregistrer mon choix':'Notifications activées'):'Activer les notifications'}</button>{enabled&&<button type="button" disabled={busy} onClick={()=>void disable()}><BellOff aria-hidden="true"/>Désactiver</button>}</div>
    </>:<p>{config?'L’activation sera disponible prochainement.':loaded?'La disponibilité ne peut pas être confirmée.':'Vérification de la disponibilité…'}</p>}
    {loaded&&!config&&capability==='ready'&&<button type="button" onClick={()=>setRetry(n=>n+1)}>Réessayer</button>}
    {notice&&<small role="status">{notice}</small>}
  </section>;
}
