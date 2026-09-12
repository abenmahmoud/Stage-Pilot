import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

type Group = {ref:string;label:string};
export function FlashAudiencePicker({selected,onChange}:{selected:string[];onChange:(groups:string[])=>void}) {
  const [groups,setGroups]=useState<Group[]>([]),[query,setQuery]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;setError('');void apiFetch<{groups:Group[]}>('flash/audiences').then(result=>{
    if(!Array.isArray(result.groups)||result.groups.length>1003||result.groups.some(g=>!g||typeof g.ref!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9:_-]{2,79}$/.test(g.ref)||typeof g.label!=='string'||g.label.length>120))throw new Error();
    if(active)setGroups(result.groups);
  }).catch(()=>{if(active)setError('Les classes ne peuvent pas être chargées. Réessayez avant de choisir le public.');});return()=>{active=false;};},[retry]);
  const all=[{ref:'public:site',label:'Visible par tous, sans connexion'},...groups];
  const filtered=all.filter(g=>selected.includes(g.ref)||g.label.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')));
  const shown=filtered.filter(g=>selected.includes(g.ref)).concat(filtered.filter(g=>!selected.includes(g.ref)).slice(0,20));
  function toggle(ref:string){onChange(selected.includes(ref)?selected.filter(g=>g!==ref):ref==='public:site'?[ref]:[...selected.filter(g=>g!=='public:site'),ref]);}
  return <div className="space-y-3"><p className="text-xs text-gray-600">Les groupes sont issus de l’annuaire du lycée. Seul « Visible par tous » rend le texte public.</p>
    <label className="block text-sm">Rechercher une classe ou un public<input className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Parents, élèves, nom de classe…"/></label>
    {error&&<p role="alert" className="text-sm text-red-700">{error} <button type="button" className="underline" onClick={()=>setRetry(n=>n+1)}>Réessayer</button></p>}
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{shown.map(g=><label key={g.ref} className="flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-200 p-3 text-sm"><input type="checkbox" checked={selected.includes(g.ref)} onChange={()=>toggle(g.ref)}/><span>{g.label}</span></label>)}</div>
    {filtered.length>shown.length&&<p className="text-xs text-gray-500">Précisez votre recherche pour afficher les autres classes.</p>}
    {selected.some(ref=>!all.some(g=>g.ref===ref))&&<p role="alert" className="text-sm text-amber-800">Un ancien groupe doit être remplacé. <button type="button" className="underline" onClick={()=>onChange(selected.filter(ref=>all.some(g=>g.ref===ref)))}>Retirer les groupes indisponibles</button></p>}
  </div>;
}
