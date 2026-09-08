import { useEffect, useState } from "react";
import { CheckCircle2, FileKey2, LoaderCircle, RefreshCw } from "lucide-react";
import { apiFetch } from "../../lib/api";
import {
  type PersonAttributeImportListItem,
  isPersonAttributeActionPayload,
  isPersonAttributeImportListPayload,
} from "../../../shared/person-attribute-admin-payload-policy";

const STATUS = {
  review: { label: "Validation requise", style: "bg-amber-100 text-amber-900" },
  active: { label: "Actif", style: "bg-emerald-100 text-emerald-900" },
  superseded: { label: "Remplacé", style: "bg-slate-100 text-slate-700" },
  rejected: { label: "Refusé", style: "bg-red-100 text-red-800" },
} as const;

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function PersonAttributeImportPanel() {
  const [imports, setImports] = useState<PersonAttributeImportListItem[]>([]);
  const [justification, setJustification] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<unknown>("identity/admin/attributes");
      if (!isPersonAttributeImportListPayload(result)) {
        throw new Error("La liste des attributs chiffrés est invalide.");
      }
      setImports(result.imports);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function activate(item: PersonAttributeImportListItem) {
    const reason = (justification[item.id] ?? "").normalize("NFKC").trim();
    if (reason.length < 20) {
      setError("Expliquez le contrôle effectué en au moins 20 caractères.");
      return;
    }
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      const result = await apiFetch<unknown>(`identity/admin/attributes/${item.id}/activate`, {
        method: "POST",
        body: JSON.stringify({ confirmation: "ACTIVER", justification: reason }),
      });
      if (!isPersonAttributeActionPayload(result, item.id)) {
        throw new Error("La confirmation reçue est invalide.");
      }
      setJustification((current) => ({ ...current, [item.id]: "" }));
      setNotice(result.duplicate
        ? "Cette version était déjà active."
        : "Les attributs chiffrés sont actifs. Leur valeur reste invisible dans cet écran et hors du contexte de l’IA.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Activation impossible.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-3 border-y border-slate-200 bg-white p-4 sm:p-6" aria-labelledby="attribute-import-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Dépôt Lycée</p>
          <h2 id="attribute-import-title" className="mt-1 text-lg font-bold text-slate-950">
            Attributs nominatifs chiffrés
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Le contrôle affiche uniquement le nom du lot et le nombre de lignes. Les valeurs restent chiffrées et ne sont jamais montrées à l’agent.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Actualiser les attributs"
          title="Actualiser"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-white text-slate-600 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error ? <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}
      {loading ? <div className="flex min-h-24 items-center justify-center"><LoaderCircle className="h-6 w-6 animate-spin text-blue-700" /></div> : null}

      {!loading ? <div className="divide-y border border-slate-200">
        {imports.map((item) => (
          <article key={item.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_170px]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <FileKey2 className="h-4 w-4 shrink-0 text-blue-700" />
                <strong className="truncate text-sm text-slate-950">{item.originalName}</strong>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[item.status].style}`}>
                  {STATUS[item.status].label}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {item.rowCount.toLocaleString("fr-FR")} lignes · reçu le {dateLabel(item.createdAt)}
              </p>
              {item.status === "review" ? (
                <label className="mt-3 block text-sm font-medium text-slate-700">
                  Contrôle réalisé
                  <textarea
                    className="field mt-1 bg-white"
                    rows={2}
                    minLength={20}
                    maxLength={1000}
                    placeholder="Exemple : lot rapproché de l’annuaire actif et volume vérifié."
                    value={justification[item.id] ?? ""}
                    onChange={(event) => setJustification((current) => ({ ...current, [item.id]: event.target.value }))}
                    disabled={busyId === item.id}
                  />
                </label>
              ) : null}
            </div>
            <div className="flex items-center justify-start lg:justify-end">
              {item.status === "review" ? (
                <button
                  type="button"
                  onClick={() => void activate(item)}
                  disabled={busyId !== null || (justification[item.id] ?? "").trim().length < 20}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busyId === item.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Activer ce lot
                </button>
              ) : item.approvedAt ? (
                <time className="text-xs text-slate-500">Validé le {dateLabel(item.approvedAt)}</time>
              ) : null}
            </div>
          </article>
        ))}
        {imports.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">Aucun lot d’attributs reçu.</p>
        ) : null}
      </div> : null}
    </section>
  );
}
