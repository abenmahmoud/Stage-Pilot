import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { apiFetch } from "../../lib/api";

type ReportIssue = {
  severity: "warning" | "error";
  code: string;
  column: string;
};

type ReportRow = {
  id: number;
  sourceSheet: string;
  rowNumber: number;
  recordType: "person" | "relationship" | "unknown";
  personRef: string | null;
  personType: string | null;
  subjectPersonRef: string | null;
  relationshipType: string | null;
  objectRef: string | null;
  classRef: string | null;
  serviceCode: string | null;
  validFrom: string | null;
  validUntil: string | null;
  validationStatus: "valid" | "warning" | "rejected";
  issues: ReportIssue[];
};

type ReportResponse = {
  import: {
    id: string;
    status: string;
    rowCount: number | null;
    validRowCount: number | null;
    rejectedRowCount: number | null;
    validationSummary: {
      warningRowCount?: number;
      personCount?: number;
      relationshipCount?: number;
      issueCounts?: Record<string, number>;
      antivirus?: string;
      readyForApproval?: boolean;
    };
  };
  rows: ReportRow[];
  pagination: { page: number; pageSize: number; total: number };
};

const ISSUE_LABELS: Record<string, string> = {
  duplicate_person_ref: "Référence de personne en double",
  duplicate_relationship: "Relation en double",
  duplicate_academic_email: "Email académique utilisé plusieurs fois",
  shared_personal_email: "Email personnel partagé",
  shared_phone: "Téléphone partagé",
  invalid_email: "Format d’email invalide",
  invalid_phone: "Format de téléphone invalide",
  invalid_date: "Date invalide",
  invalid_date_range: "Période incohérente",
  invalid_person_type: "Type de personne invalide",
  invalid_relationship_type: "Type de relation invalide",
  invalid_record_type: "Type de ligne invalide",
  invalid_reference: "Référence invalide",
  missing_value: "Information obligatoire manquante",
  no_contact_factor: "Aucun contact utilisable pour le rapprochement",
  student_without_class: "Élève sans classe",
  staff_without_service: "Personnel sans service",
  unknown_subject_ref: "Personne source absente du fichier",
  unknown_object_ref: "Personne liée absente du fichier",
  self_reference_mismatch: "Relation personnelle incohérente",
  value_too_long: "Valeur trop longue",
};

function issueLabel(code: string): string {
  return ISSUE_LABELS[code] ?? code.replaceAll("_", " ");
}

function rowReference(row: ReportRow): string {
  if (row.recordType === "person") return row.personRef ?? "Référence absente";
  if (row.recordType === "relationship") {
    return `${row.subjectPersonRef ?? "?"} → ${row.objectRef ?? "?"}`;
  }
  return "Ligne non reconnue";
}

