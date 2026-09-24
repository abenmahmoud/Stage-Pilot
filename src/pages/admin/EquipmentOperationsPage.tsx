import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Copy,
  Clock3,
  ExternalLink,
  MapPin,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
  TicketCheck,
  UserRoundCog,
  Wrench,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import {
  EQUIPMENT_IMPACT_LABELS,
  EQUIPMENT_TYPE_LABELS,
  type EquipmentImpact,
  type EquipmentType,
  type EquipmentVisitStatus,
} from "../../../shared/equipment-support";

type Visit = {
  id: string;
  provider: string;
  startsAt: string;
  endsAt: string;
  status: EquipmentVisitStatus;
  location: string | null;
  publicNote: string | null;
  internalNote: string | null;
  createdAt: string;
  updatedAt: string;
};

type Incident = {
  publicCode: string;
  requesterFirstName: string;
  requesterLastName: string;
  subjectContext: Record<string, string>;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
};

type QueuePayload = { requests: Incident[]; pagination: { total: number } };
type VisitPayload = { visits: Visit[] };
type Assignment = { visitId: string; publicCode: string };
type ExternalGrant = { id: string; visitId: string; label: string; expiresAt: string; lockedAt: string | null; revokedAt: string | null; lastUsedAt: string | null; createdAt: string };
type AccessResult = { grant: ExternalGrant; code: string; linkPath: string };

