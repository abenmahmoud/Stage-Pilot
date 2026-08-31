import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Timer,
  Trash2,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { verifySupportJobRetryConfirmation } from "../../../shared/support-operation-confirmation";
import { isSupportRetryableJobType } from "../../../shared/support-job-retry";
import {
  parseAgentMetricsPayload,
  parseSupportOperationsPayload,
  type AgentMetricsPayload,
  type SupportOperationsPayload,
} from "../../../shared/support-operations-payload";

type FailedJob = SupportOperationsPayload["failures"][number];

const JOB_LABELS: Record<string, string> = {
  notify_requester_request_created: "Confirmation au demandeur",
  notify_agent_request_created: "Alerte de nouvelle demande",
  notify_agent_message_received: "Alerte de nouvelle réponse",
  send_requester_reply: "Réponse de l’agent au demandeur",
  scan_attachment: "Contrôle antivirus d’un document",
  import_brevo_attachment: "Contrôle antivirus d’une pièce reçue",
};

const OUTCOME_LABELS: Record<string, string> = {
  deterministic: "Réponse de sécurité",
  pretriage: "Prédiagnostic ordinateur",
  model_unavailable: "IA non configurée",
  provider_error: "Service IA indisponible",
  invalid_output: "Réponse IA invalide",
  policy_fallback: "Réponse bloquée par les règles",
  low_confidence: "Confiance insuffisante",
  category_conflict: "Classement contradictoire",
  model_success: "Réponse IA retenue par les règles",
  timeout: "Délai IA dépassé",
};

const CATEGORY_LABELS: Record<string, string> = {
  inscription: "Inscription",
  affectation_classe: "Classe ou affectation",
  documents_scolarite: "Documents de scolarité",
  ent: "Accès ENT",
  email_academique: "Messagerie académique",
  ordinateur: "Ordinateur",
  logiciel: "Logiciel",
  restauration_bourse: "Restauration ou bourse",
  orientation_formation: "Orientation ou formation",
  vie_scolaire: "Vie scolaire",
  autre: "Autre demande",
};

function compactNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function euroFromMicros(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: value >= 1_000_000 ? 2 : 4,
    maximumFractionDigits: value >= 1_000_000 ? 2 : 4,
  }).format(value / 1_000_000);
}

