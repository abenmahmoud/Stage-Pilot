import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  LogOut,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useParams } from "react-router-dom";

type Outcome = "diagnosed" | "repaired" | "needs_followup" | "not_found" | "unavailable";
type PortalRequest = {
  publicCode: string;
  status: string;
  priority: string;
  equipment: Record<string, string | null>;
  latestUpdate: { outcome: Outcome; note: string | null; createdAt: string } | null;
};
type PortalPayload = {
  access: { label: string; expiresAt: string };
  visit: { provider: string; startsAt: string; endsAt: string; status: string; location: string | null; publicNote: string | null };
  requests: PortalRequest[];
};

const OUTCOMES: Array<{ value: Outcome; label: string }> = [
  { value: "diagnosed", label: "Diagnostic réalisé" },
  { value: "repaired", label: "Matériel réparé" },
  { value: "needs_followup", label: "Intervention complémentaire" },
  { value: "not_found", label: "Matériel non trouvé" },
  { value: "unavailable", label: "Intervention impossible" },
];

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...init, headers, credentials: "same-origin" });
  let payload: Record<string, unknown> = {};
  try { payload = await response.json() as Record<string, unknown>; } catch { /* response without JSON */ }
  if (!response.ok) {
    const error = new Error(typeof payload.error === "string" ? payload.error : "Le service est momentanément indisponible") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload as T;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

function IncidentCard({ grantId, request, onSaved }: { grantId: string; request: PortalRequest; onSaved: () => Promise<void> }) {
  const [outcome, setOutcome] = useState<Outcome>(request.latestUpdate?.outcome ?? "diagnosed");
  const [note, setNote] = useState(request.latestUpdate?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const equipment = request.equipment;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setMessage("");
    try {
      await jsonRequest(`/api/equipment/external/requests/${encodeURIComponent(request.publicCode)}`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ grantId, outcome, note }),
      });
      setMessage("Compte rendu enregistré. Le lycée peut maintenant le contrôler.");
      await onSaved();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Le compte rendu n’a pas pu être enregistré.");
    } finally { setSaving(false); }
  }

  return <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{request.publicCode}</span><h2 className="mt-3 text-xl font-bold text-slate-950">{equipment.equipmentType || "Matériel à diagnostiquer"}</h2></div>
        {equipment.safetyRisk === "yes" && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">À sécuriser</span>}
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <p className="rounded-xl bg-slate-50 p-3"><strong className="block text-xs uppercase tracking-wide text-slate-500">Lieu</strong>{equipment.roomCode || "À confirmer sur place"}</p>
        <p className="rounded-xl bg-slate-50 p-3"><strong className="block text-xs uppercase tracking-wide text-slate-500">Inventaire</strong>{equipment.inventoryNumber || "Non renseigné"}</p>
      </div>
      <div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-800"><strong className="block text-xs uppercase tracking-wide text-slate-500">Constat transmis</strong>{equipment.symptomSummary || "Constat à effectuer sur place."}</div>
      {equipment.availability && <p className="mt-3 text-sm text-slate-600"><Clock3 className="mr-1 inline h-4 w-4" />Disponibilité : {equipment.availability}</p>}
    </div>
    <form className="space-y-4 bg-slate-50/60 p-5 sm:p-6" onSubmit={submit}>
      <label className="block text-sm font-bold text-slate-800">Résultat de l’intervention<select className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base" value={outcome} onChange={event => setOutcome(event.target.value as Outcome)}>{OUTCOMES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="block text-sm font-bold text-slate-800">Compte rendu<textarea className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 bg-white p-4 text-base" maxLength={2000} value={note} onChange={event => setNote(event.target.value)} placeholder="Diagnostic, action réalisée, pièce à prévoir…" /></label>
      <button type="submit" disabled={saving} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 font-bold text-white disabled:opacity-60"><ClipboardCheck className="h-5 w-5" />{saving ? "Enregistrement…" : "Enregistrer le compte rendu"}</button>
      {message && <p role="status" className="text-sm font-medium text-slate-700">{message}</p>}
      {request.latestUpdate && <p className="flex items-center gap-2 text-xs text-emerald-800"><CheckCircle2 className="h-4 w-4" />Dernier compte rendu : {new Date(request.latestUpdate.createdAt).toLocaleString("fr-FR")}</p>}
    </form>
  </article>;
}

