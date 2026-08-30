import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Clock3,
  FileText,
  FilePenLine,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import {
  COMMUNICATION_DOCUMENTS_UI_ENABLED,
  COMMUNICATIONS_UI_ENABLED,
} from "../../lib/feature-flags";
import { useAuth } from "../../lib/auth-context";
import { supabase } from "../../lib/supabase-browser";

type CommunicationRow = {
  id: string;
  status: string;
  visibility: string;
  category: string;
  templateKey: string | null;
  currentVersion: number;
  updatedAt: string;
  title: string;
  summary: string;
  structuredFacts: StructuredFacts;
  openQuestions: string[];
};

type StructuredFacts = {
  dates: string[];
  times: string[];
  places: string[];
  documents: string[];
  actions: string[];
};

type CommunicationDetail = CommunicationRow & {
  bodyMarkdown: string;
};

type AssistSuggestion = Pick<
  CommunicationDetail,
  "title" | "summary" | "bodyMarkdown" | "structuredFacts" | "openQuestions"
> & { reviewNotes: string[] };

type CommunicationsPayload = { communications: CommunicationRow[] };

type CommunicationDocument = {
  id: string;
  communicationId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  analysisError: string | null;
  uploadedAt: string | null;
  analyzedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CreatePayload = {
  communication: Pick<CommunicationRow, "id" | "status" | "visibility" | "currentVersion" | "updatedAt">;
  duplicate: boolean;
};

type CommunicationTemplate = {
  id: string | null;
  templateKey: string;
  label: string;
  defaultCategory: string;
  titleHint: string;
  summaryHint: string;
  bodyMarkdown: string;
  active: boolean;
  version: number;
  updatedAt: string | null;
  customized: boolean;
};

const CATEGORY_OPTIONS = [
  { value: "information", label: "Information" },
  { value: "rentree", label: "Rentrée" },
  { value: "document", label: "Document" },
  { value: "evenement", label: "Événement" },
  { value: "urgent", label: "Urgent" },
  { value: "rappel", label: "Rappel" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  review: "À vérifier",
  approved: "Validé",
  published: "Publié",
  archived: "Archivé",
};

const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  reserved: "Réservé",
  uploaded: "Reçu",
  quarantined: "En quarantaine",
  processing: "Analyse en cours",
  review: "À vérifier",
  used: "Utilisé",
  rejected: "Refusé",
  failed: "Échec d’analyse",
};

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function communicationDocumentMime(file: File): "application/pdf" | typeof DOCX_MIME | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") && (!file.type || file.type === "application/pdf")) return "application/pdf";
  if (name.endsWith(".docx") && (!file.type || file.type === DOCX_MIME)) return DOCX_MIME;
  return null;
}

