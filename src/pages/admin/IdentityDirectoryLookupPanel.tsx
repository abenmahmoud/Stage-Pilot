import { useEffect, useState } from "react";
import { AlertTriangle, Clock3, LoaderCircle, Search, ShieldCheck, UserCheck } from "lucide-react";
import { apiFetch } from "../../lib/api";
import type { IdentityLookupResult } from "../../../shared/identity-directory-lookup";

type Availability = {
  available: boolean;
  configured: boolean;
  hasActiveDirectory: boolean;
  ttlSeconds: number;
};

type LookupStatus = "queued" | "processing" | "completed" | "not_found" | "ambiguous" | "failed" | "expired";

type LookupResponse = {
  requestId: string;
  status: LookupStatus;
  receipt?: string;
  expiresAt: string;
  result?: IdentityLookupResult;
};

const PERSON_TYPE = {
  student: "Élève",
  guardian: "Responsable",
  staff: "Personnel",
} as const;

export default function IdentityDirectoryLookupPanel() {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [searchType, setSearchType] = useState("academic_email");
  const [query, setQuery] = useState("");
  const [reasonCategory, setReasonCategory] = useState("support_case");
  const [justification, setJustification] = useState("");
  const [request, setRequest] = useState<LookupResponse | null>(null);
  const [receipt, setReceipt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch<Availability>("identity/admin/lookups")
      .then((value) => {
        if (active) setAvailability(value);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "État indisponible.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!request || !receipt || !["queued", "processing"].includes(request.status)) return;
    let cancelled = false;
    let timer = 0;
    const poll = async () => {
      try {
        const next = await apiFetch<LookupResponse>(`identity/admin/lookups/${request.requestId}`, {
          headers: { "X-Identity-Lookup-Receipt": receipt },
        });
        if (cancelled) return;
        setRequest(next);
        if (["queued", "processing"].includes(next.status)) {
          timer = window.setTimeout(poll, 1200);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Lecture du résultat impossible.");
          setRequest(null);
          setReceipt("");
        }
      }
    };
    timer = window.setTimeout(poll, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [receipt, request]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setRequest(null);
    setReceipt("");
    try {
      const next = await apiFetch<LookupResponse>("identity/admin/lookups", {
        method: "POST",
        body: JSON.stringify({ searchType, query, reasonCategory, justification }),
      });
      if (!next.receipt) throw new Error("Le reçu sécurisé est absent.");
      setReceipt(next.receipt);
      setRequest(next);
      setQuery("");
      setJustification("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La recherche a échoué.");
    } finally {
      setBusy(false);
    }
  }

  const unavailableMessage = availability && !availability.available
    ? !availability.configured
      ? "Le canal chiffré doit encore être activé sur cet environnement."
      : "Aucune version contrôlée du répertoire n’est active."
    : "";

  return (
    <section className="border-y border-slate-200 bg-white p-4 sm:p-6" aria-labelledby="identity-lookup-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Consultation agent</p>
          <h2 id="identity-lookup-title" className="mt-1 text-lg font-bold text-slate-950">
            Retrouver une personne
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Recherche exacte, temporaire et journalisée. Le résultat ne contient que les informations nécessaires.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          <ShieldCheck className="h-4 w-4" /> MFA obligatoire
        </span>
      </div>

      {unavailableMessage ? (
        <p className="mt-4 flex items-start gap-2 border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {unavailableMessage}
        </p>
      ) : null}
      {error ? <p role="alert" className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Rechercher avec
          <select className="field mt-1 bg-white" value={searchType} onChange={(event) => setSearchType(event.target.value)} disabled={busy}>
            <option value="academic_email">Email académique exact</option>
            <option value="personal_email">Email personnel exact</option>
            <option value="phone">Téléphone exact</option>
            <option value="person_ref">Référence interne exacte</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Valeur exacte
          <input
            className="field mt-1 bg-white"
            type={searchType.includes("email") ? "email" : "text"}
            autoComplete="off"
            required
            minLength={3}
            maxLength={254}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={busy}
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Motif
          <select className="field mt-1 bg-white" value={reasonCategory} onChange={(event) => setReasonCategory(event.target.value)} disabled={busy}>
            <option value="support_case">Dossier d’assistance</option>
            <option value="identity_verification">Vérification d’identité</option>
            <option value="contact_correction">Correction d’une coordonnée</option>
            <option value="other">Autre motif professionnel</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700 md:row-span-2">
          Justification
          <textarea
            className="field mt-1 min-h-28 bg-white"
            required
            minLength={20}
            maxLength={500}
            placeholder="Indiquez le dossier concerné et la raison précise de la consultation."
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            disabled={busy}
          />
          <span className="mt-1 block text-xs text-slate-500">20 à 500 caractères · jamais de mot de passe ni de code d’accès</span>
        </label>
        <div>
          <button
            type="submit"
            disabled={busy || !availability?.available}
            className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Lancer la consultation
          </button>
        </div>
      </form>

      {request && ["queued", "processing"].includes(request.status) ? (
        <p role="status" className="mt-5 flex items-center gap-2 bg-slate-50 p-4 text-sm text-slate-700">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Vérification sécurisée en cours…
        </p>
      ) : null}
      {request?.status === "completed" && request.result ? (
        <article className="mt-5 border-l-4 border-emerald-600 bg-emerald-50 p-4" aria-live="polite">
          <div className="flex items-start gap-3">
            <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-800" />
            <div className="min-w-0">
              <p className="font-bold text-slate-950">{request.result.firstName} {request.result.lastName}</p>
              <p className="mt-1 text-sm text-slate-700">
                {PERSON_TYPE[request.result.personType]}
                {request.result.classRef ? ` · Classe ${request.result.classRef}` : ""}
                {request.result.serviceCode ? ` · Service ${request.result.serviceCode}` : ""}
              </p>
              <p className="mt-2 break-all text-xs text-slate-500">Référence : {request.result.personRef}</p>
            </div>
          </div>
        </article>
      ) : null}
      {request?.status === "not_found" ? (
        <p role="status" className="mt-5 bg-slate-50 p-4 text-sm text-slate-700">Aucune personne ne correspond exactement dans la version active.</p>
      ) : null}
      {request?.status === "ambiguous" ? (
        <p role="alert" className="mt-5 bg-amber-50 p-4 text-sm text-amber-950">Plusieurs fiches correspondent. Aucun détail n’est affiché ; vérifiez la donnée ou faites contrôler le répertoire.</p>
      ) : null}
      {request && ["failed", "expired"].includes(request.status) ? (
        <p role="alert" className="mt-5 flex items-start gap-2 bg-red-50 p-4 text-sm text-red-800">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0" /> Cette consultation n’est plus disponible. Relancez-la si elle reste nécessaire.
        </p>
      ) : null}
    </section>
  );
}
