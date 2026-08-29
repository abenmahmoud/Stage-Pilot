import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  FileLock2,
  FileText,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { uploadPrivateFile } from "../../lib/resumable-upload";
import {
  SCHEDULE_IMPORT_MAX_BYTES,
  SCHEDULE_IMPORT_MIME,
  type ScheduleSourceKind,
} from "../../../shared/schedule-import-input";

type ScheduleStatus =
  | "reserved"
  | "uploaded"
  | "quarantined"
  | "processing"
  | "review"
  | "approved"
  | "active"
  | "superseded"
  | "rejected"
  | "failed"
  | "retired";

type ScheduleImport = {
  id: string;
  sourceKind: ScheduleSourceKind;
  schoolYear: string;
  version: number;
  title: string;
  purposeDescription: string;
  effectiveFrom: string;
  originalName: string;
  sizeBytes: number;
  pageCount: number | null;
  status: ScheduleStatus;
  validationSummary: Record<string, unknown>;
  uploadedAt: string | null;
  createdAt: string;
};

const STATUS: Record<ScheduleStatus, { label: string; style: string }> = {
  reserved: { label: "Transfert à terminer", style: "bg-slate-100 text-slate-700" },
  uploaded: { label: "Reçu, contrôle en attente", style: "bg-blue-100 text-blue-800" },
  quarantined: { label: "Contrôle de sécurité", style: "bg-amber-100 text-amber-900" },
  processing: { label: "Lecture technique", style: "bg-cyan-100 text-cyan-900" },
  review: { label: "Index à vérifier", style: "bg-amber-100 text-amber-900" },
  approved: { label: "Approuvé", style: "bg-emerald-100 text-emerald-800" },
  active: { label: "Version active", style: "bg-emerald-700 text-white" },
  superseded: { label: "Version remplacée", style: "bg-slate-200 text-slate-700" },
  rejected: { label: "Refusé", style: "bg-red-100 text-red-800" },
  failed: { label: "Échec du contrôle", style: "bg-red-100 text-red-800" },
  retired: { label: "Retiré", style: "bg-slate-100 text-slate-500" },
};

