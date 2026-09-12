import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Coins, RefreshCw, ShieldCheck } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { isAiBudgetOverview, type AiBudgetOverview } from "../../../shared/ai-budget-overview";

const euros = (micros: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(micros / 1_000_000);
const labels: Record<string, string> = { support_assistant: "Conversations", content_assist: "Articles et hebdos", communication_assist: "Préparation des communications", support_translation: "Traduction des réponses" };

export default function AiBudgetPage() {
  const [data, setData] = useState<AiBudgetOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const value = await apiFetch<unknown>("support/agent/budget");
      if (!isAiBudgetOverview(value)) throw new Error("invalid_budget");
      setData(value);
    } catch { setData(null); setError("Le suivi du budget est indisponible. Réessayez dans quelques instants."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <div className="mx-auto max-w-5xl space-y-6">
    <Link to="/gestion" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft className="h-4 w-4" />Gestion du lycée</Link>
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6"><div><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700"><Coins className="h-4 w-4" />Superadministration</p><h1 className="font-heading text-3xl font-bold text-slate-950">Coûts et budget IA</h1><p className="mt-2 text-slate-600">Une vue sur la consommation et les limites des appels payants.</p></div><button type="button" onClick={() => void load()} disabled={loading} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualiser</button></header>
    {error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">{error}</p>}
    {loading && !data && <p role="status">Chargement du suivi…</p>}
    {data && <>
      <section className={`flex gap-3 rounded-2xl border p-5 ${data.guardStatus === "enabled" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><ShieldCheck className="mt-1 h-5 w-5 shrink-0" /><div><h2 className="font-semibold">{data.guardStatus === "enabled" ? "Plafond quotidien actif" : data.guardStatus === "disabled" ? "Plafond quotidien désactivé" : "Configuration du plafond à vérifier"}</h2><p className="mt-1 text-sm leading-relaxed">{data.guardStatus === "enabled" ? "Les appels payants s’arrêtent lorsque l’enveloppe est engagée. Le chat conserve ses réponses locales et les demandes restent accessibles." : "Le contrôle des dépenses doit être configuré côté serveur."}</p></div></section>
      <div className="grid gap-3 sm:grid-cols-3">{[
        ["Plafond par jour", data.limitMicros === null ? "Non configuré" : euros(data.limitMicros)],
        ["Coût estimé aujourd’hui", euros(data.today.settledMicros)],
        ["Estimation sur 30 jours", data.pricingConfigured ? euros(data.period.estimatedCostMicros) : "Non configurée"],
      ].map(([label, value]) => <section key={label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><strong className="mt-3 block text-3xl text-slate-950">{value}</strong></section>)}</div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">L’enveloppe du jour</h2><p className="mt-2 text-sm text-slate-600">{euros(data.today.committedMicros)} engagés, dont les appels en cours ou dont le résultat n’est pas confirmé. La part inutilisée est libérée quand le fournisseur retourne sa consommation.</p>{data.limitMicros !== null && <progress className="mt-4 h-2 w-full accent-emerald-600" aria-label="Enveloppe quotidienne engagée" value={Math.min(data.today.committedMicros, data.limitMicros)} max={data.limitMicros} />}<p className="mt-2 text-sm text-slate-500">{data.today.calls} appels réservés · {data.today.pending} en attente de consommation confirmée. Remise à zéro du plafond à minuit, heure de Paris.</p>{data.today.overEnvelope > 0 && <p role="alert" className="mt-3 font-semibold text-amber-800">Une consommation dépasse son estimation initiale : le tarif ou les limites d’appel doivent être vérifiés.</p>}</section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><h2 className="p-5 font-semibold text-slate-950">Appels mesurés sur 30 jours</h2>{data.operations.length ? data.operations.map(row => <div key={row.operation} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4"><div><strong className="text-sm text-slate-800">{labels[row.operation]}</strong><p className="mt-1 text-xs text-slate-500">{row.calls} appels</p></div><span className="font-semibold text-slate-900">{euros(row.estimatedCostMicros)}</span></div>) : <p className="px-5 pb-5 text-sm text-slate-500">Aucun appel payant mesuré sur cette période.</p>}</section>
      <div className="space-y-2 text-sm leading-relaxed text-slate-500"><p>Estimations hors taxes, frais bancaires, SMS, emails et hébergement. Elles ne constituent pas la facture du fournisseur. {data.period.unknownCalls} appels sans coût connu ; {data.period.repricedCalls} appels historiques estimés au tarif actuel.</p><p>Modèle : {data.model}. Tarif vérifié le {data.pricingDate ?? "non renseigné"}. {data.usdPerEur ? `Conversion indicative : 1 € = ${data.usdPerEur} $, référence du ${data.fxDate ?? "jour non renseigné"}.` : "Conversion non renseignée."}</p><p>La modification des plafonds et des clés reste réservée au superadmin, dans la configuration serveur. Aucun crédit n’est acheté depuis cette page.</p></div>
    </>}
  </div>;
}
