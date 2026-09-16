import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Database, Download, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { isCrossDataPayload, type CrossDataPayload, type CrossDataFilter, type CrossPerson } from '../../../shared/admin-cross-data';
import IdentityDirectoryLookupPanel from './IdentityDirectoryLookupPanel';

const profiles: Record<string,string>={student:'Élève',guardian:'Responsable',staff:'Personnel'};
const filters: [CrossDataFilter,string][]=[['all','Toutes les fiches'],['missing_phone','Téléphone manquant'],['missing_email','Email manquant'],['missing_contact','Aucun contact'],['missing_ent','ENT incomplet'],['missing_koxo','Personnel sans accès PC'],['missing_schedule','EDT absent ou à actualiser'],['conflict','Correspondance à vérifier']];
const relations:Record<string,string>={guardian_of:'Responsable de',teaches:'Enseigne à',manages:'Gère',member_of:'Membre de'};
const date=(s:string|null)=>s?new Date(s).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}):'Non renseigné';
function Badge({children,warn=false}:{children:React.ReactNode;warn?:boolean}) {return <span className={`inline-block rounded-lg px-2 py-1 text-xs font-medium ${warn?'bg-amber-50 text-amber-900':'bg-slate-100 text-slate-700'}`}>{children}</span>;}
function csvCell(v:unknown){const s=String(v??'');return `"${(/^[=+@\-\t\r]/.test(s)?"'":'')+s.replaceAll('"','""')}"`;}

