import { Link } from "react-router-dom";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { useManagementLinks } from "../../components/ManagementNavigation";

export default function ManagementHomePage() {
  const { user } = useAuth();
  const links = useManagementLinks(user!.role, user!.id).filter(item => item.to !== "/gestion" && item.to !== "/security");
  return <div className="mx-auto max-w-6xl space-y-8">
    <header className="space-y-3 border-b border-slate-200 pb-7">
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><ShieldCheck className="h-4 w-4" /> Gestion du lycée</p>
      <h1 className="font-heading text-3xl font-bold text-slate-950">Votre espace de travail</h1>
      <p className="max-w-2xl leading-relaxed text-slate-600">Traitez les demandes, préparez les informations et retrouvez les outils ouverts à votre fonction.</p>
    </header>
    {[...new Set(links.map(item => item.group))].map(group => <section key={group} className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-600">{group}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{links.filter(item => item.group === group).map(item => <Link key={item.to} to={item.to} className="group flex min-h-24 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-emerald-500 focus-visible:outline-2 focus-visible:outline-emerald-600">
        <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><item.icon className="h-5 w-5" /></span><strong className="flex-1 text-sm text-slate-900">{item.label}</strong><ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-emerald-700" />
      </Link>)}</div>
    </section>)}
    <p className="text-sm text-slate-500">Les informations et les envois restent soumis aux validations prévues pour votre service.</p>
  </div>;
}
