import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock3,
  History,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import {
  isAgentApprovalDecisionPayload,
  isAgentApprovalsPayload,
  type AgentApprovalsPayload,
  type AgentApprovalStatus,
} from "../../../shared/agent-approval-payload-policy";

type ApprovalView = "pending" | "history" | "all";
type DecisionMode = "approved" | "rejected" | null;

const STATUS_LABELS: Record<AgentApprovalStatus, string> = {
  pending: "En attente",
  approved: "Validée",
  rejected: "Refusée",
  expired: "Expirée",
  cancelled: "Annulée",
};

const STATUS_STYLES: Record<AgentApprovalStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  rejected: "bg-red-50 text-red-800 ring-red-200",
  expired: "bg-slate-100 text-slate-700 ring-slate-200",
  cancelled: "bg-slate-100 text-slate-700 ring-slate-200",
};

function dateLabel(value: string | null): string {
  if (!value) return "Non renseigné";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date indisponible";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function expiryLabel(value: string): string {
  const milliseconds = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return "Délai dépassé";
  const minutes = Math.ceil(milliseconds / 60_000);
  if (minutes < 60) return `Expire dans ${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  return `Expire dans ${hours} h`;
}

function StatusPill({ status }: { status: AgentApprovalStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function AgentApprovalsPage() {
  const [view, setView] = useState<ApprovalView>("pending");
  const [payload, setPayload] = useState<AgentApprovalsPayload | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [decisionMode, setDecisionMode] = useState<DecisionMode>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selected = useMemo(
    () => payload?.items.find((item) => item.id === selectedId) ?? payload?.items[0] ?? null,
    [payload, selectedId]
  );

  async function load(nextView: ApprovalView = view) {
    setLoading(true);
    setError("");
    try {
      const next = await apiFetch<unknown>(`support/agent/approvals?view=${nextView}`);
      if (!isAgentApprovalsPayload(next)) {
        throw new Error("Réponse invalide du service de validations.");
      }
      setPayload(next);
      setSelectedId((current) =>
        next.items.some((item) => item.id === current) ? current : next.items[0]?.id ?? null
      );
    } catch (reasonValue) {
      setError(
        reasonValue instanceof Error
          ? reasonValue.message
          : "Les validations sont momentanément indisponibles."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(view);
  }, [view]);

  async function decide() {
    if (!selected || !decisionMode) return;
    setDeciding(true);
    setError("");
    setNotice("");
    try {
      const confirmation = await apiFetch<unknown>(`support/agent/approvals/${selected.id}/decision`, {
        method: "POST",
        body: JSON.stringify({
          decision: decisionMode,
          reason: reason.trim() || null,
        }),
      });
      if (!isAgentApprovalDecisionPayload(confirmation, {
        approvalId: selected.id,
        status: decisionMode,
      })) {
        throw new Error("La confirmation de validation est invalide.");
      }
      setNotice(
        decisionMode === "approved"
          ? "La validation a été enregistrée. L’action n’est pas encore annoncée comme réalisée."
          : "Le refus et son motif ont été enregistrés."
      );
      setDecisionMode(null);
      setReason("");
      await load(view);
    } catch (reasonValue) {
      setError(
        reasonValue instanceof Error ? reasonValue.message : "La décision n’a pas été enregistrée."
      );
    } finally {
      setDeciding(false);
    }
  }

  const stats = payload
    ? [
        { label: "En attente", value: payload.summary.pending, icon: Clock3, tone: "text-amber-700" },
        { label: "À valider par moi", value: payload.summary.actionable, icon: BadgeCheck, tone: "text-blue-700" },
        { label: "Décidées", value: payload.summary.decided, icon: CheckCircle2, tone: "text-emerald-700" },
        { label: "Expirées", value: payload.summary.expired, icon: History, tone: "text-slate-600" },
      ]
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Espace agent</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Validations</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Contrôlez les actions sensibles avant leur exécution et retrouvez chaque décision.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(view)}
          disabled={loading}
          title="Actualiser"
          aria-label="Actualiser"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      {error ? (
        <div role="alert" className="flex items-start gap-3 border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="flex items-start gap-3 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      ) : null}

      {payload ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Résumé des validations">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="border-t-2 border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-600">{stat.label}</span>
                  <Icon className={`h-4 w-4 ${stat.tone}`} />
                </div>
                <strong className="mt-2 block text-2xl text-slate-950">{stat.value}</strong>
              </div>
            );
          })}
        </section>
      ) : null}

      <div className="inline-flex max-w-full rounded-md bg-slate-100 p-1" aria-label="Filtrer les validations">
        {([
          ["pending", "En attente"],
          ["history", "Historique"],
          ["all", "Toutes"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setView(value)}
            className={`min-h-9 px-3 text-sm font-semibold transition-colors sm:px-4 ${
              view === value ? "rounded bg-white text-slate-950 shadow-sm" : "text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && !payload ? (
        <div className="flex min-h-64 items-center justify-center" aria-live="polite">
          <LoaderCircle className="h-8 w-8 animate-spin text-emerald-700" />
        </div>
      ) : null}

      {payload ? (
        <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="min-w-0 border-y border-slate-200 bg-white">
            {payload.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`block w-full border-b border-slate-100 px-4 py-4 text-left transition-colors last:border-b-0 ${
                  selected?.id === item.id ? "bg-emerald-50" : "hover:bg-slate-50"
                }`}
              >
                <span className="flex min-w-0 items-start justify-between gap-3">
                  <span className="min-w-0">
                    <strong className="block break-words text-sm text-slate-950 sm:text-base">
                      {item.toolLabel}
                    </strong>
                    <span className="mt-1 block text-sm text-slate-600">
                      {item.serviceLabel} · {dateLabel(item.requestedAt)}
                    </span>
                  </span>
                  <StatusPill status={item.status} />
                </span>
                {item.status === "pending" ? (
                  <span className={`mt-3 block text-xs font-semibold ${item.canDecide ? "text-blue-700" : "text-slate-500"}`}>
                    {item.canDecide
                      ? expiryLabel(item.expiresAt)
                      : item.requestedByMe
                        ? "Une autre personne doit valider"
                        : `Validation attendue : ${item.requestedFromRole}`}
                  </span>
                ) : null}
              </button>
            ))}
            {payload.items.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <ShieldCheck className="mx-auto h-8 w-8 text-emerald-700" />
                <strong className="mt-3 block text-slate-950">
                  {view === "pending" ? "Aucune validation en attente" : "Aucune décision dans cette vue"}
                </strong>
                <p className="mt-1 text-sm text-slate-500">La liste se mettra à jour dès qu’une action nécessitera un contrôle.</p>
              </div>
            ) : null}
          </div>

          <div className="min-w-0 border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            {selected ? (
              <div className="space-y-6">
                <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-emerald-700">{selected.serviceLabel}</p>
                    <h2 className="mt-1 break-words text-xl font-bold text-slate-950">{selected.toolLabel}</h2>
                    <p className="mt-1 text-sm text-slate-500">{selected.skillName} · version {selected.skillVersion}</p>
                  </div>
                  <StatusPill status={selected.status} />
                </div>

                <dl className="grid gap-x-6 gap-y-4 border-y border-slate-200 py-5 sm:grid-cols-2">
                  <div><dt className="text-xs font-semibold uppercase text-slate-500">Demandée le</dt><dd className="mt-1 text-sm text-slate-900">{dateLabel(selected.requestedAt)}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-slate-500">Délai</dt><dd className="mt-1 text-sm text-slate-900">{selected.status === "pending" ? expiryLabel(selected.expiresAt) : dateLabel(selected.expiresAt)}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-slate-500">Validation attendue</dt><dd className="mt-1 text-sm text-slate-900">{selected.requestedFromRole}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-slate-500">Décision</dt><dd className="mt-1 text-sm text-slate-900">{selected.decidedAt ? dateLabel(selected.decidedAt) : "En attente"}</dd></div>
                </dl>

                <div>
                  <h3 className="text-sm font-bold text-slate-950">Éléments à contrôler</h3>
                  {selected.details.length > 0 ? (
                    <dl className="mt-3 space-y-3">
                      {selected.details.map((detail) => (
                        <div key={`${detail.label}-${detail.value}`} className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-4">
                          <dt className="text-sm text-slate-500">{detail.label}</dt>
                          <dd className="break-words text-sm font-medium text-slate-900">{detail.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600">Aucune donnée personnelle n’est nécessaire pour cette décision.</p>
                  )}
                </div>

                {selected.decisionReason ? (
                  <div className="border-l-4 border-slate-300 bg-slate-50 p-4">
                    <strong className="text-sm text-slate-950">Motif enregistré</strong>
                    <p className="mt-1 break-words text-sm text-slate-700">{selected.decisionReason}</p>
                  </div>
                ) : null}

                {selected.canDecide ? (
                  <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                    <button type="button" onClick={() => setDecisionMode("rejected")} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-200 px-4 text-sm font-semibold text-red-700 hover:bg-red-50">
                      <XCircle className="h-4 w-4" /> Refuser
                    </button>
                    <button type="button" onClick={() => setDecisionMode("approved")} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
                      <Check className="h-4 w-4" /> Valider
                    </button>
                  </div>
                ) : selected.status === "pending" ? (
                  <p className="border-t border-slate-200 pt-4 text-sm text-slate-600">
                    {selected.requestedByMe
                      ? "La personne qui a préparé l’action ne peut pas la valider elle-même."
                      : `Cette décision est réservée au rôle « ${selected.requestedFromRole} ».`}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="flex min-h-64 items-center justify-center text-center text-sm text-slate-500">
                Sélectionnez une validation pour consulter son détail.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {payload?.truncated ? <p className="text-xs text-slate-500">Seules les 200 validations les plus récentes sont affichées.</p> : null}

      {decisionMode && selected ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="approval-dialog-title">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto bg-white p-5 shadow-2xl sm:rounded-md sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-sm font-semibold ${decisionMode === "approved" ? "text-emerald-700" : "text-red-700"}`}>
                  {decisionMode === "approved" ? "Confirmer la validation" : "Confirmer le refus"}
                </p>
                <h2 id="approval-dialog-title" className="mt-1 break-words text-xl font-bold text-slate-950">{selected.toolLabel}</h2>
              </div>
              <button type="button" onClick={() => { setDecisionMode(null); setReason(""); }} aria-label="Fermer" title="Fermer" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              {decisionMode === "approved"
                ? "Vous autorisez la poursuite de cette action. Sa réussite ne sera affichée qu’après confirmation du service concerné."
                : "Le refus ferme cette action. Indiquez un motif clair pour permettre sa correction."}
            </p>
            <label className="mt-5 block text-sm font-semibold text-slate-900" htmlFor="approval-reason">
              Motif {decisionMode === "approved" ? "(facultatif)" : "(obligatoire)"}
            </label>
            <textarea
              id="approval-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value.slice(0, 500))}
              rows={4}
              maxLength={500}
              placeholder={decisionMode === "approved" ? "Contrôle effectué" : "Expliquez ce qui doit être corrigé"}
              className="mt-2 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
            <div className="mt-1 text-right text-xs text-slate-500">{reason.length}/500</div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { setDecisionMode(null); setReason(""); }} disabled={deciding} className="min-h-10 rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50">Annuler</button>
              <button
                type="button"
                onClick={() => void decide()}
                disabled={deciding || (decisionMode === "rejected" && reason.trim().length < 2)}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50 ${decisionMode === "approved" ? "bg-emerald-700" : "bg-red-700"}`}
              >
                {deciding ? <LoaderCircle className="h-4 w-4 animate-spin" /> : decisionMode === "approved" ? <Check className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {decisionMode === "approved" ? "Valider l’action" : "Refuser l’action"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