function defaultSchoolYear(): string {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

function formatBytes(value: number): string {
  return value < 1024 * 1024
    ? `${Math.max(1, Math.round(value / 1024))} Ko`
    : `${(value / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

export default function ScheduleImportPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [imports, setImports] = useState<ScheduleImport[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [sourceKind, setSourceKind] = useState<ScheduleSourceKind>("classes");
  const [schoolYear, setSchoolYear] = useState(defaultSchoolYear);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [purposeDescription, setPurposeDescription] = useState(
    "Emploi du temps officiel à indexer par page et à consulter uniquement après validation humaine."
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<{ imports: ScheduleImport[] }>("schedule/admin/imports");
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
      setError("Choisissez le PDF à déposer.");
      return;
    }
    if (file.type !== SCHEDULE_IMPORT_MIME && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Seuls les fichiers PDF sont acceptés.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    setProgress(0);
    try {
      const reservation = await apiFetch<{
        import: ScheduleImport;
        upload: { bucket: string; path: string; token: string };
      }>("schedule/admin/imports", {
        method: "POST",
        body: JSON.stringify({
          sourceKind,
          schoolYear,
          title,
          purposeDescription,
          effectiveFrom,
          originalName: file.name,
          mimeType: SCHEDULE_IMPORT_MIME,
          sizeBytes: file.size,
        }),
      });
      const pdf = file.type === SCHEDULE_IMPORT_MIME
        ? file
        : new File([file], file.name, { type: SCHEDULE_IMPORT_MIME });
      await uploadPrivateFile(pdf, reservation.upload, setProgress);
      await apiFetch(`schedule/admin/imports/${reservation.import.id}/confirm`, {
        method: "POST",
      });
      setNotice(
        "PDF reçu dans l'espace privé. Il reste bloqué jusqu'au contrôle antivirus, à l'indexation des pages et à l'approbation humaine."
      );
      setFile(null);
      setTitle("");
      if (fileInput.current) fileInput.current.value = "";
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le dépôt a échoué.");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  const invalidFile = Boolean(
    file && (
      file.size < 1 ||
      file.size > SCHEDULE_IMPORT_MAX_BYTES ||
      (!file.name.toLowerCase().endsWith(".pdf") && file.type !== SCHEDULE_IMPORT_MIME)
    )
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Données scolaires privées</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Emplois du temps</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Versions officielles des classes et des professeurs, conservées séparément et datées.
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

      <section className="grid gap-3 md:grid-cols-3" aria-label="Protections des emplois du temps">
        <div className="flex gap-3 border-l-4 border-emerald-600 bg-white p-4 shadow-sm">
          <FileLock2 className="h-5 w-5 shrink-0 text-emerald-700" />
          <span><strong className="block text-sm">PDF privé</strong><small className="text-slate-500">Aucune URL publique</small></span>
        </div>
        <div className="flex gap-3 border-l-4 border-blue-600 bg-white p-4 shadow-sm">
          <ShieldCheck className="h-5 w-5 shrink-0 text-blue-700" />
          <span><strong className="block text-sm">Validation humaine</strong><small className="text-slate-500">Double vérification obligatoire</small></span>
        </div>
        <div className="flex gap-3 border-l-4 border-slate-500 bg-white p-4 shadow-sm">
          <CalendarDays className="h-5 w-5 shrink-0 text-slate-700" />
          <span><strong className="block text-sm">Version datée</strong><small className="text-slate-500">Retour arrière prévu</small></span>
        </div>
      </section>

      {error ? <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

      <form onSubmit={submit} className="grid gap-4 border-y border-slate-200 bg-white p-4 sm:grid-cols-2 sm:p-6">
        <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center border-2 border-dashed border-slate-300 px-4 py-5 text-center sm:col-span-2 hover:border-emerald-600">
          <Upload className="h-6 w-6 text-emerald-700" />
          <strong className="mt-2 text-sm">{file ? file.name : "Choisir un PDF officiel"}</strong>
          <span className="mt-1 text-xs text-slate-500">50 Mo maximum</span>
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            accept=".pdf,application/pdf"
            required
            disabled={busy}
            onChange={(event) => {
              const next = event.target.files?.[0] ?? null;
              setFile(next);
              if (next && !title) setTitle(next.name.replace(/\.pdf$/i, ""));
            }}
          />
        </label>
        {file ? (
          <small className={`sm:col-span-2 ${invalidFile ? "text-red-700" : "text-slate-500"}`}>
            {invalidFile ? "Ce fichier n'est pas un PDF valide de moins de 50 Mo." : formatBytes(file.size)}
          </small>
        ) : null}

        <label className="text-sm font-medium text-slate-700">
          Périmètre
          <select className="field mt-1 bg-white" value={sourceKind} onChange={(event) => setSourceKind(event.target.value as ScheduleSourceKind)}>
            <option value="classes">Emplois du temps des classes</option>
            <option value="teachers">Emplois du temps des professeurs</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Année scolaire
          <input className="field mt-1 bg-white" pattern="[0-9]{4}-[0-9]{4}" required value={schoolYear} onChange={(event) => setSchoolYear(event.target.value)} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Date d'effet
          <input className="field mt-1 bg-white" type="date" required value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Nom de la version
          <input className="field mt-1 bg-white" required minLength={2} maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          Usage autorisé
          <textarea className="field mt-1 bg-white" rows={4} required minLength={20} maxLength={2000} value={purposeDescription} onChange={(event) => setPurposeDescription(event.target.value)} />
        </label>
        {progress > 0 ? <p className="text-sm text-slate-600 sm:col-span-2" role="status">Transfert : {progress} %</p> : null}
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy || invalidFile} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Déposer la nouvelle version
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <div><h2 className="text-lg font-bold text-slate-950">Versions reçues</h2><p className="text-sm text-slate-500">Une seule version pourra être active par périmètre et par année.</p></div>
        {loading ? <div className="flex min-h-40 items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin text-emerald-700" /></div> : null}
        {!loading ? (
          <div className="divide-y border-y border-slate-200 bg-white">
            {imports.map((item) => (
              <article key={item.id} className="grid min-w-0 gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_190px_180px] md:items-center">
                <div className="min-w-0">
                  <span className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-emerald-700" /><strong className="truncate">{item.title}</strong></span>
                  <span className="mt-1 block break-words text-xs text-slate-500">{item.sourceKind === "classes" ? "Classes" : "Professeurs"} · {item.schoolYear} · version {item.version}</span>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.purposeDescription}</p>
                </div>
                <div>
                  <span className={`inline-flex max-w-full px-2.5 py-1 text-xs font-semibold ${STATUS[item.status].style}`}>{STATUS[item.status].label}</span>
                  <small className="mt-1 block text-slate-500">{item.pageCount ? `${item.pageCount} pages` : formatBytes(item.sizeBytes)}</small>
                </div>
                <div className="text-xs text-slate-500">
                  <span className="block">Effet : {formatDate(item.effectiveFrom)}</span>
                  <span className="mt-1 block break-words">{item.originalName}</span>
                </div>
              </article>
            ))}
            {imports.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">Aucun PDF n'a encore été déposé.</p> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
