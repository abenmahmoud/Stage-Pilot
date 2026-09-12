import { useEffect,useState } from 'react';
import { Zap } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { PublicContentMarkdown } from './PublicContentMarkdown';
import { parsePersonalFlash,type PersonalFlash } from '../../shared/personal-flash';

export function PersonalFlashFeed() {
  const [feed,setFeed]=useState<PersonalFlash|null>(null),[error,setError]=useState(false);
  useEffect(()=>{
    let active=true,revision=0,timer:ReturnType<typeof setTimeout>;
    async function refresh(){const current=++revision;clearTimeout(timer);setFeed(null);if(document.hidden||!navigator.onLine)return;
      try{const next=parsePersonalFlash(await apiFetch<unknown>('identity/device/flash'));if(!next||Date.parse(next.validUntil)<=Date.now())throw new Error();
        if(active&&current===revision&&!document.hidden){setFeed(next);setError(false);timer=setTimeout(()=>void refresh(),Math.max(1000,Date.parse(next.validUntil)-Date.now()));}
      }catch{if(active&&current===revision){setError(true);timer=setTimeout(()=>void refresh(),60000);}}
    }
    void refresh();document.addEventListener('visibilitychange',refresh);window.addEventListener('offline',refresh);window.addEventListener('online',refresh);
    return()=>{active=false;revision++;clearTimeout(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('offline',refresh);window.removeEventListener('online',refresh);};
  },[]);
  if(error)return <p className="school-personal-note">Les informations flash ne peuvent pas être chargées pour le moment.</p>;
  if(!feed?.items.length)return null;
  return <section className="school-personal-flash" aria-label="Informations flash pour vous"><h3><Zap aria-hidden="true"/>Les infos qui vous concernent</h3>{feed.items.map(item=><details key={item.id}><summary><span>{item.importance==='urgente'?'Urgent':item.importance==='importante'?'Important':'Info'}</span>{item.title}</summary><PublicContentMarkdown>{item.bodyMarkdown}</PublicContentMarkdown><small>Jusqu’au {new Date(item.expiresAt).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})}</small></details>)}</section>;
}