function dateLabel(value: string | null): string {
  if (!value) return "Aucun envoi récent";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function durationLabel(hours: number): string {
  if (hours < 1) return "Moins d’une heure";
  if (hours < 24) return `${hours.toLocaleString("fr-FR")} h`;
  return `${(hours / 24).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} j`;
}

export default function SupportOperationsPage() {
  const [payload, setPayload] = useState<SupportOperationsPayload | null>(null);
  const [agentMetrics, setAgentMetrics] = useState<AgentMetricsPayload | null>(null);
  const [metricsDays, setMetricsDays] = useState<7 | 30>(7);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [metricsError, setMetricsError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    setMetricsError("");
    try {
      const [operations, metrics] = await Promise.allSettled([
        apiFetch<unknown>("support/agent/operations"),
        apiFetch<unknown>(`support/agent/metrics?days=${metricsDays}`),
      ]);
      if (operations.status === "rejected") throw operations.reason;
      const operationsPayload = parseSupportOperationsPayload(operations.value);
      if (!operationsPayload) {
        throw new Error("La réponse de santé est invalide. Aucune donnée n'a été affichée.");
      }
      setPayload(operationsPayload);
      if (metrics.status === "fulfilled") {
        const metricsPayload = parseAgentMetricsPayload(metrics.value);
        if (!metricsPayload || metricsPayload.days !== metricsDays) {
          setAgentMetrics(null);
          setMetricsError("Les mesures de l’assistant sont invalides ou ne correspondent pas à la période demandée.");
        } else {
          setAgentMetrics(metricsPayload);
        }
      } else {
        setAgentMetrics(null);
        setMetricsError("Les mesures de l’assistant sont momentanément indisponibles.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "État des demandes indisponible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [metricsDays]);

  async function retry(job: FailedJob) {
    if (!isSupportRetryableJobType(job.jobType)) {
      setError("Cette opération nécessite une intervention manuelle et ne peut pas être relancée ici.");
      return;
    }
    setRetryingId(job.id);
    setError("");
    setNotice("");
    try {
      const result = await apiFetch<unknown>(`support/agent/operations/${job.id}/retry`, { method: "POST" });
      const confirmation = verifySupportJobRetryConfirmation({
        expectedFailedJobId: job.id,
        confirmation: result,
      });
      if (!confirmation) {
        throw new Error("La relance n'a pas été confirmée par le serveur. Actualisez avant de réessayer.");
      }
      setNotice(`La relance de ${job.publicCode ?? "cette opération"} a été remise dans la file.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Relance impossible.");
    } finally {
      setRetryingId(null);
    }
  }

  const summary = payload?.summary;
  const healthy = Boolean(
    summary
    && summary.failuresWaiting === 0
    && summary.jobFailures24h === 0
    && summary.attachmentRemovalsWaiting === 0
  );

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

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicateurs de santé des demandes">
            <div className="border-t-4 border-emerald-600 bg-white p-4 shadow-sm"><CheckCircle2 className="h-5 w-5 text-emerald-700" /><strong className="mt-3 block text-2xl text-slate-950">{summary.jobSuccesses24h}</strong><span className="text-sm text-slate-500">Envois réussis</span></div>
            <div className="border-t-4 border-red-600 bg-white p-4 shadow-sm"><AlertTriangle className="h-5 w-5 text-red-700" /><strong className="mt-3 block text-2xl text-slate-950">{summary.failuresWaiting}</strong><span className="text-sm text-slate-500">Échecs à traiter</span></div>
            <div className="border-t-4 border-amber-500 bg-white p-4 shadow-sm"><Clock3 className="h-5 w-5 text-amber-700" /><strong className="mt-3 block text-2xl text-slate-950">{summary.deliveryAlerts24h + summary.webhookAlerts24h}</strong><span className="text-sm text-slate-500">Alertes email</span></div>
            <div className="border-t-4 border-blue-600 bg-white p-4 shadow-sm"><Clock3 className="h-5 w-5 text-blue-700" /><strong className="mt-3 block text-2xl text-slate-950">{summary.attachmentsWaiting}</strong><span className="text-sm text-slate-500">Fichiers en attente</span></div>
            <div className="border-t-4 border-rose-600 bg-white p-4 shadow-sm"><Trash2 className="h-5 w-5 text-rose-700" /><strong className="mt-3 block text-2xl text-slate-950">{summary.attachmentRemovalsWaiting}</strong><span className="text-sm text-slate-500">Retraits à reprendre</span></div>
          </section>

          <section className="grid gap-5 border-y border-slate-200 py-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]" aria-labelledby="request-activity-title">
            <div className="space-y-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-blue-700"><BarChart3 className="h-4 w-4" /> Activité sur 30 jours</p>
                <h2 id="request-activity-title" className="mt-1 text-lg font-bold text-slate-950">Résolution des demandes</h2>
                <p className="mt-1 text-sm text-slate-500">Indicateurs agrégés, sans identité ni contenu de dossier.</p>
              </div>
              <div className="grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-4">
                <div className="bg-white px-4 py-3"><span className="text-xs font-semibold uppercase text-slate-500">Reçues</span><strong className="mt-1 block text-xl text-slate-950">{payload.activity30d.created}</strong></div>
                <div className="bg-white px-4 py-3"><span className="text-xs font-semibold uppercase text-slate-500">Résolues</span><strong className="mt-1 block text-xl text-slate-950">{payload.activity30d.resolved}</strong></div>
                <div className="bg-white px-4 py-3"><span className="text-xs font-semibold uppercase text-slate-500">Taux</span><strong className="mt-1 block text-xl text-slate-950">{payload.activity30d.resolutionRate.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</strong></div>
                <div className="bg-white px-4 py-3"><span className="text-xs font-semibold uppercase text-slate-500">Encore ouvertes</span><strong className="mt-1 block text-xl text-slate-950">{payload.activity30d.openBacklog}</strong></div>
              </div>
              <div className="flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:gap-6">
                <span className="inline-flex items-center gap-2"><Timer className="h-4 w-4 text-slate-500" /> Délai moyen : <strong className="text-slate-950">{payload.activity30d.resolved > 0 ? durationLabel(payload.activity30d.averageResolutionHours) : "Aucune résolution"}</strong></span>
                <span>90 % résolues en moins de <strong className="text-slate-950">{payload.activity30d.resolved > 0 ? durationLabel(payload.activity30d.p90ResolutionHours) : "Aucune résolution"}</strong></span>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-bold text-slate-950">Demandes les plus fréquentes</h3>
              <div className="divide-y border-y border-slate-200 bg-white">
                {payload.activity30d.categories.map((item) => <div key={item.category} className="flex items-center justify-between gap-3 px-3 py-2.5"><span className="text-sm text-slate-600">{CATEGORY_LABELS[item.category] ?? "Autre demande"}</span><strong className="text-sm text-slate-950">{item.count}</strong></div>)}
                {payload.activity30d.categories.length === 0 ? <p className="px-3 py-8 text-center text-sm text-slate-500">Aucune demande sur cette période</p> : null}
              </div>
            </div>
          </section>

          {agentMetrics ? (
            <section className="space-y-4 border-y border-slate-200 py-5" aria-labelledby="agent-runtime-title">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><BrainCircuit className="h-4 w-4" /> Assistant du lycée</p>
                  <h2 id="agent-runtime-title" className="mt-1 text-lg font-bold text-slate-950">Mesures de fonctionnement</h2>
                  <p className="mt-1 text-sm text-slate-500">Statistiques techniques sans conversation, identité ni coordonnées.</p>
                </div>
                <div className="inline-flex w-fit rounded-md border border-slate-200 bg-white p-1" aria-label="Période des mesures">
                  {([7, 30] as const).map((days) => <button key={days} type="button" onClick={() => setMetricsDays(days)} aria-pressed={metricsDays === days} className={`min-w-20 rounded px-3 py-1.5 text-sm font-semibold ${metricsDays === days ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{days} jours</button>)}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="border-l-4 border-emerald-600 bg-white p-4 shadow-sm"><strong className="block text-2xl text-slate-950">{agentMetrics.summary.total}</strong><span className="text-sm text-slate-500">Conversations mesurées</span></div>
                <div className="border-l-4 border-blue-600 bg-white p-4 shadow-sm"><strong className="block text-2xl text-slate-950">{agentMetrics.summary.aiSuccesses}</strong><span className="text-sm text-slate-500">Réponses IA retenues par les règles</span></div>
                <div className="border-l-4 border-amber-500 bg-white p-4 shadow-sm"><strong className="block text-2xl text-slate-950">{agentMetrics.summary.localOrFallback}</strong><span className="text-sm text-slate-500">Réponses locales ou repli</span></div>
                <div className="border-l-4 border-violet-600 bg-white p-4 shadow-sm"><strong className="block text-2xl text-slate-950">{agentMetrics.summary.p95LatencyMs} ms</strong><span className="text-sm text-slate-500">Latence au 95e centile</span></div>
                <div className="border-l-4 border-slate-700 bg-white p-4 shadow-sm"><strong className="block text-2xl text-slate-950">{agentMetrics.summary.pricingConfigured ? euroFromMicros(agentMetrics.summary.estimatedCostMicros) : "Non configuré"}</strong><span className="text-sm text-slate-500">Coût estimé{agentMetrics.summary.pricingConfigured && !agentMetrics.summary.pricingComplete ? " partiel" : ""}, hors facturation</span></div>
              </div>

              <div className="grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-3" aria-label="Qualité du routage humain">
                <div className="bg-white px-4 py-3"><span className="text-xs font-semibold uppercase text-slate-500">Classements proposés</span><strong className="mt-1 block text-xl text-slate-950">{agentMetrics.summary.routingReviewTotal}</strong></div>
                <div className="bg-white px-4 py-3"><span className="text-xs font-semibold uppercase text-slate-500">Confirmés par un agent</span><strong className="mt-1 block text-xl text-slate-950">{agentMetrics.summary.routingReviewConfirmed}</strong></div>
                <div className="bg-white px-4 py-3"><span className="text-xs font-semibold uppercase text-slate-500">Corrigés par un agent</span><strong className="mt-1 block text-xl text-slate-950">{agentMetrics.summary.routingReviewCorrected}</strong></div>
              </div>
              <p className="text-xs text-slate-500">{agentMetrics.summary.routingReviewPending} classement{agentMetrics.summary.routingReviewPending > 1 ? "s" : ""} à confirmer · {agentMetrics.summary.routingReviewCompletionRate.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % traités · {agentMetrics.summary.routingReviewCorrectionRate.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % corrigés parmi les décisions. Ces indicateurs ne lisent ni message, ni identité, ni coordonnées.</p>
              <p className="border-l-2 border-amber-500 pl-3 text-xs leading-5 text-slate-600">Une réponse IA retenue a franchi les contrôles techniques. Cela ne signifie pas qu’un agent humain l’a validée.</p>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
                <div className="min-w-0 overflow-x-auto border border-slate-200 bg-white">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 font-semibold">Jour</th><th className="px-4 py-3 font-semibold">Utilisations</th><th className="px-4 py-3 font-semibold">IA retenue</th><th className="px-4 py-3 font-semibold">Latence moyenne</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{agentMetrics.daily.map((day) => <tr key={day.date}><td className="px-4 py-3 font-medium text-slate-900">{new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(`${day.date}T12:00:00`))}</td><td className="px-4 py-3">{day.total}</td><td className="px-4 py-3">{day.aiSuccesses}</td><td className="px-4 py-3">{day.averageLatencyMs} ms</td></tr>)}</tbody>
                  </table>
                  {agentMetrics.daily.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">Les mesures apparaîtront après les prochains essais de l’assistant.</p> : null}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-slate-500" /><h3 className="font-bold text-slate-950">Résultats techniques</h3></div>
                  <div className="divide-y border-y border-slate-200 bg-white">{agentMetrics.outcomes.map((item) => <div key={item.outcome} className="flex items-center justify-between gap-3 px-3 py-2.5"><span className="text-sm text-slate-600">{OUTCOME_LABELS[item.outcome] ?? "Autre résultat"}</span><strong className="text-sm text-slate-950">{item.count}</strong></div>)}{agentMetrics.outcomes.length === 0 ? <p className="px-3 py-8 text-center text-sm text-slate-500">Aucune mesure</p> : null}</div>
                  <p className="text-xs text-slate-500">{compactNumber(agentMetrics.summary.totalTokens)} jetons mesurés. Le coût reste masqué tant que les tarifs du modèle ne sont pas configurés explicitement.</p>
                </div>
              </div>
            </section>
          ) : null}
          {metricsError ? <section className="flex items-start gap-3 border border-amber-200 bg-amber-50 p-4" role="status"><AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" /><div><strong className="text-slate-950">Mesures de l’assistant indisponibles</strong><p className="mt-1 text-sm text-slate-600">La santé des demandes reste accessible. Réessayez avec le bouton d’actualisation.</p></div></section> : null}

          <section className="space-y-3">
            <div><h2 className="text-lg font-bold text-slate-950">Opérations à reprendre</h2><p className="text-sm text-slate-500">Une relance crée un nouvel essai audité. Aucun ancien lien de connexion n’est réutilisé.</p></div>
            <div className="divide-y border-y border-slate-200 bg-white">
              {payload?.failures.map((job) => (
                <article key={job.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-center">
                  <div className="min-w-0"><strong className="block truncate text-slate-950">{job.publicCode ?? "Dossier supprimé"} · {job.subject ?? "Sans objet"}</strong><span className="mt-1 block text-sm text-slate-600">{JOB_LABELS[job.jobType] ?? "Opération technique"}</span><small className="mt-1 block text-slate-500">Échec après {job.attempts} essais · {dateLabel(job.failedAt)}</small></div>
                  <span className="text-sm font-medium text-red-700">{job.lastErrorSummary ?? "Opération interrompue"}</span>
                  {isSupportRetryableJobType(job.jobType) ? (
                    <button type="button" onClick={() => void retry(job)} disabled={retryingId !== null} className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                      {retryingId === job.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Relancer
                    </button>
                  ) : (
                    <span className="inline-flex min-h-10 items-center justify-center border border-amber-300 bg-amber-50 px-3 py-2 text-center text-sm font-semibold text-amber-900">
                      Intervention manuelle
                    </span>
                  )}
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
