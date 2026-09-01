import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock3,
  Eye,
  ExternalLink,
  FileText,
  FilePenLine,
  Inbox,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import {
  COMMUNICATION_DOCUMENTS_UI_ENABLED,
  COMMUNICATION_PUBLICATION_UI_ENABLED,
  COMMUNICATIONS_UI_ENABLED,
} from "../../lib/feature-flags";
import { useAuth } from "../../lib/auth-context";
import { supabase } from "../../lib/supabase-browser";
import {
  buildCommunicationEmailPreview,
  safeCommunicationPreviewHref,
} from "../../../shared/communication-email-preview";
import {
  parseCommunicationDocumentConfirmationPayload,
  parseCommunicationDocumentListPayload,
  parseCommunicationDocumentReservationPayload,
  type CommunicationDocumentPayload,
} from "../../../shared/communication-document-payload";
import {
  parseCommunicationFailuresPayload,
  parseCommunicationInboundPayload,
  parseCommunicationsPayload,
  parseCommunicationTemplatesPayload,
  type CommunicationFailure,
  type CommunicationInbound,
  type CommunicationRow,
  type CommunicationTemplate,
  type StructuredFacts,
} from "../../../shared/communication-admin-payload";
import {
  parseCommunicationApprovalPayload,
  parseCommunicationAssistPayload,
  parseCommunicationDetailPayload,
  parseCommunicationDraftMutationPayload,
  parseCommunicationPublicationPayload,
  parseCommunicationRetryPayload,
  parseCommunicationReviewPayload,
  parseCommunicationTemplateMutationPayload,
  type CommunicationDetail,
  type CommunicationVersion,
} from "../../../shared/communication-admin-action-payload";

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
  cancelled: "Annulé",
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

const FAILURE_CODE_LABELS: Record<string, string> = {
  provider_timeout: "Délai de réponse dépassé",
  provider_unavailable: "Service temporairement indisponible",
  provider_rate_limited: "Trop de demandes simultanées",
  network_error: "Connexion interrompue",
  worker_interrupted: "Traitement interrompu",
  configuration_missing: "Configuration manquante",
  authorization_failed: "Autorisation refusée",
  scope_invalid: "Périmètre de sécurité invalide",
  content_missing: "Version officielle introuvable",
  provider_rejected: "Message refusé",
  unknown_failure: "Échec à vérifier",
};

const INBOUND_CLASSIFICATION_LABELS: Record<string, string> = {
  withdrawal: "Demande de retrait",
  contact_correction: "Coordonnées à corriger",
  question: "Question",
  free_reply: "Réponse libre",
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

function SafeCommunicationMarkdown({ bodyMarkdown }: { bodyMarkdown: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h3 className="mt-5 text-lg font-bold text-slate-950">{children}</h3>,
        h2: ({ children }) => <h3 className="mt-5 text-base font-bold text-slate-950">{children}</h3>,
        h3: ({ children }) => <h4 className="mt-4 font-bold text-slate-950">{children}</h4>,
        p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
        ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-slate-300 pl-3 text-slate-600">{children}</blockquote>,
        a: ({ href, children }) => {
          const safeHref = safeCommunicationPreviewHref(href);
          return safeHref
            ? <a href={safeHref} target="_blank" rel="noreferrer noopener" className="font-semibold text-emerald-700 underline underline-offset-2">{children}</a>
            : <span className="font-semibold text-slate-700 underline decoration-dotted underline-offset-2" title="Lien non affiché dans l’aperçu">{children}</span>;
        },
        img: ({ alt }) => <span className="block border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">Image non affichée{alt ? ` : ${alt}` : ""}</span>,
        table: ({ children }) => <div className="max-w-full overflow-x-auto"><table className="min-w-full border-collapse text-left text-xs">{children}</table></div>,
        th: ({ children }) => <th className="border border-slate-200 bg-slate-50 px-2 py-1 font-bold">{children}</th>,
        td: ({ children }) => <td className="border border-slate-200 px-2 py-1">{children}</td>,
      }}
    >
      {bodyMarkdown}
    </ReactMarkdown>
  );
}