function fileSizeLabel(sizeBytes: number): string {
  return sizeBytes < 1024 * 1024
    ? `${Math.max(1, Math.round(sizeBytes / 1024))} Ko`
    : `${(sizeBytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function emptyDraft() {
  return {
    title: "",
    summary: "",
    bodyMarkdown: "",
    category: "information",
    templateKey: null as string | null,
    structuredFacts: { dates: [], times: [], places: [], documents: [], actions: [] } as StructuredFacts,
    openQuestions: [] as string[],
  };
}

const FACT_LABELS: Array<{ key: keyof StructuredFacts; label: string }> = [
  { key: "dates", label: "Dates" },
  { key: "times", label: "Horaires" },
  { key: "places", label: "Lieux" },
  { key: "documents", label: "Documents" },
  { key: "actions", label: "Actions" },
];

export default function CommunicationsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CommunicationRow[]>([]);
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [documents, setDocuments] = useState<CommunicationDocument[]>([]);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentPickerKey, setDocumentPickerKey] = useState(0);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<CommunicationDetail | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(COMMUNICATIONS_UI_ENABLED);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assisting, setAssisting] = useState(false);
  const [assistAction, setAssistAction] = useState<"structure" | "correct" | "simplify">("structure");
  const [reviewNotes, setReviewNotes] = useState<string[]>([]);
  const [requestingReview, setRequestingReview] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!COMMUNICATIONS_UI_ENABLED) return;
    setLoading(true);
    setError("");
    try {
      const [communications, templatePayload, documentPayload] = await Promise.all([
        apiFetch<CommunicationsPayload>("communications/admin"),
        apiFetch<{ templates: CommunicationTemplate[] }>("communications/admin/templates"),
        COMMUNICATION_DOCUMENTS_UI_ENABLED
          ? apiFetch<{ documents: CommunicationDocument[] }>("communications/admin/documents")
          : Promise.resolve({ documents: [] }),
      ]);
      setRows(communications.communications);
      setTemplates(templatePayload.templates);
      setDocuments(documentPayload.documents);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Communications indisponibles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId || !COMMUNICATIONS_UI_ENABLED) {
      setSelectedDetail(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    setError("");
    void apiFetch<{ communication: CommunicationDetail }>(`communications/admin/${selectedId}`)
      .then((payload) => {
        if (active) setSelectedDetail(payload.communication);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Lecture impossible.");
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => { active = false; };
  }, [selectedId]);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId]
  );
  const canManageTemplates = user?.role === "superadmin" || user?.role === "proviseur";

  function startNew() {
    setDraft(emptyDraft());
    setEditingId(null);
    setSelectedId(null);
    setSelectedDetail(null);
    setReviewNotes([]);
    setNotice("");
  }

  function startEdit() {
    if (!selectedDetail || selectedDetail.status !== "draft") return;
    setDraft({
      title: selectedDetail.title,
      summary: selectedDetail.summary,
      bodyMarkdown: selectedDetail.bodyMarkdown,
      category: selectedDetail.category,
      templateKey: selectedDetail.templateKey,
      structuredFacts: selectedDetail.structuredFacts,
      openQuestions: selectedDetail.openQuestions,
    });
    setEditingId(selectedDetail.id);
    setSelectedId(null);
    setReviewNotes([]);
    setNotice("");
  }

  function applyTemplate(templateKey: string) {
    if (!templateKey) {
      setDraft((current) => ({ ...current, templateKey: null }));
      return;
    }
    const template = templates.find((item) => item.templateKey === templateKey);
    if (!template) return;
    setDraft({
      templateKey: template.templateKey,
      category: template.defaultCategory,
      title: template.titleHint,
      summary: template.summaryHint,
      bodyMarkdown: template.bodyMarkdown,
      structuredFacts: { dates: [], times: [], places: [], documents: [], actions: [] },
      openQuestions: [],
    });
  }

  async function assistDraft() {
    setAssisting(true);
    setError("");
    setNotice("");
    try {
      const payload = await apiFetch<{ suggestion: AssistSuggestion }>("communications/admin/assist", {
        method: "POST",
        body: JSON.stringify({
          action: assistAction,
          title: draft.title,
          summary: draft.summary,
          bodyMarkdown: draft.bodyMarkdown,
          category: draft.category,
          templateKey: draft.templateKey,
        }),
      });
      const { reviewNotes: notes, ...suggestedDraft } = payload.suggestion;
      setDraft((current) => ({ ...current, ...suggestedDraft }));
      setReviewNotes(notes);
      setNotice("La proposition est prête. Vérifiez chaque information avant de l’enregistrer.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Aide à la rédaction indisponible.");
    } finally {
      setAssisting(false);
    }
  }

  function removeFact(group: keyof StructuredFacts, index: number) {
    setDraft((current) => ({
      ...current,
      structuredFacts: {
        ...current.structuredFacts,
        [group]: current.structuredFacts[group].filter((_, itemIndex) => itemIndex !== index),
      },
    }));
  }

  async function requestReview() {
    if (!selectedDetail) return;
    setRequestingReview(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(`communications/admin/${selectedDetail.id}/review`, {
        method: "POST",
        body: JSON.stringify({ confirmation: "VERIFIER" }),
      });
      setNotice("La communication est transmise pour vérification humaine.");
      await load();
      setSelectedDetail((current) => current ? { ...current, status: "review" } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Demande de vérification impossible.");
    } finally {
      setRequestingReview(false);
    }
  }

  async function uploadDocument() {
    if (!documentFile || !COMMUNICATION_DOCUMENTS_UI_ENABLED) return;
    const mimeType = communicationDocumentMime(documentFile);
    if (!mimeType || documentFile.size < 1 || documentFile.size > 10 * 1024 * 1024) {
      setError("Choisissez un fichier PDF ou DOCX de 10 Mo maximum.");
      return;
    }
    setUploadingDocument(true);
    setError("");
    setNotice("");
    try {
      const reserve = await apiFetch<{
        document: CommunicationDocument;
        upload: { bucket: string; path: string; token: string };
      }>("communications/admin/documents", {
        method: "POST",
        body: JSON.stringify({
          originalName: documentFile.name,
          mimeType,
          sizeBytes: documentFile.size,
        }),
      });
      const uploaded = await supabase.storage
        .from(reserve.upload.bucket)
        .uploadToSignedUrl(reserve.upload.path, reserve.upload.token, documentFile, { contentType: mimeType });
      if (uploaded.error) throw new Error("Le transfert privé du document a échoué.");
      await apiFetch(`communications/admin/documents/${reserve.document.id}/confirm`, { method: "POST" });
      setDocumentFile(null);
      setDocumentPickerKey((value) => value + 1);
      setNotice("Le document est placé en quarantaine pour analyse.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Dépôt du document impossible.");
    } finally {
      setUploadingDocument(false);
    }
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTemplate) return;
    setSavingTemplate(true);
    setError("");
    setNotice("");
    try {
      await apiFetch("communications/admin/templates", {
        method: "PATCH",
        body: JSON.stringify({
          templateKey: editingTemplate.templateKey,
          label: editingTemplate.label,
          defaultCategory: editingTemplate.defaultCategory,
          titleHint: editingTemplate.titleHint,
          summaryHint: editingTemplate.summaryHint,
          bodyMarkdown: editingTemplate.bodyMarkdown,
          active: editingTemplate.active,
        }),
      });
      setEditingTemplate(null);
      setNotice("Le modèle est enregistré avec une nouvelle version.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Modification du modèle impossible.");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = await apiFetch<CreatePayload>(
        editingId ? `communications/admin/${editingId}` : "communications/admin",
        {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({ sourceType: "direct_text", ...draft }),
      });
      setNotice(
        payload.duplicate
          ? "Cette version existait déjà. Aucun doublon n’a été créé."
          : editingId ? "Une nouvelle version privée est enregistrée." : "Le brouillon privé est enregistré."
      );
      setDraft(emptyDraft());
      setEditingId(null);
      setReviewNotes([]);
      setSelectedId(payload.communication.id);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  if (!COMMUNICATIONS_UI_ENABLED) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold text-emerald-700">Administration</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Communications</h1>
        </header>
        <section className="flex items-start gap-3 border-l-4 border-slate-400 bg-white p-4 shadow-sm">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
          <div>
            <h2 className="font-bold text-slate-950">Module fermé</h2>
            <p className="mt-1 text-sm text-slate-600">
              Aucun brouillon, aucune publication et aucun envoi ne sont accessibles.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Administration</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Communications</h1>
          <p className="mt-2 text-sm text-slate-600">Brouillons privés de l’établissement</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          title="Actualiser"
          aria-label="Actualiser"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      <ol className="grid gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 sm:grid-cols-3" aria-label="Étapes de préparation">
        <li className="flex min-h-16 items-center gap-3 bg-emerald-700 px-4 py-3 text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-bold text-emerald-800">1</span>
          <span><strong className="block text-sm">Déposer</strong><small className="text-white/75">Saisie privée</small></span>
        </li>
        <li className="flex min-h-16 items-center gap-3 bg-white px-4 py-3 text-slate-700">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-700 text-sm font-bold text-emerald-800">2</span>
          <span><strong className="block text-sm">Vérifier</strong><small className="text-slate-500">Relecture humaine</small></span>
        </li>
        <li className="flex min-h-16 items-center gap-3 bg-white px-4 py-3 text-slate-400">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-sm font-bold">3</span>
          <span><strong className="block text-sm">Publier et informer</strong><small>Verrouillé</small></span>
        </li>
      </ol>

      {error ? <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

      <section className="border-y border-slate-200 py-5" aria-labelledby="communication-documents-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Source</p>
            <h2 id="communication-documents-title" className="mt-1 text-lg font-bold text-slate-950">Documents à transformer</h2>
            <p className="mt-1 text-sm text-slate-500">PDF ou DOCX, 10 Mo maximum</p>
          </div>
          {COMMUNICATION_DOCUMENTS_UI_ENABLED ? (
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <label className="inline-flex min-h-11 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="max-w-56 truncate">{documentFile?.name ?? "Choisir un document"}</span>
                <input key={documentPickerKey} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} className="sr-only" />
              </label>
              <button type="button" onClick={() => void uploadDocument()} disabled={!documentFile || uploadingDocument} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {uploadingDocument ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Déposer
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><LockKeyhole className="h-4 w-4" /> Dépôt fermé</span>
          )}
        </div>
        {COMMUNICATION_DOCUMENTS_UI_ENABLED && documents.length > 0 ? (
          <div className="mt-5 divide-y divide-slate-200 border-y border-slate-200 bg-white">
            {documents.map((document) => (
              <div key={document.id} className="flex min-w-0 flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">{document.originalName}</p>
                  <p className="mt-1 text-xs text-slate-500">{fileSizeLabel(document.sizeBytes)} · {dateLabel(document.createdAt)}</p>
                  {document.analysisError ? <p className="mt-1 break-words text-xs text-red-700">{document.analysisError}</p> : null}
                </div>
                <span className="shrink-0 text-xs font-semibold text-slate-600">{DOCUMENT_STATUS_LABELS[document.status] ?? document.status}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)]">
        <section aria-labelledby="communications-list-title" className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 id="communications-list-title" className="font-bold text-slate-950">Brouillons</h2>
              <p className="text-xs text-slate-500">{rows.length} élément{rows.length > 1 ? "s" : ""}</p>
            </div>
            <button type="button" onClick={startNew} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" /> Nouveau
            </button>
          </div>

          <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
            {loading ? <div className="flex min-h-36 items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin text-emerald-700" /></div> : null}
            {!loading && rows.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">Aucun brouillon</p> : null}
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => { setSelectedId(row.id); setEditingId(null); setReviewNotes([]); }}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${selectedId === row.id ? "bg-emerald-50" : "hover:bg-slate-50"}`}
              >
                <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm text-slate-950">{row.title}</strong>
                  <small className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-500">
                    <span>{STATUS_LABELS[row.status] ?? row.status}</span>
                    <span>v{row.currentVersion}</span>
                    <span>{dateLabel(row.updatedAt)}</span>
                  </small>
                </span>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
        </section>

        {selected ? (
          <section className="min-w-0 border-t-4 border-emerald-700 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="selected-communication-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-emerald-700">{STATUS_LABELS[selected.status] ?? selected.status}</p>
                <h2 id="selected-communication-title" className="mt-1 break-words text-xl font-bold text-slate-950">{selected.title}</h2>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"><LockKeyhole className="h-3.5 w-3.5" /> Privé</span>
            </div>
            {selected.summary ? <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-700">{selected.summary}</p> : null}
            <dl className="mt-6 grid gap-3 border-y border-slate-200 py-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div><dt className="text-slate-500">Catégorie</dt><dd className="mt-1 font-semibold text-slate-950">{CATEGORY_OPTIONS.find((item) => item.value === selected.category)?.label ?? selected.category}</dd></div>
              <div><dt className="text-slate-500">Modèle</dt><dd className="mt-1 font-semibold text-slate-950">{templates.find((item) => item.templateKey === selected.templateKey)?.label ?? "Sans modèle"}</dd></div>
              <div><dt className="text-slate-500">Visibilité</dt><dd className="mt-1 font-semibold text-slate-950">Interne</dd></div>
              <div><dt className="text-slate-500">Version</dt><dd className="mt-1 font-semibold text-slate-950">{selected.currentVersion}</dd></div>
            </dl>
            {detailLoading ? <div className="flex min-h-28 items-center justify-center"><LoaderCircle className="h-6 w-6 animate-spin text-emerald-700" /></div> : null}
            {selectedDetail && !detailLoading ? (
              <div className="mt-5 space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-950">Message</h3>
                  <div className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap border-y border-slate-200 py-4 text-sm leading-6 text-slate-700">{selectedDetail.bodyMarkdown}</div>
                </div>
                {FACT_LABELS.some(({ key }) => selectedDetail.structuredFacts[key].length > 0) ? (
                  <div>
                    <h3 className="text-sm font-bold text-slate-950">Éléments repérés</h3>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      {FACT_LABELS.filter(({ key }) => selectedDetail.structuredFacts[key].length > 0).map(({ key, label }) => (
                        <div key={key} className="border-l-2 border-emerald-600 pl-3">
                          <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                          <ul className="mt-1 space-y-1 text-sm text-slate-700">{selectedDetail.structuredFacts[key].map((fact) => <li key={fact}>{fact}</li>)}</ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {selectedDetail.openQuestions.length > 0 ? (
                  <div className="border-l-4 border-amber-400 bg-amber-50 p-4">
                    <h3 className="text-sm font-bold text-amber-950">Informations à confirmer</h3>
                    <ul className="mt-2 space-y-1 text-sm text-amber-900">{selectedDetail.openQuestions.map((question) => <li key={question}>{question}</li>)}</ul>
                  </div>
                ) : null}
                {selectedDetail.status === "draft" ? (
                  <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                    <button type="button" onClick={startEdit} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"><Pencil className="h-4 w-4" /> Modifier</button>
                    <button type="button" onClick={() => void requestReview()} disabled={requestingReview || selectedDetail.openQuestions.length > 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                      {requestingReview ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Demander la vérification
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="mt-5 flex items-center gap-2 text-sm text-slate-500"><Clock3 className="h-4 w-4" /> Mis à jour {dateLabel(selected.updatedAt)}</div>
          </section>
        ) : (
          <form onSubmit={submit} className="min-w-0 space-y-5 border-t-4 border-emerald-700 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <FilePenLine className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div><h2 className="font-bold text-slate-950">{editingId ? "Modifier le brouillon" : "Nouvelle communication"}</h2><p className="mt-1 text-sm text-slate-500">{editingId ? "Une nouvelle version sera conservée" : "Enregistrée comme brouillon interne"}</p></div>
            </div>

            <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="block text-sm font-semibold text-slate-800">
                Modèle
                <select value={draft.templateKey ?? ""} onChange={(event) => applyTemplate(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100">
                  <option value="">Sans modèle</option>
                  {templates.filter((template) => template.active).map((template) => <option key={template.templateKey} value={template.templateKey}>{template.label}</option>)}
                </select>
              </label>
              {canManageTemplates && draft.templateKey ? (
                <button type="button" onClick={() => setEditingTemplate(templates.find((item) => item.templateKey === draft.templateKey) ?? null)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                  <Pencil className="h-4 w-4" /> Modifier
                </button>
              ) : null}
            </div>

            <label className="block text-sm font-semibold text-slate-800">
              Titre
              <input required minLength={2} maxLength={180} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-800">
                Catégorie
                <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100">
                  {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                Résumé
                <input maxLength={1000} value={draft.summary} onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              </label>
            </div>

            <label className="block text-sm font-semibold text-slate-800">
              Message
              <textarea required maxLength={100000} rows={12} value={draft.bodyMarkdown} onChange={(event) => setDraft((current) => ({ ...current, bodyMarkdown: event.target.value }))} className="mt-1.5 w-full resize-y rounded-md border border-slate-300 px-3 py-2.5 font-normal leading-6 text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
            </label>

            <section className="border-y border-slate-200 py-4" aria-labelledby="communication-assist-title">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 id="communication-assist-title" className="flex items-center gap-2 text-sm font-bold text-slate-950"><Sparkles className="h-4 w-4 text-emerald-700" /> Aide à la rédaction</h3>
                  <p className="mt-1 text-xs text-slate-500">La proposition ne remplace jamais votre vérification.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="grid grid-cols-3 rounded-md border border-slate-300 bg-white p-0.5" aria-label="Type d’aide">
                    {([['structure', 'Structurer'], ['correct', 'Corriger'], ['simplify', 'Simplifier']] as const).map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setAssistAction(value)} aria-pressed={assistAction === value} className={`min-h-9 px-2 text-xs font-semibold ${assistAction === value ? "rounded bg-slate-950 text-white" : "text-slate-600"}`}>{label}</button>
                    ))}
                  </div>
                  <button type="button" onClick={() => void assistDraft()} disabled={assisting || draft.title.trim().length < 2 || draft.bodyMarkdown.trim().length === 0} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {assisting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Préparer
                  </button>
                </div>
              </div>
              {reviewNotes.length > 0 ? (
                <ul className="mt-3 space-y-1 border-l-2 border-emerald-600 pl-3 text-xs text-slate-600">{reviewNotes.map((note) => <li key={note}>{note}</li>)}</ul>
              ) : null}
            </section>

            {FACT_LABELS.some(({ key }) => draft.structuredFacts[key].length > 0) ? (
              <section aria-labelledby="draft-facts-title">
                <h3 id="draft-facts-title" className="text-sm font-bold text-slate-950">Éléments repérés à vérifier</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {FACT_LABELS.filter(({ key }) => draft.structuredFacts[key].length > 0).map(({ key, label }) => (
                    <div key={key} className="min-w-0 border-l-2 border-emerald-600 pl-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                      <ul className="mt-1 space-y-1.5">
                        {draft.structuredFacts[key].map((fact, index) => (
                          <li key={`${fact}-${index}`} className="flex items-start justify-between gap-2 text-sm text-slate-700">
                            <span className="min-w-0 break-words">{fact}</span>
                            <button type="button" onClick={() => removeFact(key, index)} title="Retirer" aria-label={`Retirer ${fact}`} className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-slate-500 hover:text-red-700"><X className="h-4 w-4" /></button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {draft.openQuestions.length > 0 ? (
              <section className="border-l-4 border-amber-400 bg-amber-50 p-4" aria-labelledby="draft-questions-title">
                <h3 id="draft-questions-title" className="text-sm font-bold text-amber-950">Informations à confirmer</h3>
                <p className="mt-1 text-xs text-amber-800">Corrigez le message, puis retirez chaque question lorsque vous avez vérifié l’information.</p>
                <ul className="mt-3 space-y-2">
                  {draft.openQuestions.map((question, index) => (
                    <li key={`${question}-${index}`} className="flex items-start justify-between gap-2 text-sm text-amber-950">
                      <span className="min-w-0 break-words">{question}</span>
                      <button type="button" onClick={() => setDraft((current) => ({ ...current, openQuestions: current.openQuestions.filter((_, itemIndex) => itemIndex !== index) }))} title="Marquer comme vérifié" aria-label={`Marquer comme vérifié : ${question}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-300 bg-white text-amber-900"><Check className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex items-center gap-2 text-xs text-slate-500"><LockKeyhole className="h-4 w-4" /> Privé jusqu’à validation</span>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                {editingId ? <button type="button" onClick={startNew} className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Annuler</button> : null}
                <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editingId ? "Enregistrer une version" : "Enregistrer"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {canManageTemplates ? (
        <section className="space-y-4 border-y border-slate-200 py-5" aria-labelledby="communication-templates-title">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold text-emerald-700">Direction</p>
              <h2 id="communication-templates-title" className="mt-1 text-lg font-bold text-slate-950">Modèles de rédaction</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {templates.map((template) => (
                <button key={template.templateKey} type="button" onClick={() => setEditingTemplate({ ...template })} className={`rounded-md border px-3 py-2 text-sm font-semibold ${editingTemplate?.templateKey === template.templateKey ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700"}`}>
                  {template.label}
                </button>
              ))}
            </div>
          </div>

          {editingTemplate ? (
            <form onSubmit={saveTemplate} className="grid gap-4 border-l-4 border-emerald-700 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div><strong className="text-slate-950">{editingTemplate.label}</strong><p className="text-xs text-slate-500">{editingTemplate.customized ? `Version ${editingTemplate.version}` : "Modèle d’origine"}</p></div>
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={editingTemplate.active} onChange={(event) => setEditingTemplate((current) => current ? { ...current, active: event.target.checked } : current)} className="h-4 w-4 accent-emerald-700" /> Actif</label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-800">Nom<input required minLength={2} maxLength={80} value={editingTemplate.label} onChange={(event) => setEditingTemplate((current) => current ? { ...current, label: event.target.value } : current)} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" /></label>
                <label className="text-sm font-semibold text-slate-800">Catégorie<select value={editingTemplate.defaultCategory} onChange={(event) => setEditingTemplate((current) => current ? { ...current, defaultCategory: event.target.value } : current)} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">{CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              </div>
              <label className="text-sm font-semibold text-slate-800">Titre proposé<input maxLength={180} value={editingTemplate.titleHint} onChange={(event) => setEditingTemplate((current) => current ? { ...current, titleHint: event.target.value } : current)} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" /></label>
              <label className="text-sm font-semibold text-slate-800">Résumé proposé<textarea maxLength={1000} rows={2} value={editingTemplate.summaryHint} onChange={(event) => setEditingTemplate((current) => current ? { ...current, summaryHint: event.target.value } : current)} className="mt-1.5 w-full resize-y rounded-md border border-slate-300 px-3 py-2 font-normal" /></label>
              <label className="text-sm font-semibold text-slate-800">Structure du message<textarea required maxLength={20000} rows={7} value={editingTemplate.bodyMarkdown} onChange={(event) => setEditingTemplate((current) => current ? { ...current, bodyMarkdown: event.target.value } : current)} className="mt-1.5 w-full resize-y rounded-md border border-slate-300 px-3 py-2 font-normal leading-6" /></label>
              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setEditingTemplate(null)} className="min-h-10 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Annuler</button>
                <button type="submit" disabled={savingTemplate} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{savingTemplate ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer le modèle</button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 sm:grid-cols-2" aria-label="Actions verrouillées">
        <div className="flex items-center gap-3 bg-white px-4 py-3 text-slate-500"><Check className="h-4 w-4" /><span className="text-sm"><strong className="block text-slate-700">Vérification humaine</strong>Disponible lorsque les points ouverts sont résolus</span></div>
        <div className="flex items-center gap-3 bg-white px-4 py-3 text-slate-500"><Send className="h-4 w-4" /><span className="text-sm"><strong className="block text-slate-700">Publication et envoi</strong>Aucune action disponible</span></div>
      </section>
    </div>
  );
}