const STATUS_LABELS: Record<EquipmentVisitStatus, string> = {
  draft: "Brouillon",
  confirmed: "Publié",
  completed: "Terminé",
  cancelled: "Annulé",
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  nouveau: "Nouveau",
  a_qualifier: "À qualifier",
  assigne: "Assigné",
  en_cours: "En cours",
  attente_demandeur: "Réponse attendue",
  attente_interne: "En attente d’intervention",
  resolu: "Résolu",
  clos: "Clos",
  indesirable: "Classé",
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("fr-FR", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function localDateTime(value: string): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function EquipmentOperationsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Visit | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [publicNote, setPublicNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [publishNow, setPublishNow] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [grants, setGrants] = useState<ExternalGrant[]>([]);
  const [selectedVisitId, setSelectedVisitId] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [accessLabel, setAccessLabel] = useState("Intervenant SPIE");
  const [accessExpiry, setAccessExpiry] = useState("");
  const [accessResult, setAccessResult] = useState<AccessResult | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [visitPayload, queuePayload, assignmentPayload, grantPayload] = await Promise.all([
        apiFetch<VisitPayload>("equipment/admin/visits"),
        apiFetch<QueuePayload>("support/agent/requests?scope=equipment&state=open&service=referent_numerique&pageSize=50"),
        apiFetch<{ assignments: Assignment[] }>("equipment/admin/visit-requests"),
        apiFetch<{ grants: ExternalGrant[] }>("equipment/admin/external-access"),
      ]);
      setVisits(visitPayload.visits);
      setIncidents(queuePayload.requests.filter(request => request.subjectContext?.equipmentReportVersion === "1"));
      setTotal(queuePayload.pagination.total);
      setAssignments(assignmentPayload.assignments);
      setGrants(grantPayload.grants);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L’espace matériel ne peut pas être chargé.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selectedVisitId && visits.length) {
      const preferred = visits.find(visit => !["completed", "cancelled"].includes(visit.status)) ?? visits[0];
      setSelectedVisitId(preferred.id);
    }
  }, [selectedVisitId, visits]);

  useEffect(() => {
    if (!selectedVisitId) return;
    setSelectedCodes(new Set(assignments.filter(item => item.visitId === selectedVisitId).map(item => item.publicCode)));
    const visit = visits.find(item => item.id === selectedVisitId);
    if (visit) {
      const expiry = new Date(Math.max(Date.parse(visit.endsAt) + 24 * 60 * 60_000, Date.now() + 60 * 60_000));
      setAccessExpiry(localDateTime(expiry.toISOString()));
    }
    setAccessResult(null);
  }, [assignments, selectedVisitId, visits]);

  const openIncidents = useMemo(() => incidents.filter(item => !["resolu", "clos", "indesirable"].includes(item.status)), [incidents]);
  const riskCount = openIncidents.filter(item => item.subjectContext.safetyRisk === "yes").length;
  const nextPublished = visits.find(visit => visit.status === "confirmed" && Date.parse(visit.endsAt) >= Date.now()) ?? null;

  function resetForm() {
    setEditing(null); setStartsAt(""); setEndsAt(""); setLocation(""); setPublicNote(""); setInternalNote(""); setPublishNow(false);
  }

  function editVisit(visit: Visit) {
    setEditing(visit);
    setStartsAt(localDateTime(visit.startsAt));
    setEndsAt(localDateTime(visit.endsAt));
    setLocation(visit.location ?? "");
    setPublicNote(visit.publicNote ?? "");
    setInternalNote(visit.internalNote ?? "");
    setPublishNow(visit.status === "confirmed");
    document.getElementById("spie-visit-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveVisit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const body = {
        ...(editing ? { id: editing.id, expectedUpdatedAt: editing.updatedAt } : {}),
        provider: "SPIE",
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        status: publishNow ? "confirmed" : editing?.status === "completed" ? "completed" : "draft",
        location,
        publicNote,
        internalNote,
      };
      await apiFetch("equipment/admin/visits", { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) });
      setNotice(publishNow ? "Le passage SPIE est publié sur l’espace des professeurs." : "Le passage est enregistré en brouillon.");
      resetForm();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le passage n’a pas pu être enregistré.");
    } finally { setSaving(false); }
  }

  async function changeStatus(visit: Visit, status: EquipmentVisitStatus) {
    setSaving(true); setError(""); setNotice("");
    try {
      await apiFetch("equipment/admin/visits", {
        method: "PATCH",
        body: JSON.stringify({ id: visit.id, expectedUpdatedAt: visit.updatedAt, status }),
      });
      setNotice(status === "confirmed" ? "Le créneau est maintenant visible par les professeurs." : status === "completed" ? "Le passage est marqué terminé." : "Le passage est annulé et retiré de l’espace public.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La modification n’a pas pu être enregistrée.");
    } finally { setSaving(false); }
  }

  function toggleIncident(code: string) {
    setSelectedCodes(current => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
    setAccessResult(null);
  }

  async function saveAssignments() {
    if (!selectedVisitId) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await apiFetch("equipment/admin/visit-requests", { method: "PUT", body: JSON.stringify({ visitId: selectedVisitId, publicCodes: [...selectedCodes] }) });
      setNotice(`${selectedCodes.size} dossier${selectedCodes.size > 1 ? "s" : ""} préparé${selectedCodes.size > 1 ? "s" : ""} pour ce passage.`);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "L’affectation n’a pas pu être enregistrée."); }
    finally { setSaving(false); }
  }

  async function createExternalAccess() {
    if (!selectedVisitId || !accessExpiry) return;
    setSaving(true); setError(""); setNotice(""); setAccessResult(null);
    try {
      await apiFetch("equipment/admin/visit-requests", { method: "PUT", body: JSON.stringify({ visitId: selectedVisitId, publicCodes: [...selectedCodes] }) });
      const result = await apiFetch<AccessResult>("equipment/admin/external-access", { method: "POST", body: JSON.stringify({ visitId: selectedVisitId, label: accessLabel, expiresAt: new Date(accessExpiry).toISOString() }) });
      setAccessResult(result);
      setNotice("L’accès SPIE est prêt. Le code n’est affiché qu’une seule fois : copiez-le maintenant.");
      await load();
      setAccessResult(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "L’accès SPIE n’a pas pu être créé."); }
    finally { setSaving(false); }
  }

  async function revokeGrant(id: string) {
    setSaving(true); setError("");
    try {
      await apiFetch("equipment/admin/external-access", { method: "PATCH", body: JSON.stringify({ id }) });
      setNotice("L’accès SPIE a été désactivé immédiatement.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "L’accès n’a pas pu être désactivé."); }
    finally { setSaving(false); }
  }

  async function copyValue(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setNotice(`${label} copié.`);
  }

  return <div className="mx-auto max-w-7xl space-y-6 pb-14">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700"><Wrench className="h-4 w-4" />Coordination numérique</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Matériel &amp; passages SPIE</h1>
        <p className="mt-2 max-w-3xl text-slate-600">Qualifiez les signalements, préparez la liste d’intervention et publiez uniquement les dates confirmées du technicien.</p>
      </div>
      <div className="flex flex-wrap gap-2"><Link to="/materiel" target="_blank" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800">Voir l’espace professeur <ExternalLink className="h-4 w-4" /></Link><button type="button" onClick={() => void load()} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />Actualiser</button></div>
    </header>

    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">{notice}</div>}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-2xl border border-slate-200 bg-white p-5"><TicketCheck className="h-5 w-5 text-blue-700" /><strong className="mt-4 block text-3xl text-slate-950">{openIncidents.length}</strong><span className="text-sm text-slate-600">incidents structurés ouverts</span></article>
      <article className={`rounded-2xl border p-5 ${riskCount ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}><AlertTriangle className={`h-5 w-5 ${riskCount ? "text-amber-700" : "text-slate-500"}`} /><strong className="mt-4 block text-3xl text-slate-950">{riskCount}</strong><span className="text-sm text-slate-600">risque matériel signalé</span></article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5"><CalendarDays className="h-5 w-5 text-emerald-700" /><strong className="mt-4 block text-lg text-slate-950">{nextPublished ? formatDateTime(nextPublished.startsAt) : "À confirmer"}</strong><span className="text-sm text-slate-600">prochain passage publié</span></article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5"><ShieldCheck className="h-5 w-5 text-violet-700" /><strong className="mt-4 block text-3xl text-slate-950">{total}</strong><span className="text-sm text-slate-600">demandes matériel dans la file numérique</span></article>
    </section>

    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950">
      <p className="font-bold">Votre rôle reste la coordination.</p><p className="mt-1">Vous vérifiez la salle, l’impact et les essais déjà réalisés, puis vous préparez les dossiers pour le prestataire. Le diagnostic, l’ouverture du matériel et la réparation relèvent du technicien habilité.</p>
    </section>

    <section className="overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-violet-100 bg-violet-50 p-5 sm:p-6"><div><p className="flex items-center gap-2 text-sm font-bold text-violet-700"><UserRoundCog className="h-4 w-4" />Accès intervenant</p><h2 className="mt-1 text-2xl font-bold text-slate-950">Préparer le passage SPIE</h2><p className="mt-1 max-w-3xl text-sm text-slate-600">Sélectionnez le passage et les seuls dossiers visibles par le technicien. Le lien et le code expirent automatiquement et peuvent être désactivés.</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-violet-700">Aucune identité transmise</span></div>
      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[.8fr_1.2fr]">
        <div className="space-y-4">
          <label className="block text-sm font-bold text-slate-800">Passage<select className="field mt-2" value={selectedVisitId} onChange={event => setSelectedVisitId(event.target.value)}><option value="">Choisir un passage</option>{visits.filter(visit => visit.status !== "cancelled").map(visit => <option key={visit.id} value={visit.id}>{formatDateTime(visit.startsAt)} · {STATUS_LABELS[visit.status]}</option>)}</select></label>
          <label className="block text-sm font-bold text-slate-800">Nom affiché<input className="field mt-2" value={accessLabel} onChange={event => setAccessLabel(event.target.value)} maxLength={120} /></label>
          <label className="block text-sm font-bold text-slate-800">Expiration de l’accès<input type="datetime-local" className="field mt-2" value={accessExpiry} onChange={event => setAccessExpiry(event.target.value)} /></label>
          <button type="button" disabled={saving || !selectedVisitId || selectedCodes.size === 0} onClick={() => void createExternalAccess()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-bold text-white disabled:opacity-50"><KeyRound className="h-5 w-5" />Créer le lien et le code</button>
          <p className="text-xs leading-5 text-slate-500">La création d’un nouvel accès désactive l’ancien accès encore actif pour ce passage.</p>
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-950">Dossiers confiés</h3><p className="text-sm text-slate-600">{selectedCodes.size} sélectionné{selectedCodes.size > 1 ? "s" : ""}</p></div><button type="button" disabled={saving || !selectedVisitId} onClick={() => void saveAssignments()} className="min-h-10 rounded-xl border border-violet-200 px-4 text-sm font-bold text-violet-800 disabled:opacity-50">Enregistrer la sélection</button></div>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-2">
            {openIncidents.length === 0 && <p className="p-4 text-sm text-slate-500">Aucun incident matériel ouvert.</p>}
            {openIncidents.map(incident => <label key={incident.publicCode} className="flex cursor-pointer items-start gap-3 rounded-xl p-3 hover:bg-slate-50"><input type="checkbox" className="mt-1 h-5 w-5" checked={selectedCodes.has(incident.publicCode)} onChange={() => toggleIncident(incident.publicCode)} /><span className="min-w-0"><strong className="block text-sm text-slate-950">{incident.publicCode} · {incident.subjectContext.roomCode || "Lieu à préciser"}</strong><span className="line-clamp-2 text-xs leading-5 text-slate-600">{incident.subjectContext.symptomSummary || incident.subject}</span></span></label>)}
          </div>
        </div>
      </div>
      {accessResult && <div className="border-t border-emerald-200 bg-emerald-50 p-5 sm:p-6"><p className="flex items-center gap-2 font-bold text-emerald-950"><CheckCircle2 className="h-5 w-5" />Accès prêt à transmettre à SPIE</p><p className="mt-1 text-sm text-emerald-900">Copiez séparément le lien et le code. Le code ne sera plus consultable après avoir quitté cette page.</p><div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"><div className="overflow-hidden rounded-xl border border-emerald-200 bg-white p-3 text-sm font-medium text-slate-800">{window.location.origin}{accessResult.linkPath}</div><button type="button" onClick={() => void copyValue(`${window.location.origin}${accessResult.linkPath}`, "Lien")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-bold text-emerald-900"><Copy className="h-4 w-4" />Copier le lien</button><div className="rounded-xl border border-emerald-200 bg-white p-3 text-center text-2xl font-bold tracking-[.25em] text-slate-950">{accessResult.code}</div><button type="button" onClick={() => void copyValue(accessResult.code, "Code")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-bold text-emerald-900"><Copy className="h-4 w-4" />Copier le code</button></div></div>}
      {grants.some(grant => grant.visitId === selectedVisitId) && <div className="border-t border-slate-100 p-5 sm:p-6"><h3 className="font-bold text-slate-950">Historique des accès de ce passage</h3><div className="mt-3 space-y-2">{grants.filter(grant => grant.visitId === selectedVisitId).map(grant => { const active = !grant.revokedAt && !grant.lockedAt && Date.parse(grant.expiresAt) > Date.now(); return <div key={grant.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm"><span><strong className="block text-slate-900">{grant.label}</strong><span className="text-xs text-slate-500">Expire le {new Date(grant.expiresAt).toLocaleString("fr-FR")} · {active ? "actif" : grant.lockedAt ? "verrouillé" : "inactif"}</span></span>{active && <button type="button" disabled={saving} onClick={() => void revokeGrant(grant.id)} className="min-h-10 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700">Désactiver</button>}</div>; })}</div></div>}
    </section>

    <div className="grid items-start gap-6 xl:grid-cols-[1.35fr_.8fr]">
      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="text-xl font-bold text-slate-950">Incidents à préparer</h2><p className="mt-1 text-sm text-slate-600">Les réponses, pièces jointes, affectations et statuts restent dans la file unique des demandes.</p></div><Link to="/gestion/demandes?service=referent_numerique&scope=equipment" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white">Traiter les signalements <ExternalLink className="h-4 w-4" /></Link></div>
        <div className="divide-y divide-slate-100">
          {busy && incidents.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Chargement…</p>}
          {!busy && openIncidents.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Aucun signalement matériel structuré en attente.</p>}
          {openIncidents.slice(0, 12).map(incident => {
            const type = incident.subjectContext.equipmentType as EquipmentType;
            const impact = incident.subjectContext.impact as EquipmentImpact;
            return <article key={incident.publicCode} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{REQUEST_STATUS_LABELS[incident.status] ?? incident.status}</span>{incident.subjectContext.safetyRisk === "yes" && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">À sécuriser</span>}</div><h3 className="mt-3 text-lg font-bold text-slate-950">{EQUIPMENT_TYPE_LABELS[type] ?? incident.subject}</h3><p className="mt-1 text-sm text-slate-600"><MapPin className="mr-1 inline h-4 w-4" />{incident.subjectContext.roomCode || "Lieu à préciser"} · {incident.requesterFirstName} {incident.requesterLastName}</p></div><div className="text-right text-xs text-slate-500"><strong className="block text-sm text-slate-800">{incident.publicCode}</strong>{new Date(incident.createdAt).toLocaleDateString("fr-FR")}</div></div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{incident.subjectContext.symptomSummary || "Constat à préciser dans le dossier."}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-700">{EQUIPMENT_IMPACT_LABELS[impact] ?? "Impact à qualifier"}</span>{incident.subjectContext.inventoryNumber && <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-700">Inventaire {incident.subjectContext.inventoryNumber}</span>}{incident.subjectContext.availability && <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-700">{incident.subjectContext.availability}</span>}</div>
              <p className="mt-4 text-xs font-medium text-blue-700">Recherchez {incident.publicCode} dans la file numérique pour répondre, joindre un document ou modifier le statut.</p>
            </article>;
          })}
        </div>
      </section>

      <div className="space-y-6">
        <section id="spie-visit-form" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Plus className="h-5 w-5" /></span><div><h2 className="text-xl font-bold text-slate-950">{editing ? "Modifier le passage" : "Ajouter un passage SPIE"}</h2><p className="text-sm text-slate-600">Seuls les créneaux publiés sont visibles.</p></div></div>
          <form className="mt-5 space-y-4" onSubmit={saveVisit}>
            <label className="block text-sm font-semibold text-slate-700">Début<input type="datetime-local" className="field mt-1" value={startsAt} onChange={event => setStartsAt(event.target.value)} required /></label>
            <label className="block text-sm font-semibold text-slate-700">Fin<input type="datetime-local" className="field mt-1" value={endsAt} onChange={event => setEndsAt(event.target.value)} required /></label>
            <label className="block text-sm font-semibold text-slate-700">Lieu public<input className="field mt-1" value={location} onChange={event => setLocation(event.target.value)} maxLength={120} placeholder="Ex. accueil ou bâtiment B" /></label>
            <label className="block text-sm font-semibold text-slate-700">Information pour les professeurs<textarea className="field mt-1 min-h-24" value={publicNote} onChange={event => setPublicNote(event.target.value)} maxLength={300} placeholder="Consigne utile, sans donnée personnelle" /></label>
            <label className="block text-sm font-semibold text-slate-700">Note interne<textarea className="field mt-1 min-h-24" value={internalNote} onChange={event => setInternalNote(event.target.value)} maxLength={1000} placeholder="Contact, préparation ou consigne non publique" /></label>
            <label className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><input type="checkbox" className="mt-0.5 h-5 w-5" checked={publishNow} onChange={event => setPublishNow(event.target.checked)} /><span><strong className="block">Publier ce créneau</strong>Il apparaîtra immédiatement dans l’espace professeur.</span></label>
            <div className="flex flex-wrap gap-2"><button type="submit" disabled={saving} className="min-h-11 flex-1 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">{saving ? "Enregistrement…" : editing ? "Enregistrer les modifications" : "Ajouter le passage"}</button>{editing && <button type="button" onClick={resetForm} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700">Annuler</button>}</div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5"><h2 className="text-xl font-bold text-slate-950">Calendrier SPIE</h2><p className="mt-1 text-sm text-slate-600">Brouillons, publications et historique récent.</p></div>
          <div className="divide-y divide-slate-100">
            {!busy && visits.length === 0 && <p className="p-6 text-sm text-slate-500">Aucun passage enregistré.</p>}
            {visits.map(visit => <article key={visit.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${visit.status === "confirmed" ? "bg-emerald-100 text-emerald-800" : visit.status === "cancelled" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}>{STATUS_LABELS[visit.status]}</span><h3 className="mt-3 font-bold text-slate-950">{formatDateTime(visit.startsAt)}</h3><p className="mt-1 text-sm text-slate-600">jusqu’à {new Date(visit.endsAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}{visit.location ? ` · ${visit.location}` : ""}</p></div><Clock3 className="h-5 w-5 text-slate-400" /></div>{visit.publicNote && <p className="mt-3 text-sm text-slate-700">{visit.publicNote}</p>}<div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => editVisit(visit)} className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700">Modifier</button>{visit.status === "draft" && <button type="button" disabled={saving} onClick={() => void changeStatus(visit, "confirmed")} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white"><CheckCircle2 className="h-4 w-4" />Publier</button>}{visit.status === "confirmed" && <><button type="button" disabled={saving} onClick={() => void changeStatus(visit, "completed")} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white"><CheckCircle2 className="h-4 w-4" />Terminé</button><button type="button" disabled={saving} onClick={() => void changeStatus(visit, "cancelled")} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700"><XCircle className="h-4 w-4" />Annuler</button></>}</div></article>)}
          </div>
        </section>
      </div>
    </div>
  </div>;
}
