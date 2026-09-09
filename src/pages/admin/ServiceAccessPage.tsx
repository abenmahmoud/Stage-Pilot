import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UsersRound, ArrowUpRight } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { SUPPORT_SERVICES } from "../../../shared/support-agent-access";
type Overview = { services: {code:string; label:string; activeAccounts:number}[]; passwordOnlyUntil:string|null };
export default function ServiceAccessPage() {
  const [overview,setOverview]=useState<Overview|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{let active=true;void apiFetch<Overview>("admin/service-access").then(value=>{
    if (!value || !Array.isArray(value.services) || value.services.length!==SUPPORT_SERVICES.length || value.services.some(item=>!SUPPORT_SERVICES.includes(item.code as typeof SUPPORT_SERVICES[number]) || typeof item.label!=="string" || !Number.isSafeInteger(item.activeAccounts) || item.activeAccounts<0)) throw new Error("invalid");
    if(active)setOverview(value);
  }).catch(()=>{if(active)setError("La liste des accès n’a pas pu être chargée. Actualisez la page.");});return()=>{active=false;};},[]);
  return <div className="mx-auto max-w-5xl space-y-6">
    <div><h1 className="text-2xl font-bold text-slate-900">Les services du lycée</h1><p className="mt-2 text-slate-600">Chaque équipe retrouve ses demandes. Les messages, les documents et l’historique sont regroupés dans chaque dossier.</p></div>
    {error?<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>:null}
    {overview?.passwordOnlyUntil?<p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">Pendant les essais, les comptes des agents et de l’administration peuvent se connecter avec leur email et leur mot de passe, sans double authentification obligatoire, jusqu’au {new Date(overview.passwordOnlyUntil).toLocaleDateString("fr-FR",{timeZone:"Europe/Paris"})}. Les droits d’accès de chaque compte restent inchangés.</p>:null}
    {!overview&&!error?<p role="status">Chargement des services…</p>:null}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{overview?.services.map(service=><article key={service.code} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <UsersRound className="mb-4 h-6 w-6 text-blue-600" aria-hidden="true"/><h2 className="text-lg font-semibold text-slate-900">{service.label}</h2>
      <p className="my-3 text-sm text-slate-600">{service.activeAccounts>0?`${service.activeAccounts} compte${service.activeAccounts>1?"s":""} habilité${service.activeAccounts>1?"s":""}`:"Aucun compte affecté pour le moment"}</p>
      <Link className="inline-flex min-h-11 items-center gap-2 font-semibold text-blue-700" to={`/?view=agent&service=${service.code}`}>Ouvrir les demandes<ArrowUpRight className="h-4 w-4" aria-hidden="true"/></Link>
    </article>)}</div>
    <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600"><h2 className="mb-2 font-semibold text-slate-900">Préparer l’arrivée d’un collègue</h2><p>Pour associer un compte individuel, il faut son nom, son email professionnel et les services autorisés. Un rôle n’est jamais déduit de l’adresse email. Le collègue ouvre ensuite son espace, prend une demande et répond dans le dossier. Il peut activer « Me prévenir » sur son téléphone.</p></div>
  </div>;
}
