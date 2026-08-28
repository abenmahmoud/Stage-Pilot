import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "../../lib/api";

type OperationsSummary = {
  failuresWaiting: number;
  jobSuccesses24h: number;
  jobFailures24h: number;
  webhookAlerts24h: number;
  deliveryAlerts24h: number;
  attachmentsWaiting: number;
  lastSuccessAt: string | null;
};

type FailedJob = {
  id: string;
  jobType: string;
  attempts: number;
  lastErrorCode: string | null;
  lastErrorSummary: string | null;
  failedAt: string;
  publicCode: string | null;
  subject: string | null;
};

type OperationsPayload = {
  generatedAt: string;
  summary: OperationsSummary;
  failures: FailedJob[];
};

const JOB_LABELS: Record<string, string> = {
  notify_requester_request_created: "Confirmation au demandeur",
  notify_agent_request_created: "Alerte de nouvelle demande",
  notify_agent_message_received: "Alerte de nouvelle réponse",
  send_requester_reply: "Réponse de l’agent au demandeur",
};

function dateLabel(value: string | null): string {
  if (!value) return "Aucun envoi récent";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function SupportOperationsPage() {
  const [payload, setPayload] = useState<OperationsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setPayload(await apiFetch<OperationsPayload>("support/agent/operations"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "État des demandes indisponible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function retry(job: FailedJob) {
    setRetryingId(job.id);
    setError("");
    setNotice("");
    try {
      await apiFetch(`support/agent/operations/${job.id}/retry`, { method: "POST" });
      setNotice(`La relance de ${job.publicCode ?? "cette opération"} a été remise dans la file.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Relance impossible.");
    } finally {
      setRetryingId(null);
    }
  }

  const summary = payload?.summary;
  const healthy = Boolean(summary && summary.failuresWaiting === 0 && summary.jobFailures24h === 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Exploitation</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Santé des demandes</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Vérifiez les envois, les réponses reçues et les fichiers qui nécessitent une intervention.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} title="Actualiser" aria-label="Actualiser" className="inline-flex h-10 w-10 items-center justify-center rounded-md border bg-white text-slate-600 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      {error ? <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

      {loading && !payload ? <div className="flex min-h-52 items-center justify-center"><LoaderCircle className="h-8 w-8 animate-spin text-emerald-700" /></div> : null}

      {summary ? (
        <>
          <section className={`flex items-start gap-3 border-l-4 p-4 ${healthy ? "border-emerald-600 bg-emerald-50" : "border-amber-600 bg-amber-50"}`}>
            {healthy ? <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-700" /> : <AlertTriangle className="h-6 w-6 shrink-0 text-amber-700" />}
            <div><strong className="text-slate-950">{healthy ? "Aucun blocage détecté" : "Une vérification est nécessaire"}</strong><p className="mt-1 text-sm text-slate-600">Dernier envoi réussi : {dateLabel(summary.lastSuccessAt)} · {summary.jobFailures24h} essai en échec sur 24 h</p></div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicateurs des dernières 24 heures">
            <div className="border-t-4 border-emerald-600 bg-white p-4 shadow-sm"><CheckCircle2 className="h-5 w-5 text-emerald-700" /><strong className="mt-3 block text-2xl text-slate-950">{summary.jobSuccesses24h}</strong><span className="text-sm text-slate-500">Envois réussis</span></div>
            <div className="border-t-4 border-red-600 bg-white p-4 shadow-sm"><AlertTriangle className="h-5 w-5 text-red-700" /><strong className="mt-3 block text-2xl text-slate-950">{summary.failuresWaiting}</strong><span className="text-sm text-slate-500">Échecs à traiter</span></div>
            <div className="border-t-4 border-amber-500 bg-white p-4 shadow-sm"><Clock3 className="h-5 w-5 text-amber-700" /><strong className="mt-3 block text-2xl text-slate-950">{summary.deliveryAlerts24h + summary.webhookAlerts24h}</strong><span className="text-sm text-slate-500">Alertes email</span></div>
            <div className="border-t-4 border-blue-600 bg-white p-4 shadow-sm"><Clock3 className="h-5 w-5 text-blue-700" /><strong className="mt-3 block text-2xl text-slate-950">{summary.attachmentsWaiting}</strong><span className="text-sm text-slate-500">Fichiers en attente</span></div>
          </section>

          <section className="space-y-3">
            <div><h2 className="text-lg font-bold text-slate-950">Opérations à reprendre</h2><p className="text-sm text-slate-500">Une relance crée un nouvel essai audité. Aucun ancien lien de connexion n’est réutilisé.</p></div>
            <div className="divide-y border-y border-slate-200 bg-white">
              {payload?.failures.map((job) => (
                <article key={job.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-center">
                  <div className="min-w-0"><strong className="block truncate text-slate-950">{job.publicCode ?? "Dossier supprimé"} · {job.subject ?? "Sans objet"}</strong><span className="mt-1 block text-sm text-slate-600">{JOB_LABELS[job.jobType] ?? "Opération technique"}</span><small className="mt-1 block text-slate-500">Échec après {job.attempts} essais · {dateLabel(job.failedAt)}</small></div>
                  <span className="text-sm font-medium text-red-700">{job.lastErrorSummary ?? "Envoi interrompu"}</span>
                  <button type="button" onClick={() => void retry(job)} disabled={retryingId !== null} className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {retryingId === job.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Relancer
                  </button>
                </article>
              ))}
              {payload?.failures.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">Aucune opération n’attend de relance.</p> : null}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