export default function IdentityDirectoryReport({
  importId,
  onChanged,
}: {
  importId: string;
  onChanged: () => Promise<void>;
}) {
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [justification, setJustification] = useState("");
  const [activationConfirmed, setActivationConfirmed] = useState(false);
  const [retirementReason, setRetirementReason] = useState("");
  const [retirementConfirmed, setRetirementConfirmed] = useState(false);

  async function load(nextPage = page) {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<ReportResponse>(
        `identity/admin/imports/${importId}/report?page=${nextPage}`
      );
      setReport(result);
      setPage(result.pagination.page);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Rapport indisponible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPage(1);
    setJustification("");
    setActivationConfirmed(false);
    setRetirementReason("");
    setRetirementConfirmed(false);
    void load(1);
  }, [importId]);

  async function approve() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(`identity/admin/imports/${importId}/approve`, {
        method: "POST",
        body: JSON.stringify({ justification }),
      });
      setNotice("Rapport approuvé. La version reste inactive jusqu’à votre confirmation finale.");
      setJustification("");
      await Promise.all([load(page), onChanged()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Approbation impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(`identity/admin/imports/${importId}/activate`, {
        method: "POST",
        body: JSON.stringify({ confirmation: "ACTIVER", justification }),
      });
      setNotice("Cette version est maintenant la seule version active du répertoire privé.");
      setJustification("");
      setActivationConfirmed(false);
      await Promise.all([load(page), onChanged()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Activation impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function retire() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(`identity/admin/imports/${importId}/retire`, {
        method: "POST",
        body: JSON.stringify({ confirmation: "RETIRER", justification: retirementReason }),
      });
      setNotice("Version retirée : le fichier privé et ses lignes de contrôle ont été supprimés.");
      setRetirementReason("");
      setRetirementConfirmed(false);
      await Promise.all([load(1), onChanged()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Retrait impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !report) {
    return <div className="flex min-h-40 items-center justify-center"><LoaderCircle className="h-6 w-6 animate-spin text-emerald-700" /></div>;
  }
  if (!report) return <p role="alert" className="bg-red-50 p-3 text-sm text-red-800">{error || "Rapport indisponible."}</p>;

  const summary = report.import.validationSummary ?? {};
  const totalPages = Math.max(1, Math.ceil(report.pagination.total / report.pagination.pageSize));
  const canApprove = report.import.status === "review" && report.import.rejectedRowCount === 0;
  const canActivate = report.import.status === "approved";
  const canRetire = ["review", "approved", "superseded", "rejected", "failed"].includes(
    report.import.status
  );

  return (
    <div className="space-y-5 border-y border-slate-200 bg-slate-50 p-4 sm:p-6">
      <div>
        <h3 className="text-lg font-bold text-slate-950">Rapport de contrôle</h3>
        <p className="mt-1 text-sm text-slate-600">
          Les noms et coordonnées ne sont jamais affichés ici. Seules les références internes et les anomalies sont visibles.
        </p>
      </div>

      {error ? <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-l-4 border-slate-500 bg-white p-3"><strong className="block text-xl">{report.import.rowCount ?? 0}</strong><span className="text-xs text-slate-500">lignes contrôlées</span></div>
        <div className="border-l-4 border-emerald-600 bg-white p-3"><strong className="block text-xl">{report.import.validRowCount ?? 0}</strong><span className="text-xs text-slate-500">lignes utilisables</span></div>
        <div className="border-l-4 border-amber-500 bg-white p-3"><strong className="block text-xl">{summary.warningRowCount ?? 0}</strong><span className="text-xs text-slate-500">lignes à surveiller</span></div>
        <div className="border-l-4 border-red-600 bg-white p-3"><strong className="block text-xl">{report.import.rejectedRowCount ?? 0}</strong><span className="text-xs text-slate-500">lignes refusées</span></div>
      </div>

      {summary.issueCounts && Object.keys(summary.issueCounts).length > 0 ? (
        <div className="bg-white p-4">
          <h4 className="text-sm font-bold text-slate-900">Anomalies détectées</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(summary.issueCounts).map(([code, value]) => (
              <span key={code} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                {issueLabel(code)} · {value}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="divide-y border-y border-slate-200 bg-white">
        {report.rows.map((row) => (
          <article key={row.id} className="grid gap-2 px-3 py-3 sm:grid-cols-[90px_minmax(0,1fr)_minmax(180px,1fr)] sm:items-start">
            <div className="text-xs text-slate-500">{row.sourceSheet}<br />ligne {row.rowNumber}</div>
            <div className="min-w-0">
              <strong className="block break-all text-sm text-slate-900">{rowReference(row)}</strong>
              <span className="text-xs text-slate-500">
                {row.recordType === "person" ? row.personType : row.relationshipType}
                {row.classRef ? ` · ${row.classRef}` : ""}
                {row.serviceCode ? ` · ${row.serviceCode}` : ""}
              </span>
            </div>
            <div className="space-y-1">
              {row.validationStatus === "valid" ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Conforme</span> : null}
              {row.issues.map((entry, index) => (
                <span key={`${entry.code}-${index}`} className={`flex items-start gap-1 text-xs ${entry.severity === "error" ? "text-red-700" : "text-amber-800"}`}>
                  {entry.severity === "error" ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  {issueLabel(entry.code)}
                </span>
              ))}
            </div>
          </article>
        ))}
        {report.rows.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">Aucune ligne de rapport disponible.</p> : null}
      </div>

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between" aria-label="Pages du rapport">
          <button type="button" disabled={page <= 1 || loading} onClick={() => void load(page - 1)} className="inline-flex items-center gap-1 rounded-md border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Précédent</button>
          <span className="text-sm text-slate-600">Page {page} sur {totalPages}</span>
          <button type="button" disabled={page >= totalPages || loading} onClick={() => void load(page + 1)} className="inline-flex items-center gap-1 rounded-md border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40">Suivant <ChevronRight className="h-4 w-4" /></button>
        </nav>
      ) : null}

      {canApprove || canActivate ? (
        <div className="border-l-4 border-emerald-600 bg-white p-4">
          <label className="text-sm font-semibold text-slate-800">
            Contrôle effectué et justification
            <textarea className="field mt-2 bg-white" rows={3} minLength={20} maxLength={1000} value={justification} onChange={(event) => setJustification(event.target.value)} placeholder="Indiquez ce que vous avez vérifié et la raison de cette décision." />
          </label>
          {canActivate ? (
            <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" className="mt-1" checked={activationConfirmed} onChange={(event) => setActivationConfirmed(event.target.checked)} />
              Je confirme que cette version remplacera la version actuellement active.
            </label>
          ) : null}
          <button
            type="button"
            disabled={busy || justification.trim().length < 20 || (canActivate && !activationConfirmed)}
            onClick={() => void (canApprove ? approve() : activate())}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {canApprove ? "Approuver le rapport" : "Activer cette version"}
          </button>
        </div>
      ) : null}

      {canRetire ? (
        <div className="border-l-4 border-red-600 bg-white p-4">
          <h4 className="text-sm font-bold text-slate-950">Retirer cette version</h4>
          <p className="mt-1 text-sm text-slate-600">
            Le fichier privé et les lignes de contrôle seront supprimés. Une preuve minimale du retrait restera dans le journal.
          </p>
          <label className="mt-3 block text-sm font-semibold text-slate-800">
            Motif du retrait
            <textarea
              className="field mt-2 bg-white"
              rows={3}
              minLength={20}
              maxLength={1000}
              value={retirementReason}
              onChange={(event) => setRetirementReason(event.target.value)}
              placeholder="Expliquez pourquoi cette version ne doit plus être conservée."
            />
          </label>
          <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={retirementConfirmed}
              onChange={(event) => setRetirementConfirmed(event.target.checked)}
            />
            Je confirme la suppression du fichier privé et des lignes de contrôle.
          </label>
          <button
            type="button"
            disabled={busy || retirementReason.trim().length < 20 || !retirementConfirmed}
            onClick={() => void retire()}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Retirer cette version
          </button>
        </div>
      ) : null}
    </div>
  );
}
