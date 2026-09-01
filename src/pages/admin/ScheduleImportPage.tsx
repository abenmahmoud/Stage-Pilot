import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  ExternalLink,
  FileLock2,
  FileText,
  LoaderCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { uploadPrivateFile } from "../../lib/resumable-upload";
import {
  parseScheduleImportListPayload,
  parseScheduleImportMutationPayload,
  parseScheduleImportReservationPayload,
  parseSchedulePageListPayload,
  parseSchedulePageMutationPayload,
  parseSchedulePrivateFilePayload,
  type ScheduleImportPayload as ScheduleImport,
  type ScheduleImportStatus as ScheduleStatus,
  type SchedulePageMappingPayload as SchedulePageMapping,
  type SchedulePageSourcePayload as SchedulePageSource,
} from "../../../shared/schedule-admin-payload";
import {
  SCHEDULE_IMPORT_MAX_BYTES,
  SCHEDULE_IMPORT_MIME,
  parseScheduleImportInput,
  type ScheduleSourceKind,
} from "../../../shared/schedule-import-input";

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

const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(
      import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL
    ).origin;
  } catch {
    return "";
  }
})();

function defaultSchoolYear(): string {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

function dateAfter(days: number): string {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatBytes(value: number): string {
  return value < 1024 * 1024
    ? `${Math.max(1, Math.round(value / 1024))} Ko`
    : `${(value / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

function normalizeDraftRef(value: string): string {
  return value.normalize("NFKC").trim().toUpperCase().replace(/\s+/g, "-");
}

export default function ScheduleImportPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [imports, setImports] = useState<ScheduleImport[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [sourceKind, setSourceKind] = useState<ScheduleSourceKind>("classes");
  const [schoolYear, setSchoolYear] = useState(defaultSchoolYear);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [freshUntil, setFreshUntil] = useState(() => dateAfter(7));
  const [title, setTitle] = useState("");
  const [purposeDescription, setPurposeDescription] = useState(
    "Emploi du temps officiel à indexer par page et à consulter uniquement après validation humaine."
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedImportId, setSelectedImportId] = useState("");
  const [actionTargetId, setActionTargetId] = useState("");
  const [actionJustification, setActionJustification] = useState("");
  const [actionConfirmation, setActionConfirmation] = useState("");
  const [promotionBusy, setPromotionBusy] = useState(false);
  const [pageSource, setPageSource] = useState<SchedulePageSource | null>(null);
  const [pages, setPages] = useState<SchedulePageMapping[]>([]);
  const [pageDrafts, setPageDrafts] = useState<Record<number, string>>({});
  const [pageLoading, setPageLoading] = useState(false);
  const [pageBusy, setPageBusy] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch<unknown>("schedule/admin/imports");
      const result = parseScheduleImportListPayload(response);
      if (!result) throw new Error("La liste des emplois du temps reçue est invalide.");
      setImports(result.imports);
      setSelectedImportId((current) => {
        if (current && result.imports.some((item) => item.id === current && item.status === "review")) {
          return current;
        }
        return result.imports.find((item) => item.status === "review")?.id ?? "";
      });
      setActionTargetId((current) => {
        const candidates = result.imports.filter((item) =>
          ["review", "approved", "superseded"].includes(item.status)
        );
        return candidates.some((item) => item.id === current) ? current : candidates[0]?.id ?? "";
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedImportId) {
      setPageSource(null);
      setPages([]);
      setPageDrafts({});
      return;
    }
    let cancelled = false;
    setPageLoading(true);
    apiFetch<unknown>(
      `schedule/admin/imports/${selectedImportId}/pages`
    )
      .then((response) => {
        if (cancelled) return;
        const result = parseSchedulePageListPayload(response, selectedImportId);
        if (!result) throw new Error("L'index des pages reçu est invalide.");
        setPageSource(result.source);
        setPages(result.pages);
        setPageDrafts(Object.fromEntries(result.pages.map((page) => [page.pageNumber, page.subjectRef])));
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Indexation indisponible.");
      })
      .finally(() => {
        if (!cancelled) setPageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedImportId]);

  async function openPrivatePdf() {
    if (!selectedImportId) return;
    const popup = window.open("about:blank", "_blank");
    if (popup) {
      popup.opener = null;
      popup.document.title = "Ouverture du PDF";
      popup.document.body.textContent = "Ouverture du PDF privé...";
    }
    setError("");
    try {
      const response = await apiFetch<unknown>(`schedule/admin/imports/${selectedImportId}/file`);
      const result = parseSchedulePrivateFilePayload(response, SUPABASE_ORIGIN);
      if (!result) throw new Error("Le lien privé reçu est invalide.");
      if (popup) popup.location.href = result.url;
      else window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (reason) {
      popup?.close();
      setError(reason instanceof Error ? reason.message : "Ouverture du PDF impossible.");
    }
  }

  async function saveMapping(pageNumber: number) {
    if (!selectedImportId) return;
    setPageBusy(pageNumber);
    setError("");
    try {
      if (!pageSource) throw new Error("La version à indexer n'est plus disponible.");
      const subjectRef = normalizeDraftRef(pageDrafts[pageNumber] ?? "");
      const subjectType = pageSource.sourceKind === "classes" ? "class" : "teacher";
      const response = await apiFetch<unknown>(
        `schedule/admin/imports/${selectedImportId}/pages`,
        {
          method: "POST",
          body: JSON.stringify({ pageNumber, subjectRef }),
        }
      );
      const result = parseSchedulePageMutationPayload(response, {
        pageNumber,
        subjectType,
        subjectRef,
        reviewStatus: "draft",
      });
      if (!result) throw new Error("La confirmation d'indexation reçue est invalide.");
      setPages((current) => [
        ...current.filter((item) => item.pageNumber !== pageNumber),
        result.mapping,
      ].sort((left, right) => left.pageNumber - right.pageNumber));
      setPageDrafts((current) => ({ ...current, [pageNumber]: result.mapping.subjectRef }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Enregistrement impossible.");
    } finally {
      setPageBusy(null);
    }
  }

  async function verifyMapping(mapping: SchedulePageMapping) {
    if (!selectedImportId) return;
    setPageBusy(mapping.pageNumber);
    setError("");
    try {
      const response = await apiFetch<unknown>(
        `schedule/admin/imports/${selectedImportId}/pages/${mapping.id}/verify`,
        { method: "POST" }
      );
      const result = parseSchedulePageMutationPayload(response, {
        id: mapping.id,
        pageNumber: mapping.pageNumber,
        subjectType: mapping.subjectType,
        subjectRef: mapping.subjectRef,
        reviewStatus: "verified",
      });
      if (!result) throw new Error("La confirmation de vérification reçue est invalide.");
      setPages((current) => current.map((item) => item.id === mapping.id ? result.mapping : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Validation impossible.");
    } finally {
      setPageBusy(null);
    }
  }

  async function runPromotion() {
    const target = imports.find((item) => item.id === actionTargetId);
    if (!target) return;
    const action = target.status === "review"
      ? "approve"
      : target.status === "approved"
        ? "activate"
        : "rollback";
    setPromotionBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch<unknown>(`schedule/admin/imports/${target.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({
          justification: actionJustification,
          ...(action === "activate" ? { confirmation: "ACTIVER" } : {}),
          ...(action === "rollback" ? { confirmation: "RESTAURER" } : {}),
        }),
      });
      const expectedStatus = action === "approve" ? "approved" : "active";
      const result = parseScheduleImportMutationPayload(response, {
        id: target.id,
        freshStatus: expectedStatus,
        duplicateStatuses: [expectedStatus],
      });
      if (!result) throw new Error("La confirmation de l'action reçue est invalide.");
      setNotice(
        action === "approve"
          ? "Version approuvée. Une confirmation distincte reste nécessaire pour l'activer."
          : action === "activate"
            ? "Version activée. La version précédente reste disponible pour un retour arrière."
            : "Version restaurée. L'opération est conservée dans l'audit."
      );
      setActionJustification("");
      setActionConfirmation("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action impossible.");
    } finally {
      setPromotionBusy(false);
    }
  }

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
      const requestedImport = parseScheduleImportInput({
        sourceKind,
        schoolYear,
        title,
        purposeDescription,
        effectiveFrom,
        effectiveUntil: effectiveUntil || null,
        freshUntil,
        originalName: file.name,
        mimeType: SCHEDULE_IMPORT_MIME,
        sizeBytes: file.size,
      });
      const reservationResponse = await apiFetch<unknown>("schedule/admin/imports", {
        method: "POST",
        body: JSON.stringify(requestedImport),
      });
      const reservation = parseScheduleImportReservationPayload(reservationResponse, requestedImport);
      if (!reservation) throw new Error("La réservation de dépôt reçue est invalide.");
      const pdf = file.type === SCHEDULE_IMPORT_MIME
        ? file
        : new File([file], file.name, { type: SCHEDULE_IMPORT_MIME });
      await uploadPrivateFile(pdf, reservation.upload, setProgress);
      const confirmationResponse = await apiFetch<unknown>(`schedule/admin/imports/${reservation.import.id}/confirm`, {
        method: "POST",
      });
      const confirmation = parseScheduleImportMutationPayload(confirmationResponse, {
        id: reservation.import.id,
        freshStatus: "quarantined",
        duplicateStatuses: ["quarantined", "processing", "review", "approved", "active"],
      });
      if (!confirmation) throw new Error("La confirmation du dépôt reçue est invalide.");
      setNotice(
        confirmation.duplicate
          ? "Ce PDF avait déjà été reçu. Son état actuel a été relu sans créer un second contrôle."
          : "PDF reçu dans l'espace privé. Il reste bloqué jusqu'au contrôle antivirus, à l'indexation des pages et à l'approbation humaine."
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
  const reviewImports = imports.filter((item) => item.status === "review" && item.pageCount);
  const pageByNumber = new Map(pages.map((page) => [page.pageNumber, page]));
  const verifiedCount = pages.filter((page) => page.reviewStatus === "verified").length;
  const totalPages = pageSource?.pageCount ?? 0;
  const actionCandidates = imports.filter((item) =>
    ["review", "approved", "superseded"].includes(item.status)
  );
  const actionTarget = actionCandidates.find((item) => item.id === actionTargetId) ?? null;
  const actionKind = actionTarget?.status === "review"
    ? "approve"
    : actionTarget?.status === "approved"
      ? "activate"
      : actionTarget?.status === "superseded"
        ? "rollback"
        : null;
  const expectedConfirmation = actionKind === "activate"
    ? "ACTIVER"
    : actionKind === "rollback"
      ? "RESTAURER"
      : "";
  const mappingComplete = Boolean(
    actionTarget?.status !== "review" ||
    (
      actionTarget.id === selectedImportId &&
      actionTarget.pageCount &&
      verifiedCount === actionTarget.pageCount
    )
  );
  const canPromote = Boolean(
    actionTarget &&
    actionJustification.trim().length >= 20 &&
    mappingComplete &&
    (!expectedConfirmation || actionConfirmation === expectedConfirmation)
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
          Fin de validité <span className="font-normal text-slate-500">(facultatif)</span>
          <input className="field mt-1 bg-white" type="date" min={effectiveFrom} value={effectiveUntil} onChange={(event) => setEffectiveUntil(event.target.value)} />
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          À recontrôler avant le
          <input className="field mt-1 bg-white" type="date" min={effectiveFrom} max={effectiveUntil || undefined} required value={freshUntil} onChange={(event) => setFreshUntil(event.target.value)} />
          <small className="mt-1 block font-normal text-slate-500">Après cette date, l'agent refuse de répondre jusqu'à validation d'une source à jour.</small>
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
                  <span className="block">Recontrôle : {item.freshUntil ? formatDate(item.freshUntil) : "à définir avant activation"}</span>
                  <span className="mt-1 block break-words">{item.originalName}</span>
                </div>
              </article>
            ))}
            {imports.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">Aucun PDF n'a encore été déposé.</p> : null}
          </div>
        ) : null}
      </section>

      {actionCandidates.length > 0 ? (
        <section className="space-y-4 border-y border-slate-200 bg-white p-4 sm:p-6">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Validation de la version</h2>
            <p className="text-sm text-slate-500">Approbation, mise en service ou retour arrière avec preuve.</p>
          </div>
          <label className="block max-w-2xl text-sm font-medium text-slate-700">
            Version
            <select
              className="field mt-1 bg-white"
              value={actionTargetId}
              disabled={promotionBusy}
              onChange={(event) => {
                const nextId = event.target.value;
                const next = imports.find((item) => item.id === nextId);
                setActionTargetId(nextId);
                setActionConfirmation("");
                if (next?.status === "review") setSelectedImportId(nextId);
              }}
            >
              {actionCandidates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} · {STATUS[item.status].label}
                </option>
              ))}
            </select>
          </label>
          <label className="block max-w-2xl text-sm font-medium text-slate-700">
            Vérification effectuée
            <textarea
              className="field mt-1 bg-white"
              rows={3}
              minLength={20}
              maxLength={1000}
              value={actionJustification}
              disabled={promotionBusy}
              onChange={(event) => setActionJustification(event.target.value)}
              placeholder="Indiquez les contrôles réalisés et la raison de cette décision."
            />
          </label>
          {expectedConfirmation ? (
            <label className="block max-w-sm text-sm font-medium text-slate-700">
              Saisissez {expectedConfirmation}
              <input
                className="field mt-1 bg-white font-mono uppercase"
                value={actionConfirmation}
                disabled={promotionBusy}
                onChange={(event) => setActionConfirmation(event.target.value.toUpperCase())}
              />
            </label>
          ) : null}
          {actionTarget?.status === "review" && !mappingComplete ? (
            <p className="text-sm font-medium text-amber-800">
              Vérifiez d'abord les {actionTarget.pageCount ?? 0} pages de cette version.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void runPromotion()}
            disabled={promotionBusy || !canPromote}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            {promotionBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
            {actionKind === "approve" ? "Approuver" : actionKind === "activate" ? "Activer" : "Restaurer"}
          </button>
        </section>
      ) : null}

      <section className="space-y-4 border-t border-slate-200 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Index des pages</h2>
            <p className="text-sm text-slate-500">{verifiedCount} page{verifiedCount > 1 ? "s" : ""} vérifiée{verifiedCount > 1 ? "s" : ""} sur {totalPages}</p>
          </div>
          {selectedImportId ? (
            <button
              type="button"
              onClick={() => void openPrivatePdf()}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800"
            >
              <ExternalLink className="h-4 w-4" />
              Ouvrir le PDF (60 s)
            </button>
          ) : null}
        </div>

        {reviewImports.length > 0 ? (
          <label className="block max-w-xl text-sm font-medium text-slate-700">
            Version à indexer
            <select
              className="field mt-1 bg-white"
              value={selectedImportId}
              onChange={(event) => setSelectedImportId(event.target.value)}
            >
              {reviewImports.map((item) => (
                <option key={item.id} value={item.id}>{item.title} · {item.pageCount} pages</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="border-y border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            L'indexation apparaîtra après le contrôle antivirus et le comptage des pages.
          </p>
        )}

        {pageLoading ? (
          <div className="flex min-h-32 items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin text-emerald-700" /></div>
        ) : null}

        {!pageLoading && pageSource?.pageCount ? (
          <div className="border-y border-slate-200 bg-white">
            {Array.from({ length: pageSource.pageCount }, (_, index) => index + 1).map((pageNumber) => {
              const mapping = pageByNumber.get(pageNumber);
              const rowBusy = pageBusy === pageNumber;
              const draftRef = pageDrafts[pageNumber] ?? "";
              const canSave = Boolean(
                draftRef.trim() && normalizeDraftRef(draftRef) !== mapping?.subjectRef
              );
              return (
                <div
                  key={pageNumber}
                  className="grid min-w-0 gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:grid-cols-[52px_minmax(0,1fr)_auto] sm:items-center"
                >
                  <strong className="text-sm text-slate-600">P. {pageNumber}</strong>
                  <label className="min-w-0 text-xs font-medium text-slate-600">
                    <span className="sr-only">Référence opaque de la page {pageNumber}</span>
                    <input
                      className="field bg-white font-mono uppercase"
                      value={draftRef}
                      maxLength={80}
                      placeholder={pageSource.sourceKind === "classes" ? "CLASSE-2NDE-01" : "PERSONNEL-0042"}
                      disabled={rowBusy}
                      onChange={(event) => setPageDrafts((current) => ({
                        ...current,
                        [pageNumber]: event.target.value,
                      }))}
                    />
                  </label>
                  <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
                    {mapping?.reviewStatus === "verified" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <BadgeCheck className="h-4 w-4" /> Vérifiée
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void saveMapping(pageNumber)}
                      disabled={rowBusy || !canSave}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
                    >
                      {rowBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {mapping ? "Modifier" : "Enregistrer"}
                    </button>
                    {mapping && mapping.reviewStatus !== "verified" ? (
                      <button
                        type="button"
                        onClick={() => void verifyMapping(mapping)}
                        disabled={rowBusy}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-emerald-700 px-2.5 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Vérifier
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