function CommunicationPagePreview({
  title,
  summary,
  bodyMarkdown,
}: Pick<CommunicationDetail, "title" | "summary" | "bodyMarkdown">) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm" aria-label="Aperçu du message">
      <header className="bg-slate-950 px-4 py-4 text-white sm:px-6">
        <p className="text-xs font-semibold uppercase text-emerald-300">Lycée Blaise Cendrars · Sevran</p>
        <p className="mt-1 text-sm text-white/70">Communication de l’établissement</p>
      </header>
      <div className="px-4 py-5 sm:px-6 sm:py-6">
        <h2 className="break-words text-xl font-bold text-slate-950">{title.trim() || "Titre du message"}</h2>
        {summary.trim() ? <p className="mt-2 whitespace-pre-line border-l-2 border-emerald-600 pl-3 text-sm leading-6 text-slate-600">{summary}</p> : null}
        <div className="mt-6 space-y-3 break-words text-sm leading-7 text-slate-800">
          <SafeCommunicationMarkdown bodyMarkdown={bodyMarkdown.trim() || "Le contenu du message apparaîtra ici."} />
        </div>
      </div>
      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 sm:px-6">
        Aperçu de la page · aucun destinataire sélectionné
      </footer>
    </section>
  );
}

function CommunicationEmailPreview({
  title,
  summary,
  bodyMarkdown,
}: Pick<CommunicationDetail, "title" | "summary" | "bodyMarkdown">) {
  const preview = buildCommunicationEmailPreview({ title, summary, bodyMarkdown });
  return (
    <section className="overflow-hidden rounded-md border border-slate-300 bg-slate-100 shadow-sm" aria-label="Aperçu email">
      <header className="flex flex-col gap-3 border-b border-slate-300 bg-white px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-950"><Mail className="h-4 w-4 text-emerald-700" /> Aperçu email</div>
        <dl className="grid min-w-0 gap-2 text-xs sm:grid-cols-[4rem_minmax(0,1fr)]">
          <dt className="font-semibold text-slate-500">De</dt><dd className="break-words font-semibold text-slate-800">{preview.senderName}</dd>
          <dt className="font-semibold text-slate-500">À</dt><dd className="break-words text-slate-600">Aucun destinataire sélectionné</dd>
          <dt className="font-semibold text-slate-500">Objet</dt><dd className="break-words font-semibold text-slate-950">{preview.subject}</dd>
          <dt className="font-semibold text-slate-500">Pré-en-tête</dt><dd className="break-words text-slate-600">{preview.preheader}</dd>
        </dl>
      </header>
      <div className="p-3 sm:p-6">
        <article className="mx-auto max-w-[680px] overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="border-t-4 border-emerald-700 px-4 py-5 sm:px-8 sm:py-7">
            <p className="text-xs font-bold uppercase text-emerald-700">Lycée Blaise Cendrars · Sevran</p>
            <p className="sr-only">{preview.preheader}</p>
            <h2 className="mt-3 break-words text-xl font-bold text-slate-950 sm:text-2xl">{preview.subject}</h2>
            {summary.trim() ? <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{summary}</p> : null}
            <div className="mt-6 space-y-3 break-words text-sm leading-7 text-slate-800">
              <SafeCommunicationMarkdown bodyMarkdown={preview.bodyMarkdown} />
            </div>
            <div className="mt-7 border-l-2 border-slate-300 pl-3 text-xs leading-5 text-slate-500">
              Le lien officiel sera ajouté après publication. Cet aperçu ne permet aucun envoi.
            </div>
          </div>
          <footer className="border-t border-slate-200 bg-slate-50 px-4 py-4 text-xs leading-5 text-slate-500 sm:px-8">
            Message institutionnel · Réponse et retrait gérés après activation du pilote
          </footer>
        </article>
      </div>
    </section>
  );
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
  const [documents, setDocuments] = useState<CommunicationDocumentPayload[]>([]);
  const [failures, setFailures] = useState<CommunicationFailure[]>([]);
  const [inbound, setInbound] = useState<CommunicationInbound[]>([]);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentPickerKey, setDocumentPickerKey] = useState(0);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<CommunicationDetail | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<CommunicationVersion[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [composerMode, setComposerMode] = useState<"write" | "page" | "email">("write");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(COMMUNICATIONS_UI_ENABLED);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assisting, setAssisting] = useState(false);
  const [assistAction, setAssistAction] = useState<"structure" | "correct" | "simplify">("structure");
  const [reviewNotes, setReviewNotes] = useState<string[]>([]);
  const [reviewVisibility, setReviewVisibility] = useState<"internal" | "public">("internal");
  const [requestingReview, setRequestingReview] = useState(false);
  const [approving, setApproving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [confirmingRetryId, setConfirmingRetryId] = useState<string | null>(null);
  const [retryingFailureId, setRetryingFailureId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canManageTemplates = user?.role === "superadmin" || user?.role === "proviseur";

  const load = useCallback(async () => {
    if (!COMMUNICATIONS_UI_ENABLED) return;
    setLoading(true);
    setError("");
    try {
      const [communicationResponse, templateResponse, documentResponse, failureResponse, inboundResponse] = await Promise.all([
        apiFetch<unknown>("communications/admin"),
        apiFetch<unknown>("communications/admin/templates"),
        COMMUNICATION_DOCUMENTS_UI_ENABLED
          ? apiFetch<unknown>("communications/admin/documents")
          : Promise.resolve({ documents: [] }),
        canManageTemplates
          ? apiFetch<unknown>("communications/admin/failures")
          : Promise.resolve({ failures: [] }),
        apiFetch<unknown>("communications/admin/inbound"),
      ]);
      const communicationPayload = parseCommunicationsPayload(communicationResponse);
      const templatePayload = parseCommunicationTemplatesPayload(templateResponse);
      const documentPayload = parseCommunicationDocumentListPayload(documentResponse);
      const failurePayload = parseCommunicationFailuresPayload(failureResponse);
      const inboundPayload = parseCommunicationInboundPayload(inboundResponse);
      if (!communicationPayload || !templatePayload || !documentPayload || !failurePayload || !inboundPayload) {
        throw new Error("Les données de communication reçues sont invalides. Aucun résultat n’a été remplacé.");
      }
      setRows(communicationPayload.communications);
      setTemplates(templatePayload.templates);
      setDocuments(documentPayload.documents);
      setFailures(failurePayload.failures);
      setInbound(inboundPayload.inbound);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Communications indisponibles.");
    } finally {
      setLoading(false);
    }
  }, [canManageTemplates]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId || !COMMUNICATIONS_UI_ENABLED) {
      setSelectedDetail(null);
      setSelectedVersions([]);
      return;
    }
    let active = true;
    setDetailLoading(true);
    setSelectedDetail(null);
    setSelectedVersions([]);
    setError("");
    void apiFetch<unknown>(`communications/admin/${selectedId}`)
      .then((response) => {
        const payload = parseCommunicationDetailPayload(response, selectedId);
        if (!payload) throw new Error("La fiche de communication reçue est invalide.");
        if (active) {
          setSelectedDetail(payload.communication);
          setSelectedVersions(payload.versions);
          setReviewVisibility(payload.communication.visibility === "public" ? "public" : "internal");
        }
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
  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("fr-FR");
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!query) return true;
      return [row.title, row.summary, row.category, STATUS_LABELS[row.status] ?? row.status]
        .some((value) => value.toLocaleLowerCase("fr-FR").includes(query));
    });
  }, [rows, searchQuery, statusFilter]);

  async function retryFailure(id: string) {
    setRetryingFailureId(id);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch<unknown>(`communications/admin/failures/${id}/retry`, {
        method: "POST",
        body: JSON.stringify({ operatorConfirmedReady: true }),
      });
      const payload = parseCommunicationRetryPayload(response);
      if (!payload) throw new Error("La reprise n’a pas été confirmée par le serveur.");
      setConfirmingRetryId(null);
      setNotice(payload.duplicate
        ? "La reprise était déjà planifiée. L’échec d’origine reste conservé."
        : "La reprise est planifiée. L’échec d’origine reste conservé.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Reprise impossible.");
    } finally {
      setRetryingFailureId(null);
    }
  }

  function startNew() {
    setDraft(emptyDraft());
    setEditingId(null);
    setComposerMode("write");
    setSelectedId(null);
    setSelectedDetail(null);
    setSelectedVersions([]);
    setReviewNotes([]);
    setReviewVisibility("internal");
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
    setComposerMode("write");
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
      const requestInput = {
        action: assistAction,
        title: draft.title,
        summary: draft.summary,
        bodyMarkdown: draft.bodyMarkdown,
        category: draft.category,
        templateKey: draft.templateKey,
      };
      const response = await apiFetch<unknown>("communications/admin/assist", {
        method: "POST",
        body: JSON.stringify(requestInput),
      });
      const payload = parseCommunicationAssistPayload(response, requestInput);
      if (!payload) throw new Error("La proposition reçue est invalide et n’a pas été appliquée.");
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
      const response = await apiFetch<unknown>(`communications/admin/${selectedDetail.id}/review`, {
        method: "POST",
        body: JSON.stringify({ confirmation: "VERIFIER", visibility: reviewVisibility }),
      });
      const payload = parseCommunicationReviewPayload(response, selectedDetail.id, reviewVisibility);
      if (!payload) throw new Error("La demande de vérification n’a pas été confirmée par le serveur.");
      setNotice("La communication est transmise pour vérification humaine.");
      await load();
      setSelectedDetail((current) => current ? { ...current, ...payload.communication } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Demande de vérification impossible.");
    } finally {
      setRequestingReview(false);
    }
  }

  async function approveCommunication() {
    if (!selectedDetail || !canManageTemplates) return;
    setApproving(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch<unknown>(`communications/admin/${selectedDetail.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ confirmation: "VALIDER" }),
      });
      const payload = parseCommunicationApprovalPayload(response, selectedDetail.id);
      if (!payload) throw new Error("La validation n’a pas été confirmée par le serveur.");
      setNotice(selectedDetail.visibility === "public"
        ? "La version est validée. La publication reste une action distincte."
        : "La communication interne est validée.");
      await load();
      setSelectedDetail((current) => current ? { ...current, ...payload.communication } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Validation impossible.");
    } finally {
      setApproving(false);
    }
  }

  async function publishCommunication() {
    if (!selectedDetail || !canManageTemplates || !COMMUNICATION_PUBLICATION_UI_ENABLED) return;
    setPublishing(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch<unknown>(`communications/admin/${selectedDetail.id}/publish`, {
        method: "POST",
        body: JSON.stringify({ confirmation: "PUBLIER" }),
      });
      const payload = parseCommunicationPublicationPayload(response, selectedDetail.id);
      if (!payload) throw new Error("La publication n’a pas été confirmée par le serveur.");
      setNotice("La communication est publiée dans « À la une ».");
      await load();
      setSelectedDetail((current) => current ? { ...current, ...payload.communication } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Publication impossible.");
    } finally {
      setPublishing(false);
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
      const requestedDocument = {
        originalName: documentFile.name,
        mimeType,
        sizeBytes: documentFile.size,
      };
      const reservationPayload = await apiFetch<unknown>("communications/admin/documents", {
        method: "POST",
        body: JSON.stringify(requestedDocument),
      });
      const reserve = parseCommunicationDocumentReservationPayload(reservationPayload, requestedDocument);
      if (!reserve) {
        throw new Error("La réservation privée est invalide. Aucun transfert n’a été lancé.");
      }
      const uploaded = await supabase.storage
        .from(reserve.upload.bucket)
        .uploadToSignedUrl(reserve.upload.path, reserve.upload.token, documentFile, { contentType: mimeType });
      if (uploaded.error) throw new Error("Le transfert privé du document a échoué.");
      const confirmationPayload = await apiFetch<unknown>(
        `communications/admin/documents/${reserve.document.id}/confirm`,
        { method: "POST" }
      );
      const confirmation = parseCommunicationDocumentConfirmationPayload(
        confirmationPayload,
        reserve.document
      );
      if (!confirmation) {
        throw new Error("Le serveur n’a pas confirmé la quarantaine. Vérifiez l’état avant de recommencer.");
      }
      setDocumentFile(null);
      setDocumentPickerKey((value) => value + 1);
      setNotice(confirmation.duplicate
        ? "Le document était déjà confirmé et reste sous contrôle humain."
        : "Le document est placé en quarantaine pour analyse.");
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
      const templateInput = {
        templateKey: editingTemplate.templateKey,
        label: editingTemplate.label,
        defaultCategory: editingTemplate.defaultCategory,
        titleHint: editingTemplate.titleHint,
        summaryHint: editingTemplate.summaryHint,
        bodyMarkdown: editingTemplate.bodyMarkdown,
        active: editingTemplate.active,
      };
      const response = await apiFetch<unknown>("communications/admin/templates", {
        method: "PATCH",
        body: JSON.stringify(templateInput),
      });
      const payload = parseCommunicationTemplateMutationPayload(response, templateInput);
      if (!payload) throw new Error("L’enregistrement du modèle n’a pas été confirmé par le serveur.");
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
      const response = await apiFetch<unknown>(
        editingId ? `communications/admin/${editingId}` : "communications/admin",
        {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({ sourceType: "direct_text", ...draft }),
      });
      const payload = parseCommunicationDraftMutationPayload(response, editingId);
      if (!payload) throw new Error("L’enregistrement n’a pas été confirmé par le serveur.");
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
    <div className="mx-auto max-w-6xl space-y-6" aria-busy={loading}>
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
        <li className="flex min-h-16 items-center gap-3 bg-emerald-700 px-4 py-3 text-white" aria-current="step">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-bold text-emerald-800">1</span>
          <span><strong className="block text-sm">Déposer</strong><small className="text-white">Saisie privée</small></span>
        </li>
        <li className="flex min-h-16 items-center gap-3 bg-white px-4 py-3 text-slate-700">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-700 text-sm font-bold text-emerald-800">2</span>
          <span><strong className="block text-sm">Vérifier</strong><small className="text-slate-500">Relecture humaine</small></span>
        </li>
        <li className="flex min-h-16 items-center gap-3 bg-white px-4 py-3 text-slate-600">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-400 text-sm font-bold">3</span>
          <span><strong className="block text-sm">Publier et informer</strong><small className="text-slate-500">{COMMUNICATION_PUBLICATION_UI_ENABLED ? "Après validation" : "Activation requise"}</small></span>
        </li>
      </ol>

      {error ? <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

      <section className="border-y border-slate-200 py-5" aria-labelledby="communication-inbound-title">
        <div className="flex items-start gap-3">
          <Inbox className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div className="min-w-0">
            <h2 id="communication-inbound-title" className="text-lg font-bold text-slate-950">Réponses reçues</h2>
            <p className="mt-1 text-sm text-slate-500">{inbound.length === 0 ? "Aucune réponse en attente" : `${inbound.length} réponse${inbound.length > 1 ? "s" : ""} à vérifier`}</p>
          </div>
        </div>
        {inbound.length > 0 ? (
          <ul className="mt-4 divide-y divide-slate-200 border-y border-slate-200 bg-white">
            {inbound.map((item) => (
              <li key={item.id} className="flex min-w-0 flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <strong className="block break-words text-sm text-slate-950">{item.title ?? "Réponse non rattachée"}</strong>
                  <p className="mt-1 text-sm font-semibold text-emerald-800">{INBOUND_CLASSIFICATION_LABELS[item.classification ?? ""] ?? "Classement manuel requis"}</p>
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">À vérifier</span>
                  <p className="mt-1 text-xs text-slate-500">{dateLabel(item.receivedAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {canManageTemplates ? (
        <section className="border-y border-slate-200 py-5" aria-labelledby="communication-failures-title">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <h2 id="communication-failures-title" className="text-lg font-bold text-slate-950">Envois à reprendre</h2>
              <p className="mt-1 text-sm text-slate-500">{failures.length === 0 ? "Aucun échec en attente" : `${failures.length} échec${failures.length > 1 ? "s" : ""} à vérifier`}</p>
            </div>
          </div>
          {failures.length > 0 ? (
            <ul className="mt-4 divide-y divide-slate-200 border-y border-slate-200 bg-white">
              {failures.map((failure) => (
                <li key={failure.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <strong className="block break-words text-sm text-slate-950">{failure.title}</strong>
                    <p className="mt-1 text-sm text-amber-800">{FAILURE_CODE_LABELS[failure.failureCode ?? ""] ?? "Échec à vérifier"}</p>
                    <p className="mt-1 text-xs text-slate-500">Version {failure.version ?? "—"} · {failure.attemptCount} essai{failure.attemptCount > 1 ? "s" : ""} · {dateLabel(failure.failedAt)}</p>
                  </div>
                  {confirmingRetryId === failure.id ? (
                    <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                      <button type="button" onClick={() => setConfirmingRetryId(null)} disabled={retryingFailureId === failure.id} className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Annuler</button>
                      <button type="button" onClick={() => void retryFailure(failure.id)} disabled={retryingFailureId === failure.id} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                        {retryingFailureId === failure.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Confirmer la reprise
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmingRetryId(failure.id)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 sm:w-auto">
                      <RotateCcw className="h-4 w-4" /> Cause corrigée
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

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
          <ul className="mt-5 divide-y divide-slate-200 border-y border-slate-200 bg-white">
            {documents.map((document) => (
              <li key={document.id} className="flex min-w-0 flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">{document.originalName}</p>
                  <p className="mt-1 text-xs text-slate-500">{fileSizeLabel(document.sizeBytes)} · {dateLabel(document.createdAt)}</p>
                  {document.analysisError ? <p className="mt-1 break-words text-xs text-red-700">{document.analysisError}</p> : null}
                </div>
                <span className="shrink-0 text-xs font-semibold text-slate-600">{DOCUMENT_STATUS_LABELS[document.status] ?? document.status}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)]">
        <section aria-labelledby="communications-list-title" className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 id="communications-list-title" className="font-bold text-slate-950">Communications</h2>
              <p id="communications-list-count" role="status" aria-live="polite" className="text-xs text-slate-500">{filteredRows.length} sur {rows.length}</p>
            </div>
            <button type="button" onClick={startNew} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" /> Nouveau
            </button>
          </div>

          <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <label className="relative block">
              <span className="sr-only">Rechercher une communication</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Rechercher" aria-describedby="communications-list-count" className="min-h-10 w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label>
              <span className="sr-only">Filtrer par état</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100">
                <option value="all">Tous les états</option>
                <option value="draft">Brouillons</option>
                <option value="review">À vérifier</option>
                <option value="approved">Validés</option>
                <option value="published">Publiés</option>
                <option value="archived">Archivés</option>
                <option value="cancelled">Annulés</option>
              </select>
            </label>
          </div>

          <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white" aria-busy={loading}>
            {loading ? <div role="status" aria-live="polite" className="flex min-h-36 items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin text-emerald-700" aria-hidden="true" /><span className="sr-only">Chargement des communications</span></div> : null}
            {!loading && rows.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">Aucune communication</p> : null}
            {!loading && rows.length > 0 && filteredRows.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">Aucun résultat</p> : null}
            {filteredRows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => { setSelectedId(row.id); setEditingId(null); setReviewNotes([]); }}
                aria-pressed={selectedId === row.id}
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
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${selected.visibility === "public" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                {selected.visibility === "public" ? <ExternalLink className="h-3.5 w-3.5" /> : <LockKeyhole className="h-3.5 w-3.5" />}
                {selected.visibility === "public" ? "Site public" : "Interne"}
              </span>
            </div>
            {selected.summary ? <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-700">{selected.summary}</p> : null}
            <dl className="mt-6 grid gap-3 border-y border-slate-200 py-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div><dt className="text-slate-500">Catégorie</dt><dd className="mt-1 font-semibold text-slate-950">{CATEGORY_OPTIONS.find((item) => item.value === selected.category)?.label ?? selected.category}</dd></div>
              <div><dt className="text-slate-500">Modèle</dt><dd className="mt-1 font-semibold text-slate-950">{templates.find((item) => item.templateKey === selected.templateKey)?.label ?? "Sans modèle"}</dd></div>
              <div><dt className="text-slate-500">Visibilité</dt><dd className="mt-1 font-semibold text-slate-950">{selected.visibility === "public" ? "Site public" : "Interne"}</dd></div>
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
                {selectedVersions.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-bold text-slate-950">Historique des versions</h3>
                    <ol className="mt-2 divide-y divide-slate-200 border-y border-slate-200">
                      {selectedVersions.map((version) => (
                        <li key={version.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span className="font-semibold text-slate-800">Version {version.version}</span>
                          <span className="text-right text-xs text-slate-500">{STATUS_LABELS[version.status] ?? version.status}<br />{dateLabel(version.createdAt)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
                {selectedDetail.status === "draft" ? (
                  <div className="space-y-4 border-t border-slate-200 pt-5">
                    {canManageTemplates ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div><strong className="text-sm text-slate-950">Après validation</strong><p className="text-xs text-slate-500">Choisissez le périmètre avant d’envoyer à la vérification.</p></div>
                        <div role="group" className="grid grid-cols-2 rounded-md border border-slate-300 bg-white p-0.5" aria-label="Visibilité après validation">
                          <button type="button" onClick={() => setReviewVisibility("internal")} aria-pressed={reviewVisibility === "internal"} className={`min-h-10 px-3 text-xs font-semibold ${reviewVisibility === "internal" ? "rounded bg-slate-950 text-white" : "text-slate-600"}`}>Interne</button>
                          <button type="button" onClick={() => setReviewVisibility("public")} aria-pressed={reviewVisibility === "public"} className={`min-h-10 px-3 text-xs font-semibold ${reviewVisibility === "public" ? "rounded bg-slate-950 text-white" : "text-slate-600"}`}>Site public</button>
                        </div>
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                      <button type="button" onClick={startEdit} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"><Pencil className="h-4 w-4" /> Modifier</button>
                      <button type="button" onClick={() => void requestReview()} disabled={requestingReview || selectedDetail.openQuestions.length > 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                        {requestingReview ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Demander la vérification
                      </button>
                    </div>
                  </div>
                ) : null}
                {selectedDetail.status === "review" && canManageTemplates ? (
                  <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-600">Relisez le message et ses informations avant de valider cette version.</p>
                    <button type="button" onClick={() => void approveCommunication()} disabled={approving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                      {approving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Valider la version
                    </button>
                  </div>
                ) : null}
                {selectedDetail.status === "approved" && selectedDetail.visibility === "public" && canManageTemplates ? (
                  <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-600">La publication créera une page datée dans « À la une ».</p>
                    <button type="button" onClick={() => void publishCommunication()} disabled={publishing || !COMMUNICATION_PUBLICATION_UI_ENABLED} title={COMMUNICATION_PUBLICATION_UI_ENABLED ? "Publier sur le site" : "Publication fermée dans cet environnement"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                      {publishing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {COMMUNICATION_PUBLICATION_UI_ENABLED ? "Publier sur le site" : "Publication non activée"}
                    </button>
                  </div>
                ) : null}
                {selectedDetail.status === "published" && selectedDetail.publicSlug ? (
                  <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-600">Publié {selectedDetail.publishedAt ? dateLabel(selectedDetail.publishedAt) : "dans À la une"}</p>
                    <a href={`/site/${selectedDetail.publicSlug}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"><ExternalLink className="h-4 w-4" /> Voir la page</a>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="mt-5 flex items-center gap-2 text-sm text-slate-500"><Clock3 className="h-4 w-4" /> Mis à jour {dateLabel(selected.updatedAt)}</div>
          </section>
        ) : (
          <form onSubmit={submit} aria-labelledby="communication-composer-title" className="min-w-0 space-y-5 border-t-4 border-emerald-700 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <FilePenLine className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div><h2 id="communication-composer-title" className="font-bold text-slate-950">{editingId ? "Modifier le brouillon" : "Nouvelle communication"}</h2><p className="mt-1 text-sm text-slate-500">{editingId ? "Une nouvelle version sera conservée" : "Enregistrée comme brouillon interne"}</p></div>
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

            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label htmlFor="communication-message" className="text-sm font-semibold text-slate-800">Message</label>
                <div role="group" className="grid grid-cols-3 rounded-md border border-slate-300 bg-white p-0.5" aria-label="Mode du message">
                  <button type="button" onClick={() => setComposerMode("write")} aria-pressed={composerMode === "write"} className={`inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-semibold ${composerMode === "write" ? "rounded bg-slate-950 text-white" : "text-slate-600"}`}><Pencil className="h-3.5 w-3.5" /> Écrire</button>
                  <button type="button" onClick={() => setComposerMode("page")} aria-pressed={composerMode === "page"} className={`inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-semibold ${composerMode === "page" ? "rounded bg-slate-950 text-white" : "text-slate-600"}`}><Eye className="h-3.5 w-3.5" /> Page</button>
                  <button type="button" onClick={() => setComposerMode("email")} aria-pressed={composerMode === "email"} className={`inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-semibold ${composerMode === "email" ? "rounded bg-slate-950 text-white" : "text-slate-600"}`}><Mail className="h-3.5 w-3.5" /> Email</button>
                </div>
              </div>
              {composerMode === "write" ? (
                <textarea id="communication-message" required maxLength={100000} rows={12} value={draft.bodyMarkdown} onChange={(event) => setDraft((current) => ({ ...current, bodyMarkdown: event.target.value }))} className="mt-1.5 w-full resize-y rounded-md border border-slate-300 px-3 py-2.5 font-normal leading-6 text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              ) : null}
              {composerMode === "page" ? <div className="mt-2"><CommunicationPagePreview title={draft.title} summary={draft.summary} bodyMarkdown={draft.bodyMarkdown} /></div> : null}
              {composerMode === "email" ? <div className="mt-2"><CommunicationEmailPreview title={draft.title} summary={draft.summary} bodyMarkdown={draft.bodyMarkdown} /></div> : null}
            </div>

            <section className="border-y border-slate-200 py-4" aria-labelledby="communication-assist-title">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 id="communication-assist-title" className="flex items-center gap-2 text-sm font-bold text-slate-950"><Sparkles className="h-4 w-4 text-emerald-700" /> Aide à la rédaction</h3>
                  <p className="mt-1 text-xs text-slate-500">La proposition ne remplace jamais votre vérification.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div role="group" className="grid grid-cols-3 rounded-md border border-slate-300 bg-white p-0.5" aria-label="Type d’aide">
                    {([['structure', 'Structurer'], ['correct', 'Corriger'], ['simplify', 'Simplifier']] as const).map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setAssistAction(value)} aria-pressed={assistAction === value} className={`min-h-10 px-2 text-xs font-semibold ${assistAction === value ? "rounded bg-slate-950 text-white" : "text-slate-600"}`}>{label}</button>
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
                <button type="submit" disabled={saving || draft.bodyMarkdown.trim().length === 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
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
                <button key={template.templateKey} type="button" onClick={() => setEditingTemplate({ ...template })} aria-pressed={editingTemplate?.templateKey === template.templateKey} className={`min-h-10 rounded-md border px-3 py-2 text-sm font-semibold ${editingTemplate?.templateKey === template.templateKey ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700"}`}>
                  {template.label}
                </button>
              ))}
            </div>
          </div>

          {editingTemplate ? (
            <form onSubmit={saveTemplate} aria-labelledby="communication-template-editor-title" className="grid gap-4 border-l-4 border-emerald-700 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div><strong id="communication-template-editor-title" className="text-slate-950">{editingTemplate.label}</strong><p className="text-xs text-slate-500">{editingTemplate.customized ? `Version ${editingTemplate.version}` : "Modèle d’origine"}</p></div>
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
        <div className="flex items-center gap-3 bg-white px-4 py-3 text-slate-500"><Send className="h-4 w-4" /><span className="text-sm"><strong className="block text-slate-700">Publication et envoi</strong>Publication séparée après validation ; envoi toujours fermé</span></div>
      </section>
    </div>
  );
}
