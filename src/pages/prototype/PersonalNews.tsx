import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Download, Newspaper } from 'lucide-react';
import { type PersonalNewsFeed, type PersonalNewsArticle, isPersonalNewsArticle } from '../../../shared/personal-news';
import { calendarDateLabel, parisToday } from '../../../shared/school-calendar';
import { readJsonApiResponse } from '../../../shared/json-api-response';
import { PublicContentMarkdown } from '../../components/PublicContentMarkdown';
import { NewsPhoto } from '../../components/NewsPhoto';

export default function PersonalNews({feed}:{feed:PersonalNewsFeed}) {
  const [selected,setSelected] = useState<string|null>(null), [article,setArticle] = useState<PersonalNewsArticle|null>(null);
  const [error,setError] = useState(false), [attempt,setAttempt] = useState(0), [showAll,setShowAll] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const selectedVersion = feed.items.find(i=>i.id===selected)?.version;
  useEffect(()=>{
    setArticle(null);setError(false);if(!selected)return;
    const controller=new AbortController();
    const timeout=window.setTimeout(()=>controller.abort('timeout'),15000);
    fetch(`/api/identity/device/news?article=${encodeURIComponent(selected)}`,{credentials:'include',cache:'no-store',signal:controller.signal})
      .then(r=>readJsonApiResponse<unknown>(r,{maxBytes:128*1024})).then(result=>{
        if(!isPersonalNewsArticle(result)||result.item.id!==selected||Date.parse(result.validUntil)<=Date.now())throw new Error('invalid');
        if(!controller.signal.aborted&&!document.hidden)setArticle(result);
      }).catch(()=>{if(!controller.signal.aborted||controller.signal.reason==='timeout')setError(true);}).finally(()=>window.clearTimeout(timeout));
    return()=>{controller.abort();window.clearTimeout(timeout);};
  },[selected,selectedVersion,attempt]);
  useEffect(()=>{if(!article)return;const timer=window.setTimeout(()=>{setArticle(null);setAttempt(v=>v+1);},Math.max(0,Date.parse(article.validUntil)-Date.now()));return()=>window.clearTimeout(timer);},[article]);
  useEffect(()=>{if(selected)heading.current?.focus();},[selected]);
  const today=parisToday();
  if(selected)return <section className="school-personal-news school-personal-news-detail" aria-labelledby="personal-news-detail-title">
    <button type="button" className="school-personal-news-back" onClick={()=>{setSelected(null);setArticle(null);}}><ArrowLeft aria-hidden="true" />Revenir aux informations</button>
    <h3 id="personal-news-detail-title" ref={heading} tabIndex={-1}>{article?.item.title??'Votre information'}</h3>
    {error?<p role="status">Cette information ne peut plus être ouverte. Revenez aux informations pour actualiser votre sélection.</p>:!article?<p aria-live="polite">Ouverture de l’information…</p>:<>
      <p className="school-personal-news-summary">{article.item.summary}</p>
      {article.item.calendarEvents.length>0&&<div className="school-personal-news-dates"><h4><CalendarDays aria-hidden="true" /> Les dates à retenir</h4>{article.item.calendarEvents.map(e=><p key={e.key}><strong>{e.title}</strong><span>{calendarDateLabel(e)}{e.location?` · ${e.location}`:''}</span></p>)}<a href={`/api/identity/device/news?article=${article.item.id}&format=ics`}><Download aria-hidden="true" />Ajouter à mon calendrier</a><small>Le fichier téléchargé conserve ces dates. En cas de changement, consultez la version actualisée ici.</small></div>}
      <div className="school-personal-news-body"><PublicContentMarkdown>{article.bodyMarkdown}</PublicContentMarkdown></div>
      {article.assets.length>0&&<div className="school-personal-news-documents"><h4>Documents et images</h4>{article.assets.map(a=><a key={a.id} target="_blank" rel="noreferrer" href={`/api/identity/device/news?article=${article.item.id}&asset=${a.id}`}><Download aria-hidden="true" />{a.label}</a>)}</div>}
    </>}
  </section>;
  return <section className="school-personal-news" aria-labelledby="personal-news-title"><header><div><h3 id="personal-news-title"><Newspaper aria-hidden="true" /> Les infos qui me concernent</h3><p>Les publications du lycée pour votre profil et la classe choisie.</p></div></header>
    {Date.parse(feed.validUntil)<=Date.now()?<p className="school-personal-empty" aria-live="polite">Actualisation des informations…</p>:feed.status==='unavailable'?<p className="school-personal-empty">Les informations ne peuvent pas être chargées pour le moment.</p>:!feed.items.length?<p className="school-personal-empty">Aucune information en cours pour votre profil. Les actualités publiques restent disponibles plus bas.</p>:<>
      <div className="school-personal-news-grid">{feed.items.slice(0,showAll?8:3).map(item=>{const next=[...item.calendarEvents].filter(e=>e.endDate>=today).sort((a,b)=>a.startDate.localeCompare(b.startDate))[0];return <article key={item.id}>
        <NewsPhoto content={item} compact /><div><small>{item.targeted?'Pour vous':'Tout le lycée'}</small><h4>{item.title}</h4><p>{item.summary}</p>{next&&<p className="school-personal-news-date"><CalendarDays aria-hidden="true" />{calendarDateLabel(next)}</p>}<button type="button" onClick={()=>setSelected(item.id)}>Lire l’information<ArrowRight aria-hidden="true" /></button></div>
      </article>;})}</div>
      {feed.items.length>3&&<button type="button" className="school-personal-all-requests" onClick={()=>setShowAll(v=>!v)}>{showAll?'Voir moins':'Voir plus d’informations'}<ArrowRight aria-hidden="true" /></button>}
      {feed.more&&showAll&&<p className="school-personal-note">Les huit dernières informations pertinentes sont affichées.</p>}
    </>}
  </section>;
}