export default function CrossDataPage(){
  const [data,setData]=useState<CrossDataPayload|null>(null); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const [search,setSearch]=useState(''); const [query,setQuery]=useState(''); const [profile,setProfile]=useState('all'); const [filter,setFilter]=useState<CrossDataFilter>('all'); const [page,setPage]=useState(0); const [selected,setSelected]=useState<string|null>(null); const [lookup,setLookup]=useState(false);
  const request=useRef(0);
  const load=useCallback(async()=>{
    if(document.hidden)return;
    const id=++request.current;setBusy(true);setError('');
    try{const result=await apiFetch<unknown>('identity/admin/cross-data',{method:'POST',body:JSON.stringify({search:query,profile,filter,page,personRef:selected})});
      if(id!==request.current)return;if(!isCrossDataPayload(result))throw new Error('Réponse de consultation invalide.');setData(result);
    }catch(e){if(id===request.current){setData(null);setError(e instanceof Error?e.message:'Lecture impossible.');}}
    finally{if(id===request.current)setBusy(false);}
  },[query,profile,filter,page,selected]);
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),60000);
    const onVisibility=()=>{if(document.hidden){++request.current;setData(null);setSelected(null);setLookup(false);setBusy(false);}else void load();};
    const onOffline=()=>{++request.current;setData(null);setSelected(null);setLookup(false);setError('Hors connexion. Reconnectez-vous pour consulter les données.');};
    document.addEventListener('visibilitychange',onVisibility);window.addEventListener('offline',onOffline);
    return()=>{++request.current;window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('offline',onOffline);};
  },[load]);
  const choose=(ref:string)=>{setData(d=>d?{...d,detail:null}:d);setSelected(ref);};
  const resetPage=()=>{setPage(0);setSelected(null);setData(null);};
  function exportPage(){if(!data)return;const matrix=[['Référence ENT','Profil','Classe','Email présent','Téléphone présent','ENT renseigné','Accès PC','EDT'],...data.people.map(p=>[p.personRef,profiles[p.personType],p.classRef,p.email?'Oui':'Non',p.phone?'Oui':'Non',p.ent?'Oui':'Non',p.koxo,p.schedule])];
    const blob=new Blob(['\uFEFF'+matrix.map(row=>row.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`croisement-page-${(data.page+1)}.csv`;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const detail=data?.detail;
  return <div className="mx-auto max-w-7xl space-y-6 pb-10">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700"><ShieldCheck className="h-4 w-4"/>Superadministration</p><h1 className="text-3xl font-bold text-slate-950">Données croisées</h1><p className="mt-2 max-w-2xl text-slate-600">Retrouvez les informations d’une personne et les données à compléter, à partir des versions validées du lycée.</p></div><button onClick={()=>void load()} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy?'animate-spin':''}`}/>Actualiser</button></header>
    {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
    {data&&<>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{([['Personnes',data.totals.people,'all'],['Élèves',data.totals.students,'student'],['Responsables',data.totals.guardians,'guardian'],['Personnels',data.totals.staff,'staff']] as const).map(([label,n,p])=><button key={label} onClick={()=>{resetPage();setProfile(p);setFilter('all');}} className={`rounded-2xl border p-4 text-left ${profile===p?'border-blue-300 bg-blue-50':'border-slate-200 bg-white'}`}><span className="block text-2xl font-bold text-slate-950">{n.toLocaleString('fr-FR')}</span><span className="text-sm text-slate-600">{label}</span></button>)}</div>
      <div className="flex flex-wrap gap-2">{([['missing_phone',`${data.totals.missingPhone} sans téléphone`],['missing_contact',`${data.totals.missingContact} sans contact`],['conflict',`${data.totals.conflicts} à vérifier`]] as const).map(([f,label])=><button key={f} onClick={()=>{resetPage();setFilter(f);setProfile('all');}} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm hover:border-blue-400">{label}</button>)}</div>
    </>}
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <form className="grid gap-3 lg:grid-cols-[1fr_180px_240px_auto]" onSubmit={e=>{e.preventDefault();resetPage();setQuery(search);}}>
        <label className="text-sm font-medium text-slate-700">Référence ENT ou classe<input aria-label="Référence ENT ou classe" className="field mt-1" autoComplete="off" placeholder="Ex. prénom.nom2 ou 2GT1" value={search} onChange={e=>setSearch(e.target.value)} maxLength={120}/></label>
        <label className="text-sm font-medium text-slate-700">Profil<select className="field mt-1" value={profile} onChange={e=>{resetPage();setProfile(e.target.value);}}><option value="all">Tous les profils</option>{Object.entries(profiles).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Question rapide<select aria-label="Question rapide" className="field mt-1" value={filter} onChange={e=>{resetPage();setFilter(e.target.value as CrossDataFilter);}}>{filters.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <button className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700" type="submit"><Search className="h-4 w-4"/>Rechercher</button>
      </form>
      <button onClick={()=>setLookup(v=>!v)} className="mt-3 text-sm font-semibold text-blue-700">{lookup?'Fermer la recherche par contact':'Retrouver une personne avec son email ou son téléphone'}</button>
      {lookup&&<div className="mt-4"><IdentityDirectoryLookupPanel onSelectPerson={choose}/></div>}
    </section>
    {busy&&!data&&<p role="status" className="p-6 text-center text-slate-600">Croisement des versions actives…</p>}
    {detail&&<section className="rounded-2xl border border-blue-200 bg-white p-5 sm:p-6" aria-label="Fiche croisée">
      <div className="flex items-start justify-between gap-3"><div><p className="text-sm text-slate-500">Fiche croisée · {profiles[detail.person.personType]}</p><h2 className="mt-1 break-all text-xl font-bold text-slate-950">{detail.person.personRef}</h2></div><button className="rounded-lg p-2 hover:bg-slate-100" aria-label="Fermer la fiche" onClick={()=>{setSelected(null);setData(d=>d?{...d,detail:null}:d);}}><X className="h-5 w-5"/></button></div>
      <div className="mt-4 flex flex-wrap gap-2"><Badge>Email {detail.person.email?'renseigné':'absent'}</Badge><Badge>Téléphone {detail.person.phone?'renseigné':'absent'}</Badge>{detail.person.personType!=='guardian'&&<Badge warn={detail.person.koxo!=='linked'}>PC : {detail.person.koxo==='linked'?'accès présent':detail.person.koxo==='review'?'à vérifier':'absent du coffre'}</Badge>}</div>
      <div className="mt-5 grid gap-6 lg:grid-cols-2"><div><h3 className="font-semibold">Informations disponibles</h3><dl className="mt-3 space-y-3">{detail.person.classRef&&<div><dt className="text-xs text-slate-500">Classe · annuaire</dt><dd>{detail.person.classRef}</dd></div>}{detail.attributes.map(a=><div key={a.key}><dt className="text-xs text-slate-500">{a.label} · {a.source}</dt><dd className="break-words font-medium">{a.conflict?'Plusieurs valeurs : vérification nécessaire':a.value}</dd></div>)}</dl>{!detail.attributes.length&&<p className="mt-2 text-sm text-slate-500">Aucun attribut complémentaire actif.</p>}<h3 className="mt-5 font-semibold">Matières relevées dans l’EDT</h3><p className="mt-2 text-sm text-slate-600">{detail.subjects.length?detail.subjects.join(' · '):'Aucune matière rattachée dans l’EDT publié.'}</p><p className="mt-2 text-xs text-slate-500">Ces libellés décrivent les cours importés. La discipline administrative peut être différente.</p></div>
      <div><h3 className="font-semibold">Relations de l’annuaire</h3><ul className="mt-3 space-y-2">{detail.relations.map((r,i)=><li key={`${r.type}-${r.reference}-${i}`} className="rounded-xl bg-slate-50 p-3 text-sm"><span className="text-slate-500">{r.direction==='in'?'Lien reçu : ':''}{relations[r.type]??r.type}</span>{r.linked?<button className="mt-1 block break-all text-left font-semibold text-blue-700" onClick={()=>choose(r.reference)}>{r.reference}<ArrowRight className="ml-2 inline h-3 w-3"/></button>:<p className="break-all font-medium">{r.reference}</p>}</li>)}</ul>{!detail.relations.length&&<p className="mt-2 text-sm text-slate-500">Aucun lien renseigné dans la version active.</p>}</div></div>
    </section>}
    {data&&<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4"><h2 className="font-semibold">{data.total.toLocaleString('fr-FR')} résultat{data.total!==1?'s':''}</h2><button disabled={!data.people.length} className="flex items-center gap-2 text-sm text-blue-700 disabled:opacity-40" onClick={exportPage}><Download className="h-4 w-4"/>Exporter cette page</button></div>
      <div className="divide-y divide-slate-100">{data.people.map(p=><PersonRow key={p.personRef} person={p} onSelect={()=>choose(p.personRef)}/>)}{!data.people.length&&<p className="p-8 text-center text-slate-500">{data.revision?'Aucune fiche ne correspond à ces critères.':'Activez un annuaire validé pour commencer.'}</p>}</div>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 p-4 text-sm"><button disabled={data.page===0||busy} className="rounded-lg border px-3 py-2 disabled:opacity-30" onClick={()=>{setSelected(null);setPage(data.page-1);}}>Précédent</button><span>Page {data.page+1} / {Math.max(1,Math.ceil(data.total/25))}</span><button disabled={(data.page+1)*25>=data.total||busy} className="rounded-lg border px-3 py-2 disabled:opacity-30" onClick={()=>{setSelected(null);setPage(data.page+1);}}>Suivant</button></div>
    </section>}
    <section className="rounded-2xl bg-slate-100 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><Database className="h-4 w-4"/>Sources utilisées</h2><Link className="text-sm font-semibold text-blue-700" to="/admin/repertoire-identites">Importer ou contrôler des données</Link></div>
      <p className="mt-2 text-sm text-slate-600">Les ajouts apparaissent après contrôle et activation de leur import. Actualisation toutes les minutes lorsque cette page est visible.</p>
      {data&&<ul className="mt-4 grid gap-3 lg:grid-cols-2">{data.sources.map((s,i)=><li key={`${s.kind}-${i}`} className="rounded-xl bg-white p-4"><p className="font-semibold">{s.kind} {s.status==='stale'&&<Badge warn>À actualiser</Badge>}</p><p className="mt-1 break-all text-sm text-slate-600">{s.name}</p><p className="mt-2 text-xs text-slate-500">{s.count.toLocaleString('fr-FR')} {s.kind.startsWith('EDT')?'calendriers':'enregistrements'} · {date(s.date)}</p></li>)}</ul>}
      {!data?.sources.some(s=>/si[eè]cle/i.test(s.name))&&<p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Complément SIECLE : aucune source active identifiée comme SIECLE dans ce tableau. L’export annoncé reste à déposer et à contrôler pour compléter les coordonnées et les relations familiales.</p>}
      <p className="mt-3 text-xs text-slate-500">{data?`Consultation du ${date(data.refreshedAt)}. `:''}Accès réservé au superadmin. Aucun mot de passe affiché. « Personnel » inclut les enseignants et les autres agents ; un EDT ou un accès PC absent n’est pas toujours une anomalie.</p>
    </section>
  </div>;
}
function PersonRow({person:p,onSelect}:{person:CrossPerson;onSelect:()=>void}){return <button onClick={onSelect} className="flex w-full flex-col gap-3 p-4 text-left hover:bg-blue-50/40 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-all font-semibold text-slate-900">{p.personRef}</p><p className="mt-1 text-xs text-slate-500">{profiles[p.personType]??p.personType}{p.classRef?` · ${p.classRef}`:''} · {p.relations} lien{p.relations>1?'s':''}</p></div><div className="flex shrink-0 flex-wrap gap-2"><Badge warn={!p.email}>Email {p.email?'✓':'absent'}</Badge><Badge warn={!p.phone}>Tél. {p.phone?'✓':'absent'}</Badge>{p.personType==='staff'&&<Badge warn={p.koxo!=='linked'}>PC {p.koxo==='linked'?'✓':p.koxo==='review'?'à vérifier':'absent'}</Badge>}{p.schedule!=='not_applicable'&&<Badge warn={p.schedule!=='linked'}>EDT {p.schedule==='linked'?'relié':p.schedule==='stale'?'à actualiser':'absent'}</Badge>}{p.conflict&&<Badge warn>À vérifier</Badge>}</div></button>;}
