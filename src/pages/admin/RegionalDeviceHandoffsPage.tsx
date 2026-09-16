import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ClipboardList, Laptop2, Plus, RefreshCw, RotateCcw, Search, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

type Handoff = {
  id: string;
  studentName: string;
  className: string;
  status: "pending" | "delivered";
  createdAt: string;
  deliveredAt: string | null;
  deliveredBy: string | null;
};
type Payload = { schoolYear: string; items: Handoff[] };
type Filter = "pending" | "delivered" | "all";

function dateTime(value: string): string {
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function RegionalDeviceHandoffsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [mutating, setMutating] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setData(await apiFetch<Payload>("regional-devices/handoffs"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le suivi ne peut pas être chargé.");
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const pending = data?.items.filter(item => item.status === "pending").length ?? 0;
  const delivered = data?.items.filter(item => item.status === "delivered").length ?? 0;
  const visible = useMemo(() => (data?.items ?? []).filter(item =>
    (filter === "all" || item.status === filter) &&
    `${item.studentName} ${item.className}`.toLocaleLowerCase("fr-FR").includes(search.toLocaleLowerCase("fr-FR").trim())
  ), [data, filter, search]);

  async function add(items: { studentName: string; className: string }[]) {
    setMutating("add"); setError(""); setNotice("");
    try {
      const result = await apiFetch<{ added: number; duplicates: number }>("regional-devices/handoffs", {
        method: "POST", body: JSON.stringify({ items }),
      });
      setNotice(`${result.added} élève${result.added > 1 ? "s" : ""} ajouté${result.added > 1 ? "s" : ""}${result.duplicates ? ` · ${result.duplicates} déjà présent${result.duplicates > 1 ? "s" : ""}` : ""}.`);
      setName(""); setClassName(""); setBulk(""); setFilter("pending");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ajout impossible.");
    } finally {
      setMutating(null);
    }
  }

  async function change(item: Handoff, action: "deliver" | "reopen" | "remove") {
    if (action === "remove" && !window.confirm(`Retirer ${item.studentName} de la liste ?`)) return;
    setMutating(item.id); setError(""); setNotice("");
    try {
      await apiFetch("regional-devices/handoffs", { method: "PATCH", body: JSON.stringify({ id: item.id, action }) });
      setNotice(action === "deliver" ? `Remise enregistrée pour ${item.studentName}.` : action === "reopen" ? "Remise annulée ; l’élève est de nouveau à remettre." : "Ligne retirée de la liste.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Modification impossible.");
    } finally {
      setMutating(null);
    }
  }

  const bulkLines = bulk.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const parsedBulk = bulkLines.map(line => {
    const parts = line.split(/[;\t]/).map(part => part.trim());
    return parts.length === 2 && parts[0] && parts[1] ? { studentName: parts[0], className: parts[1] } : null;
  });
  const bulkValid = bulkLines.length > 0 && bulkLines.length <= 100 && parsedBulk.every(Boolean);

  return <div className="mx-auto max-w-6xl space-y-6 pb-12">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700"><Laptop2 className="h-4 w-4" />Suivi privé · Région Île-de-France</p>
        <h1 className="text-3xl font-bold text-slate-950">Remise des ordinateurs</h1>
        <p className="mt-2 max-w-2xl text-slate-600">Retrouvez les élèves qui doivent encore récupérer leur PC. Vérifiez l’identité et le colis nominatif avant de confirmer chaque remise.</p>
      </div>
      <button type="button" onClick={() => void load()} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />Actualiser</button>
    </header>

    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}{error.toLowerCase().includes("vérification") && <> <Link to="/security" className="font-semibold underline">Ouvrir la sécurité du compte</Link></>}</div>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">{notice}</p>}

    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:p-5">
      <p className="font-semibold">Remise au lycée et affectation régionale</p>
      <p className="mt-1">Ce suivi privé enregistre uniquement la remise physique. Il ne scanne pas le QR code MonOrdi IdF et n’affecte pas l’ordinateur dans le système de la Région. Pour les élèves absents, vérifiez la procédure de remise différée avec la Région ou La Poste avant de les convoquer.</p>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <button onClick={() => setFilter("pending")} className={`rounded-2xl border p-4 text-left ${filter === "pending" ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"}`}><span className="block text-3xl font-bold text-slate-950">{pending}</span><span className="text-sm font-medium text-slate-600">À remettre</span></button>
      <button onClick={() => setFilter("delivered")} className={`rounded-2xl border p-4 text-left ${filter === "delivered" ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white"}`}><span className="block text-3xl font-bold text-slate-950">{delivered}</span><span className="text-sm font-medium text-slate-600">Remis</span></button>
    </div>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex items-center gap-2"><Plus className="h-5 w-5 text-blue-700" /><h2 className="text-lg font-bold text-slate-950">Ajouter un élève</h2></div>
      <p className="mt-1 text-sm text-slate-600">Sur les feuilles remises par l’administration, retenez les « A » non effacés et les mentions « Absent » lisibles. Vérifiez le nom, la classe et le colis conservé au lycée avant d’ajouter un élève.</p>
      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_auto]" onSubmit={event => { event.preventDefault(); void add([{ studentName: name, className }]); }}>
        <label className="text-sm font-medium text-slate-700">Nom et prénom<input className="field mt-1" autoComplete="off" value={name} maxLength={160} onChange={event => setName(event.target.value)} required placeholder="Nom Prénom" /></label>
        <label className="text-sm font-medium text-slate-700">Classe<input className="field mt-1" autoComplete="off" value={className} maxLength={60} onChange={event => setClassName(event.target.value)} required placeholder="Ex. 2GT1" /></label>
        <button type="submit" disabled={!!mutating} className="min-h-11 self-end rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Ajouter</button>
      </form>
      <button type="button" onClick={() => setShowBulk(value => !value)} className="mt-4 text-sm font-semibold text-blue-700">{showBulk ? "Fermer l’ajout en lot" : "Ajouter plusieurs élèves à la fois"}</button>
      {showBulk && <div className="mt-3 space-y-3">
        <p className="text-sm text-slate-600">Une ligne par élève : <strong>Nom Prénom ; Classe</strong>. Vérifiez les lignes avant l’ajout (100 maximum).</p>
        <label className="block text-sm font-medium text-slate-700">Ou choisir un fichier CSV/TXT préparé dans ce format
          <input type="file" accept=".csv,.txt,text/csv,text/plain" className="mt-2 block w-full text-sm" onChange={event => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 20_000) { setError("Fichier trop volumineux : 100 lignes maximum."); return; }
            void file.text().then(text => { setBulk(text.replace(/^\uFEFF/, "")); setError(""); }).catch(() => setError("Lecture du fichier impossible."));
          }} />
        </label>
        <textarea className="field min-h-36" value={bulk} onChange={event => setBulk(event.target.value)} placeholder={"NOM Prénom ; 2GT1\nNOM Prénom ; 2PRO3"} aria-label="Élèves à ajouter en lot" />
        {bulkLines.length > 0 && <p className={`text-sm ${bulkValid ? "text-emerald-700" : "text-red-700"}`}>{bulkValid ? `${bulkLines.length} ligne${bulkLines.length > 1 ? "s" : ""} prête${bulkLines.length > 1 ? "s" : ""} à ajouter.` : "Chaque ligne doit comporter un nom et une classe séparés par ; (100 lignes maximum)."}</p>}
        <button type="button" disabled={!bulkValid || !!mutating} onClick={() => void add(parsedBulk as { studentName: string; className: string }[])} className="min-h-11 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Ajouter ces élèves</button>
      </div>}
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold text-slate-950"><ClipboardList className="h-5 w-5" />Liste de suivi</h2><span className="text-sm text-slate-500">Année {data?.schoolYear ?? "2026-2027"}</span></div>
      <div className="flex flex-wrap gap-2 p-4 sm:p-5">
        <label className="relative min-w-48 flex-1"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className="field pl-10" aria-label="Rechercher un élève ou une classe" value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher un élève ou une classe" /></label>
        <button onClick={() => setFilter("all")} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${filter === "all" ? "border-blue-400 bg-blue-50 text-blue-900" : "border-slate-200 text-slate-600"}`}>Tous</button>
      </div>
      <div className="divide-y divide-slate-100">
        {busy && !data && <p className="p-8 text-center text-sm text-slate-500">Chargement du suivi…</p>}
        {!busy && data && visible.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Aucun élève dans cette vue.</p>}
        {visible.map(item => <article key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0"><p className="font-semibold text-slate-950">{item.studentName}</p><p className="mt-1 text-sm text-slate-600">{item.className} · {item.status === "delivered" ? `Remis le ${dateTime(item.deliveredAt!)} · ${item.deliveredBy === user?.id ? "validé par vous" : "validé par un autre compte autorisé"}` : `Ajouté le ${dateTime(item.createdAt)}`}</p></div>
          <div className="flex flex-wrap gap-2">
            {item.status === "pending" ? <><button disabled={!!mutating} onClick={() => void change(item, "deliver")} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50"><Check className="h-4 w-4" />Marquer remis</button><button disabled={!!mutating} onClick={() => void change(item, "remove")} title="Retirer une ligne ajoutée par erreur" aria-label={`Retirer ${item.studentName}`} className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-3 text-slate-600 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button></> : <button disabled={!!mutating} onClick={() => void change(item, "reopen")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"><RotateCcw className="h-4 w-4" />Corriger</button>}
          </div>
        </article>)}
      </div>
    </section>
    <p className="text-xs text-slate-500">Accès réservé au superadministrateur avec double vérification. Chaque ajout, remise et correction est horodaté. Aucun numéro de série ni code d’accès n’est enregistré ici.</p>
  </div>;
}