export default function EquipmentExternalPortalPage() {
  const { grantId = "" } = useParams();
  const [payload, setPayload] = useState<PortalPayload | null>(null);
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const data = await jsonRequest<PortalPayload>(`/api/equipment/external/portal?grantId=${encodeURIComponent(grantId)}`);
      setPayload(data); setNeedsCode(false);
    } catch (cause) {
      const typed = cause as Error & { status?: number };
      if (typed.status === 401) setNeedsCode(true);
      else setError(typed.message);
    } finally { setBusy(false); }
  }, [grantId]);

  useEffect(() => { void load(); }, [load]);
  const interventionCount = useMemo(() => payload?.requests.length ?? 0, [payload]);

  async function unlock(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await jsonRequest(`/api/equipment/external/access/${encodeURIComponent(grantId)}`, { method: "POST", body: JSON.stringify({ code }) });
      setCode(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Accès refusé"); setBusy(false); }
  }

  async function logout() {
    await jsonRequest("/api/equipment/external/logout", { method: "POST" });
    setPayload(null); setNeedsCode(true);
  }

  if (needsCode && !payload) return <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10">
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Wrench className="h-7 w-7" /></div>
      <p className="mt-6 text-sm font-bold uppercase tracking-widest text-blue-700">Lycée Blaise Cendrars</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-950">Espace intervention SPIE</h1>
      <p className="mt-3 leading-7 text-slate-600">Saisissez le code à 8 chiffres communiqué par le lycée. Cet accès est limité aux dossiers préparés pour votre passage.</p>
      <form className="mt-6 space-y-4" onSubmit={unlock}>
        <label className="block text-sm font-bold text-slate-800">Code d’accès<input autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" maxLength={8} className="mt-2 min-h-14 w-full rounded-xl border border-slate-300 px-4 text-center text-2xl font-bold tracking-[.3em]" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))} /></label>
        <button disabled={busy || code.length !== 8} className="min-h-12 w-full rounded-xl bg-blue-700 px-5 font-bold text-white disabled:opacity-50">{busy ? "Vérification…" : "Ouvrir les interventions"}</button>
      </form>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <p className="mt-6 flex gap-2 text-xs leading-5 text-slate-500"><ShieldCheck className="h-4 w-4 shrink-0" />Le portail ne présente ni l’identité ni les coordonnées des demandeurs.</p>
    </section>
  </main>;

  return <main className="min-h-screen bg-slate-100 pb-16">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-700 text-white"><Wrench className="h-6 w-6" /></span><div><strong className="block text-slate-950">Lycée Blaise Cendrars</strong><span className="text-sm text-slate-600">Interventions matériel · SPIE</span></div></div>{payload && <button type="button" onClick={() => void logout()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"><LogOut className="h-4 w-4" />Fermer l’accès</button>}</div></header>
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {busy && !payload && <p className="flex items-center gap-2 text-slate-600"><RefreshCw className="h-5 w-5 animate-spin" />Chargement des interventions…</p>}
      {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">{error}</div>}
      {payload && <>
        <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-lg sm:p-8"><p className="text-sm font-semibold text-blue-200">{payload.access.label}</p><h1 className="mt-2 text-3xl font-bold">{interventionCount} {interventionCount > 1 ? "interventions préparées" : "intervention préparée"}</h1><div className="mt-5 flex flex-wrap gap-4 text-sm text-slate-200"><span><CalendarDays className="mr-1 inline h-4 w-4" />{formatDate(payload.visit.startsAt)}</span>{payload.visit.location && <span><MapPin className="mr-1 inline h-4 w-4" />{payload.visit.location}</span>}</div>{payload.visit.publicNote && <p className="mt-5 rounded-xl bg-white/10 p-4 leading-6">{payload.visit.publicNote}</p>}</section>
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><ShieldCheck className="mr-2 inline h-5 w-5" /><strong>Accès limité et tracé.</strong> Les comptes rendus sont transmis au lycée pour contrôle avant clôture du dossier.</section>
        {payload.requests.length === 0 ? <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-600">Aucun dossier n’est encore affecté à ce passage. Contactez le lycée avant l’intervention.</section> : <div className="grid gap-6 lg:grid-cols-2">{payload.requests.map(request => <IncidentCard key={request.publicCode} grantId={grantId} request={request} onSaved={load} />)}</div>}
      </>}
    </div>
  </main>;
}
