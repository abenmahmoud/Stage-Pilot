import { useEffect, useState } from 'react';
import { UsersRound } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { CONTENT_TARGET_PROFILES, type ContentTargeting } from '../../shared/content-targeting';

export function ContentAudienceEditor({ audience, value, onChange }: { audience: string; value: ContentTargeting | null; onChange: (audience: string, value: ContentTargeting | null) => void }) {
  const [classes,setClasses] = useState<string[]>([]), [failed,setFailed] = useState(false), [loaded,setLoaded] = useState(false);
  const [filter,setFilter] = useState('');
  useEffect(()=>{let active=true; apiFetch<unknown>('content/admin/audiences').then(result=>{
    const rows = (result as {classes?:unknown})?.classes;
    if (!Array.isArray(rows) || rows.length>300 || !rows.every(c=>typeof c==='string' && c.length>0 && c.length<=80)) throw new Error('classes');
    if(active){setClasses(rows);setLoaded(true);}
  }).catch(()=>{if(active){setFailed(true);setLoaded(true);}});return()=>{active=false;};},[]);
  const labels = { eleves:'Élèves', parents:'Parents et responsables', personnels:'Tous les personnels' };
  const targeted = audience !== 'tous';
  const chosen = value ?? {profiles: CONTENT_TARGET_PROFILES.includes(audience as typeof CONTENT_TARGET_PROFILES[number]) ? [audience as typeof CONTENT_TARGET_PROFILES[number]] : [],classRefs:[]};
  const update = (next:ContentTargeting) => onChange(next.profiles[0] ?? 'eleves',next);
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3" aria-label="Public de cette information">
    <h3 className="flex items-center gap-2 text-sm font-bold"><UsersRound className="h-4 w-4" /> Qui peut lire cette information ?</h3>
    <select aria-label="Visibilité de l’information" className="field w-full bg-white" value={targeted?'selected':'public'} onChange={e=>e.target.value==='public'?onChange('tous',null):update({profiles:['eleves'],classRefs:[]})}>
      <option value="public">Tout le monde · site public</option><option value="selected">Profils ou classes · espace personnel</option>
    </select>
    {targeted && <><fieldset className="space-y-1"><legend className="mb-1 text-xs font-semibold text-slate-600">Profils concernés</legend>{CONTENT_TARGET_PROFILES.map(p=><label key={p} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={chosen.profiles.includes(p)} disabled={(chosen.profiles.length===1&&chosen.profiles.includes(p))||(p==='personnels'&&chosen.classRefs.length>0)} onChange={e=>{
      const profiles=e.target.checked?[...chosen.profiles,p]:chosen.profiles.filter(v=>v!==p);
      if(profiles.length) update({profiles,classRefs:profiles.includes('personnels')?[]:chosen.classRefs});
    }} />{labels[p]}</label>)}</fieldset>
    {audience==='professeurs' && !value && <p className="text-xs text-amber-800">Ancien public « Professeurs » : choisissez un profil vérifiable pour rendre cette information accessible dans l’espace personnel.</p>}
    {!chosen.profiles.includes('personnels') && <details open={chosen.classRefs.length>0}><summary className="cursor-pointer py-2 text-sm font-semibold">{chosen.classRefs.length?`${chosen.classRefs.length} classe(s) choisie(s)`:'Toutes les classes · affiner'}</summary>
      <p className="mb-2 text-xs text-slate-500">Sans classe cochée, tous les profils choisis sont concernés.</p>
      <input className="field w-full" aria-label="Rechercher une classe" placeholder="Rechercher une classe" value={filter} onChange={e=>setFilter(e.target.value)} />
      <div className="mt-2 max-h-52 overflow-y-auto">{[...new Set([...chosen.classRefs,...classes])].filter(c=>c.toLowerCase().includes(filter.toLowerCase())).map(c=><label key={c} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={chosen.classRefs.includes(c)} onChange={e=>update({...chosen,classRefs:e.target.checked?[...chosen.classRefs,c]:chosen.classRefs.filter(v=>v!==c)})} />{c}{!classes.includes(c)&&loaded?' · à vérifier':''}</label>)}</div>
      {!loaded?<p className="text-xs">Chargement des classes…</p>:failed?<p role="status" className="text-xs text-amber-800">La liste ne peut pas être chargée. Les classes déjà choisies sont conservées.</p>:!classes.length?<p className="text-xs">Aucune classe disponible dans l’annuaire actif.</p>:null}
    </details>}
    <p className="text-xs leading-5 text-slate-500">Visible après validation, uniquement dans l’espace des personnes concernées. Aucune notification automatique n’est envoyée.</p></>}
  </section>;
}
