import { useEffect, useRef, useState } from "react";
import {
  Database,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { uploadPrivateFile } from "../../lib/resumable-upload";
import {
  IDENTITY_DIRECTORY_MAX_BYTES,
  identityDirectoryMime,
} from "../../../shared/identity-directory-input";
import { generateFictitiousIdentityDirectory } from "../../../shared/fictitious-identity-directory";
import IdentityDirectoryReport from "./IdentityDirectoryReport";

type DirectoryStatus =
  | "reserved"
  | "uploaded"
  | "quarantined"
  | "parsing"
  | "review"
  | "approved"
  | "active"
  | "superseded"
  | "rejected"
  | "failed"
  | "retired";

type DirectoryImport = {
  id: string;
  title: string;
  purposeDescription: string;
  sourceType: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: DirectoryStatus;
  rowCount: number | null;
  validRowCount: number | null;
  rejectedRowCount: number | null;
  uploadedAt: string | null;
  createdAt: string;
};

function downloadLargeFictitiousDirectory() {
  const blob = new Blob([generateFictitiousIdentityDirectory()], {
    type: "text/csv;charset=utf-8",
  });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = "repertoire-fictif-2100-personnes.csv";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

const STATUS: Record<DirectoryStatus, { label: string; style: string }> = {
  reserved: { label: "Transfert à terminer", style: "bg-slate-100 text-slate-700" },
  uploaded: { label: "Reçu, contrôle requis", style: "bg-blue-100 text-blue-800" },
  quarantined: { label: "Contrôle de sécurité", style: "bg-amber-100 text-amber-800" },
  parsing: { label: "Lecture en cours", style: "bg-cyan-100 text-cyan-800" },
  review: { label: "À vérifier", style: "bg-amber-100 text-amber-800" },
  approved: { label: "Approuvé", style: "bg-emerald-100 text-emerald-800" },
  active: { label: "Répertoire actif", style: "bg-emerald-100 text-emerald-800" },
  superseded: { label: "Remplacé", style: "bg-slate-200 text-slate-600" },
  rejected: { label: "Refusé", style: "bg-red-100 text-red-800" },
  failed: { label: "Échec", style: "bg-red-100 text-red-800" },
  retired: { label: "Retiré", style: "bg-slate-100 text-slate-500" },
};

function formatBytes(value: number): string {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} Ko`;
  return `${(value / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function IdentityDirectoryPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imports, setImports] = useState<DirectoryImport[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [purposeDescription, setPurposeDescription] = useState("");
  const [sourceType, setSourceType] = useState("official_export");
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<{ imports: DirectoryImport[] }>("identity/admin/imports");
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choisissez un fichier CSV ou Excel.");
      return;
    }
    const mimeType = identityDirectoryMime(file.name, file.type);
    if (!mimeType) {
      setError("Seuls les fichiers CSV et Excel .xlsx sont acceptés.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    setProgress(0);
    try {
      const reservation = await apiFetch<{
        import: DirectoryImport;
        upload: { bucket: string; path: string; token: string };
      }>("identity/admin/imports", {
        method: "POST",
        body: JSON.stringify({
          title,
          purposeDescription,
          sourceType,
          originalName: file.name,
          mimeType,
          sizeBytes: file.size,
        }),
      });
      const uploadFile = file.type === mimeType
        ? file
        : new File([file], file.name, { type: mimeType });
      await uploadPrivateFile(uploadFile, reservation.upload, setProgress);
      await apiFetch(`identity/admin/imports/${reservation.import.id}/confirm`, {
        method: "POST",
      });
      setNotice(
        "Fichier reçu dans l’espace privé. Il ne sera ni activé ni transmis à l’IA avant les contrôles et la validation humaine."
      );
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTitle("");
      setPurposeDescription("");
      setSourceType("official_export");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le dépôt a échoué.");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  const tooLarge = Boolean(file && file.size > IDENTITY_DIRECTORY_MAX_BYTES);
  const unsupported = Boolean(file && !identityDirectoryMime(file.name, file.type));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Identité et accès</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
            Répertoire privé du lycée
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Déposez une version préparée des élèves, responsables ou personnels. Ces données servent uniquement à vérifier l’identité et les droits.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          title="Actualiser"
          aria-label="Actualiser"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border bg-white text-slate-600 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      <section className="grid gap-3 md:grid-cols-3" aria-label="Protections du répertoire">
        <div className="flex gap-3 border-l-4 border-emerald-600 bg-white p-4 shadow-sm">
          <LockKeyhole className="h-5 w-5 shrink-0 text-emerald-700" />
          <span><strong className="block text-sm">Dépôt privé</strong><small className="text-slate-500">Double vérification obligatoire</small></span>
        </div>
        <div className="flex gap-3 border-l-4 border-blue-600 bg-white p-4 shadow-sm">
          <ShieldCheck className="h-5 w-5 shrink-0 text-blue-700" />
          <span><strong className="block text-sm">Activation humaine</strong><small className="text-slate-500">Aucune identité créée automatiquement</small></span>
        </div>
        <div className="flex gap-3 border-l-4 border-slate-500 bg-white p-4 shadow-sm">
          <Database className="h-5 w-5 shrink-0 text-slate-700" />
          <span><strong className="block text-sm">Séparé de l’IA</strong><small className="text-slate-500">Jamais utilisé comme connaissance générale</small></span>
        </div>
      </section>

      {error ? <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

      <form onSubmit={submit} className="grid gap-4 border-y border-slate-200 bg-white p-4 sm:grid-cols-2 sm:p-6">
        <div className="sm:col-span-2">
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center border-2 border-dashed border-slate-300 px-4 py-5 text-center hover:border-emerald-600">
            <Upload className="h-6 w-6 text-emerald-700" />
            <strong className="mt-2 text-sm">{file ? file.name : "Choisir un CSV ou un fichier Excel"}</strong>
            <span className="mt-1 text-xs text-slate-500">50 Mo maximum · aucun PDF ni document libre ici</span>
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              disabled={busy}
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                setFile(next);
                if (next && !title) setTitle(next.name.replace(/\.[^.]+$/, ""));
              }}
            />
          </label>
          {file ? (
            <small className={`mt-1 block text-xs ${tooLarge || unsupported ? "text-red-700" : "text-slate-500"}`}>
              {tooLarge ? "Ce fichier dépasse 50 Mo." : unsupported ? "Ce format n’est pas accepté." : formatBytes(file.size)}
            </small>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            <a
              href="/modeles/repertoire-identites-fictif.csv"
              download
              className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-900"
            >
              <Download className="h-4 w-4" /> Télécharger le modèle fictif
            </a>
            <button
              type="button"
              onClick={downloadLargeFictitiousDirectory}
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
            >
              <FileSpreadsheet className="h-4 w-4" /> Générer 2 100 personnes fictives
            </button>
          </div>
          <p className="mt-3 border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-950">
            N’ajoutez jamais de mot de passe, code ENT ou PRONOTE, secret
            d’activation, donnée médicale ou note disciplinaire. Toute colonne
            non prévue par le modèle sera refusée.
          </p>
        </div>

        <label className="text-sm font-medium text-slate-700">
          Nom de cette version
          <input className="field mt-1 bg-white" required minLength={2} maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Origine
          <select className="field mt-1 bg-white" value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
            <option value="official_export">Export officiel du lycée</option>
            <option value="xlsx">Tableau Excel préparé</option>
            <option value="csv">Fichier CSV préparé</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          Contenu et usage autorisé
          <textarea
            className="field mt-1 bg-white"
            rows={5}
            required
            minLength={20}
            maxLength={2000}
            placeholder="Exemple : liste officielle 2026-2027 des élèves et responsables, destinée uniquement au rapprochement d’identité et aux liens parent-enfant."
            value={purposeDescription}
            onChange={(event) => setPurposeDescription(event.target.value)}
          />
        </label>
        {progress > 0 ? <p className="text-sm text-slate-600 sm:col-span-2" role="status">Transfert : {progress} %</p> : null}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy || tooLarge || unsupported}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Déposer dans l’espace privé
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <div><h2 className="text-lg font-bold text-slate-950">Versions reçues</h2><p className="text-sm text-slate-500">Une seule version pourra être active après contrôle et approbation.</p></div>
        {loading ? <div className="flex min-h-40 items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin text-emerald-700" /></div> : null}
        {!loading ? <div className="divide-y border-y border-slate-200 bg-white">
          {imports.map((item) => (
            <article key={item.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_200px_170px] md:items-center">
              <div className="min-w-0">
                <span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-700" /><strong className="truncate">{item.title}</strong></span>
                <span className="mt-1 block truncate text-xs text-slate-500">{item.originalName} · {formatBytes(item.sizeBytes)}</span>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.purposeDescription}</p>
              </div>
              <div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[item.status].style}`}>{STATUS[item.status].label}</span>
                {item.rowCount !== null ? <small className="mt-1 block text-slate-500">{item.validRowCount ?? 0}/{item.rowCount} lignes valides</small> : null}
                {["review", "approved", "active", "superseded", "rejected", "failed", "retired"].includes(item.status) ? (
                  <button
                    type="button"
                    onClick={() => setSelectedImportId((value) => value === item.id ? null : item.id)}
                    className="mt-2 block text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                  >
                    {selectedImportId === item.id ? "Fermer le rapport" : "Examiner le rapport"}
                  </button>
                ) : null}
              </div>
              <time className="text-xs text-slate-500">Déposé le<br />{dateLabel(item.createdAt)}</time>
            </article>
          ))}
          {imports.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">Aucun répertoire n’a encore été déposé.</p> : null}
        </div> : null}
        {selectedImportId ? <IdentityDirectoryReport importId={selectedImportId} onChanged={load} /> : null}
      </section>
    </div>
  );
}
