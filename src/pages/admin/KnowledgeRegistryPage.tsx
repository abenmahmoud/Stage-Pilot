import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftCircle,
  BadgeCheck,
  Ban,
  BookOpenCheck,
  ClipboardCheck,
  Database,
  FileCheck2,
  FileText,
  FileUp,
  History,
  LoaderCircle,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { uploadKnowledgeDocument } from "../../lib/resumable-upload";
import {
  KNOWLEDGE_DOCUMENT_MAX_BYTES,
  knowledgeDocumentMime,
} from "../../../shared/knowledge-document-input";
import {
  parseSkillScenarioPlan,
  type SkillScenarioPlanItem,
} from "../../../shared/skill-scenario-plan";

type SourceStatus = "draft" | "published" | "expired" | "revoked";
type VersionStatus = "draft" | "review" | "published" | "retired";

type KnowledgeSource = {
  id: string;
  title: string;
  sourceType: string;
  uri: string;
  classification: string;
  serviceCodes: string[];
  validFrom: string;
  expiresAt: string | null;
  status: SourceStatus;
  checksum: string;
  updatedAt: string;
};

type AgentSkill = {
  id: string;
  skillKey: string;
  name: string;
  domain: string;
  activeVersionId: string | null;
  enabled: boolean;
};

type SkillVersion = {
  id: string;
  skillId: string;
  version: string;
  status: VersionStatus;
  definition: { instructions?: string; allowedTools?: string[] };
  dataClassification: string;
  reviewDueAt: string;
  publishedAt: string | null;
  createdAt: string;
};

type SourceLink = { skillVersionId: string; sourceId: string };
type KnowledgeDocumentStatus =
  | "reserved"
  | "uploaded"
  | "quarantined"
  | "processing"
  | "review"
  | "ready"
  | "rejected"
  | "failed"
  | "purged";
type KnowledgeDocument = {
  id: string;
  title: string;
  purposeDescription: string;
  sourceType: string;
  classification: string;
  ownerServiceCode: string;
  serviceCodes: string[];
  validFrom: string;
  reviewDueAt: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: KnowledgeDocumentStatus;
  retentionPolicyKey: "pending_dpo" | "approved";
  retentionUntil: string | null;
  purgeStatus: "blocked" | "scheduled" | "processing" | "failed" | "purged";
  purgedAt: string | null;
  analysisSummary: string | null;
  analysisError: string | null;
  reviewProposal: DocumentReviewProposal | null;
  sourceId: string | null;
  excerptCount: number;
  createdAt: string;
  uploadedAt: string | null;
};
type DocumentReviewProposal = {
  overview: string;
  keyPoints: string[];
  rules: string[];
  prohibitions: string[];
  datedStatements: string[];
  conflicts: Array<{ first: string; second: string }>;
  questions: string[];
  instructionSignals: string[];
};
type Evaluation = {
  skillVersionId: string;
  testCaseKey: string;
  kind: "positive" | "ambiguous" | "forbidden";
  result: "pass" | "fail" | "needs_review";
  evidence: {
    runner?: "manual" | "deterministic";
    fixture?: "fictitious";
    scenario?: string;
    expected?: string;
    observed?: string;
  };
  runAt: string;
};
type Audit = {
  id: string;
  resourceType: string;
  action: string;
  createdAt: string;
  summary: Record<string, unknown>;
};
type Registry = {
  sources: KnowledgeSource[];
  skills: AgentSkill[];
  versions: SkillVersion[];
  links: SourceLink[];
  evaluations: Evaluation[];
  audit: Audit[];
};

const EMPTY_REGISTRY: Registry = {
  sources: [], skills: [], versions: [], links: [], evaluations: [], audit: [],
};

const STATUS_LABELS: Record<SourceStatus | VersionStatus, string> = {
  draft: "Brouillon",
  review: "À valider",
  published: "Publié",
  expired: "Périmé",
  revoked: "Révoqué",
  retired: "Retiré",
};

const STATUS_STYLE: Record<SourceStatus | VersionStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  review: "bg-amber-100 text-amber-800",
  published: "bg-emerald-100 text-emerald-800",
  expired: "bg-orange-100 text-orange-800",
  revoked: "bg-red-100 text-red-800",
  retired: "bg-gray-200 text-gray-600",
};

const DOCUMENT_STATUS: Record<KnowledgeDocumentStatus, { label: string; style: string }> = {
  reserved: { label: "Transfert à terminer", style: "bg-slate-100 text-slate-700" },
  uploaded: { label: "Analyse à préparer", style: "bg-blue-100 text-blue-800" },
  quarantined: { label: "Contrôle de sécurité", style: "bg-amber-100 text-amber-800" },
  processing: { label: "Analyse en cours", style: "bg-cyan-100 text-cyan-800" },
  review: { label: "À relire", style: "bg-amber-100 text-amber-800" },
  ready: { label: "Validé", style: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Refusé", style: "bg-red-100 text-red-800" },
  failed: { label: "Échec d’analyse", style: "bg-red-100 text-red-800" },
  purged: { label: "Purgé", style: "bg-slate-200 text-slate-700" },
};

const SERVICE_OPTIONS = [
  ["referent_numerique", "Numérique"],
  ["ddfpt", "DDFPT"],
  ["secretariat", "Secrétariat"],
  ["vie_scolaire", "Vie scolaire"],
  ["intendance", "Intendance"],
  ["direction", "Direction"],
  ["administration", "Administration"],
] as const;

function localInput(date: Date): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function localDate(date: Date): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 10);
}

function dateLabel(value: string | null): string {
  if (!value) return "Sans échéance";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function nextVersion(value: string): string {
  const parts = value.split(".").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return "1.0.0";
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

function Status({ value }: { value: SourceStatus | VersionStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[value]}`}>
      {STATUS_LABELS[value]}
    </span>
  );
}

export default function KnowledgeRegistryPage() {
  const [registry, setRegistry] = useState<Registry>(EMPTY_REGISTRY);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [tab, setTab] = useState<"documents" | "skills" | "sources" | "history">("documents");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  const [versionSkillId, setVersionSkillId] = useState<string | null>(null);
  const [evaluationVersionId, setEvaluationVersionId] = useState<string | null>(null);
  const [evaluationDraft, setEvaluationDraft] = useState(() => evaluationDefaults());
  const [documentOpen, setDocumentOpen] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentNotes, setDocumentNotes] = useState<Record<string, string>>({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [documentDraft, setDocumentDraft] = useState(() => ({
    title: "",
    purposeDescription: "",
    sourceType: "procedure",
    classification: "internal",
    ownerServiceCode: "administration",
    serviceCodes: [] as string[],
    validFrom: localDate(new Date()),
    reviewDueAt: localInput(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)),
  }));
  const [sourceDraft, setSourceDraft] = useState(() => ({
    title: "",
    sourceType: "official_url",
    uri: "",
    classification: "public",
    serviceCodes: [] as string[],
    validFrom: localInput(new Date()),
    expiresAt: localInput(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)),
    checksum: "",
  }));
  const [skillDraft, setSkillDraft] = useState(() => ({
    skillKey: "",
    name: "",
    domain: "Assistance du lycée",
    version: "1.0.0",
    dataClassification: "internal",
    instructions: "",
    allowedTools: "support.create_request",
    sourceIds: [] as string[],
    reviewDueAt: localInput(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)),
  }));

  const publishedSources = registry.sources.filter((source) => source.status === "published");
  const versionBySkill = useMemo(() => {
    const result = new Map<string, SkillVersion[]>();
    for (const version of registry.versions) {
      result.set(version.skillId, [...(result.get(version.skillId) ?? []), version]);
    }
    return result;
  }, [registry.versions]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [nextRegistry, documentResult] = await Promise.all([
        apiFetch<Registry>("knowledge/admin"),
        apiFetch<{ documents: KnowledgeDocument[] }>("knowledge/admin/documents"),
      ]);
      setRegistry(nextRegistry);
      setDocuments(documentResult.documents);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function uploadDocument(event: React.FormEvent) {
    event.preventDefault();
    if (!documentFile) {
      setError("Choisissez un document.");
      return;
    }
    const mimeType = knowledgeDocumentMime(documentFile.name, documentFile.type);
    setBusy(true); setError(""); setNotice(""); setUploadProgress(0);
    try {
      const reservation = await apiFetch<{
        document: KnowledgeDocument;
        upload: { bucket: string; path: string; token: string };
      }>("knowledge/admin/documents", {
        method: "POST",
        body: JSON.stringify({
          ...documentDraft,
          originalName: documentFile.name,
          mimeType,
          sizeBytes: documentFile.size,
        }),
      });
      const uploadFile = documentFile.type === mimeType
        ? documentFile
        : new File([documentFile], documentFile.name, { type: mimeType });
      await uploadKnowledgeDocument(uploadFile, reservation.upload, setUploadProgress);
      await apiFetch(`knowledge/admin/documents/${reservation.document.id}/confirm`, {
        method: "POST",
      });
      setNotice("Document reçu dans l’espace privé. Il n’est pas encore utilisé par l’agent.");
      setDocumentOpen(false);
      setDocumentFile(null);
      setDocumentDraft({
        title: "",
        purposeDescription: "",
        sourceType: "procedure",
        classification: "internal",
        ownerServiceCode: "administration",
        serviceCodes: [],
        validFrom: localDate(new Date()),
        reviewDueAt: localInput(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)),
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le dépôt du document a échoué.");
    } finally {
      setBusy(false);
      setUploadProgress(0);
    }
  }

  async function createSource(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      await apiFetch("knowledge/admin", {
        method: "POST",
        body: JSON.stringify({ resource: "source", input: {
          ...sourceDraft,
          validFrom: new Date(sourceDraft.validFrom).toISOString(),
          expiresAt: sourceDraft.expiresAt ? new Date(sourceDraft.expiresAt).toISOString() : null,
        } }),
      });
      setNotice("Source enregistrée en brouillon. La direction doit encore la vérifier.");
      setSourceOpen(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Enregistrement impossible.");
    } finally { setBusy(false); }
  }

  async function createSkill(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      await apiFetch("knowledge/admin", {
        method: "POST",
        body: JSON.stringify({
          resource: versionSkillId ? "version" : "skill",
          skillId: versionSkillId,
          input: {
          ...skillDraft,
          allowedTools: skillDraft.allowedTools.split(",").map((value) => value.trim()).filter(Boolean),
          reviewDueAt: new Date(skillDraft.reviewDueAt).toISOString(),
          },
        }),
      });
      setNotice(versionSkillId ? "Nouvelle version créée en brouillon." : "Compétence créée en brouillon. Elle reste inactive jusqu’à sa validation.");
      setSkillOpen(false);
      setVersionSkillId(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Création impossible.");
    } finally { setBusy(false); }
  }

  function startNewSkill() {
    setVersionSkillId(null);
    setSkillDraft({
      ...EMPTY_SKILL_SHAPE,
      domain: "Assistance du lycée",
      allowedTools: "support.create_request",
      reviewDueAt: localInput(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)),
    });
    setSkillOpen(true);
  }

  function startNewVersion(skill: AgentSkill, version: SkillVersion) {
    const links = registry.links.filter((link) => link.skillVersionId === version.id);
    setVersionSkillId(skill.id);
    setSkillDraft({
      skillKey: skill.skillKey,
      name: skill.name,
      domain: skill.domain,
      version: nextVersion(version.version),
      dataClassification: version.dataClassification,
      instructions: version.definition.instructions ?? "",
      allowedTools: (version.definition.allowedTools ?? []).join(", "),
      sourceIds: links.map((link) => link.sourceId),
      reviewDueAt: localInput(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)),
    });
    setSkillOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEvaluation(skill: AgentSkill, version: SkillVersion) {
    setEvaluationVersionId(version.id);
    setEvaluationDraft(evaluationDefaults(`${skill.skillKey}-positive-01`));
    setError("");
    setNotice("");
  }

  async function recordEvaluation(event: React.FormEvent) {
    event.preventDefault();
    if (!evaluationVersionId) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await apiFetch(`knowledge/admin/versions/${evaluationVersionId}/evaluations`, {
        method: "POST",
        body: JSON.stringify({
          testCaseKey: evaluationDraft.testCaseKey,
          kind: evaluationDraft.kind,
          result: evaluationDraft.result,
          confirmation: evaluationDraft.confirmed ? "TEST_EXECUTE" : "",
          evidence: {
            runner: evaluationDraft.runner,
            fixture: "fictitious",
            scenario: evaluationDraft.scenario,
            expected: evaluationDraft.expected,
            observed: evaluationDraft.observed,
          },
        }),
      });
      setNotice("Test horodaté et ajouté au procès-verbal de cette version.");
      setEvaluationDraft(evaluationDefaults());
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Enregistrement du test impossible.");
    } finally { setBusy(false); }
  }

  async function versionAction(id: string, action: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      await apiFetch(`knowledge/admin/versions/${id}/action`, {
        method: "POST", body: JSON.stringify({ action }),
      });
      setNotice(action === "publish" ? "Compétence publiée et activée." : action === "rollback" ? "Version réactivée." : "Action enregistrée.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Action impossible."); }
    finally { setBusy(false); }
  }

  async function sourceAction(id: string, action: "publish" | "revoke") {
    setBusy(true); setError(""); setNotice("");
    try {
      await apiFetch(`knowledge/admin/sources/${id}/action`, {
        method: "POST", body: JSON.stringify({ action }),
      });
      setNotice(action === "publish" ? "Source validée." : "Source révoquée. Les compétences dépendantes sont désactivées.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Action impossible."); }
    finally { setBusy(false); }
  }

  async function reviewDocument(id: string, action: "approve" | "reject") {
    const note = (documentNotes[id] ?? "").trim();
    if (note.length < 10) {
      setError("Ajoutez une note de validation d’au moins 10 caractères.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      await apiFetch(`knowledge/admin/documents/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ action, note }),
      });
      setDocumentNotes((value) => {
        const next = { ...value };
        delete next[id];
        return next;
      });
      setNotice(action === "approve"
        ? "Document validé. Une source en brouillon a été créée ; l’agent ne l’utilise pas encore."
        : "Document refusé et retiré du stockage privé.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Validation impossible.");
    } finally { setBusy(false); }
  }

  async function openDocument(id: string) {
    setBusy(true); setError("");
    try {
      const result = await apiFetch<{ url: string }>(`knowledge/admin/documents/${id}/download`);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ouverture impossible.");
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Agent d’établissement</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Connaissances contrôlées</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">L’agent utilise uniquement les compétences publiées, leurs sources datées et leurs tests validés.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} title="Actualiser" className="inline-flex h-10 w-10 items-center justify-center rounded-md border bg-white text-slate-600 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="État du registre">
        <Metric icon={FileText} label="Documents à traiter" value={documents.filter((document) => !["ready", "rejected"].includes(document.status)).length} />
        <Metric icon={BookOpenCheck} label="Compétences actives" value={registry.skills.filter((skill) => skill.enabled).length} />
        <Metric icon={Database} label="Sources validées" value={publishedSources.length} />
        <Metric icon={AlertTriangle} label="À vérifier" value={registry.versions.filter((version) => version.status === "review").length + registry.sources.filter((source) => source.status === "draft").length} />
      </section>

      {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        <Tab active={tab === "documents"} onClick={() => setTab("documents")}><FileUp /> Documents</Tab>
        <Tab active={tab === "skills"} onClick={() => setTab("skills")}><BookOpenCheck /> Compétences</Tab>
        <Tab active={tab === "sources"} onClick={() => setTab("sources")}><Database /> Sources</Tab>
        <Tab active={tab === "history"} onClick={() => setTab("history")}><History /> Historique</Tab>
      </div>

      {loading ? <div className="flex min-h-64 items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin text-emerald-700" /></div> : null}

      {!loading && tab === "documents" ? <section className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><h2 className="text-lg font-bold">Documents confiés à l’agent</h2><p className="text-sm text-slate-500">Aucun document n’est actif avant votre validation.</p></div>
          <button type="button" onClick={() => setDocumentOpen((value) => !value)} className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><FileUp className="h-4 w-4" /> Ajouter un document</button>
        </div>
        {documentOpen ? <DocumentUploadForm
          draft={documentDraft}
          setDraft={setDocumentDraft}
          file={documentFile}
          setFile={setDocumentFile}
          progress={uploadProgress}
          busy={busy}
          onSubmit={uploadDocument}
        /> : null}
        <div className="divide-y border-y border-slate-200 bg-white">
          {documents.map((document) => <article key={document.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_180px_150px] md:items-center">
            <div className="min-w-0">
              <strong className="block truncate text-slate-950">{document.title}</strong>
              <span className="block truncate text-xs text-slate-500">{document.originalName} · {formatBytes(document.sizeBytes)}</span>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{document.purposeDescription}</p>
              {document.retentionPolicyKey === "pending_dpo" ? <p className="mt-2 text-xs font-semibold text-amber-800">Conservation à définir par la direction et le DPO · purge bloquée</p> : null}
              {document.retentionUntil ? <p className="mt-1 text-xs text-slate-500">Conservation prévue jusqu’au {dateLabel(document.retentionUntil)}</p> : null}
              {document.analysisSummary ? <p className="mt-2 text-xs font-medium text-slate-700">{document.analysisSummary}</p> : null}
              {document.status === "review" && document.reviewProposal ? <DocumentProposalReview proposal={document.reviewProposal} /> : null}
              {document.status === "ready" ? <p className="mt-1 text-xs font-semibold text-emerald-700">{document.excerptCount > 0 ? `${document.excerptCount} extrait${document.excerptCount > 1 ? "s" : ""} disponible${document.excerptCount > 1 ? "s" : ""} pour l’agent` : "Lecture humaine uniquement"}</p> : null}
              {document.analysisError ? <p className="mt-2 text-xs text-red-700">{document.analysisError}</p> : null}
              {!['reserved', 'quarantined', 'processing', 'rejected', 'purged'].includes(document.status) ? <button type="button" disabled={busy} onClick={() => void openDocument(document.id)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 disabled:opacity-50"><FileText className="h-3.5 w-3.5" /> Ouvrir l’original privé</button> : null}
              {document.status === "review" ? <div className="mt-3 space-y-2 border-l-2 border-amber-400 pl-3">
                <label className="block text-xs font-semibold text-slate-700" htmlFor={`review-note-${document.id}`}>Note de validation humaine</label>
                <textarea id={`review-note-${document.id}`} rows={2} className="field bg-white text-sm" value={documentNotes[document.id] ?? ""} placeholder="Ce que vous avez vérifié et la limite d’utilisation, sans nom ni coordonnée." onChange={(event) => setDocumentNotes((value) => ({ ...value, [document.id]: event.target.value }))} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => void reviewDocument(document.id, "approve")} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><FileCheck2 className="h-3.5 w-3.5" /> Créer la source</button>
                  <button type="button" disabled={busy} onClick={() => void reviewDocument(document.id, "reject")} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"><Ban className="h-3.5 w-3.5" /> Refuser</button>
                </div>
              </div> : null}
            </div>
            <div><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${DOCUMENT_STATUS[document.status].style}`}>{DOCUMENT_STATUS[document.status].label}</span><span className="mt-1 block text-xs text-slate-500">{document.classification}</span></div>
            <time className="text-xs text-slate-500">Ajouté le<br />{dateLabel(document.createdAt)}</time>
          </article>)}
          {documents.length === 0 ? <Empty text="Aucun document n’a encore été confié à l’agent." /> : null}
        </div>
      </section> : null}

      {!loading && tab === "skills" ? <section className="space-y-4">
        <div className="flex justify-between gap-3"><div><h2 className="text-lg font-bold">Compétences de l’agent</h2><p className="text-sm text-slate-500">Une version publiée peut être retirée immédiatement.</p></div><button type="button" onClick={startNewSkill} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Nouvelle</button></div>
        {skillOpen ? <SkillForm draft={skillDraft} setDraft={setSkillDraft} sources={publishedSources} busy={busy} onSubmit={createSkill} isVersion={Boolean(versionSkillId)} /> : null}
        {evaluationVersionId ? <EvaluationForm draft={evaluationDraft} setDraft={setEvaluationDraft} tests={registry.evaluations.filter((evaluation) => evaluation.skillVersionId === evaluationVersionId)} busy={busy} onSubmit={recordEvaluation} onClose={() => setEvaluationVersionId(null)} /> : null}
        <div className="overflow-x-auto border-y border-slate-200 bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Compétence</th><th className="px-4 py-3">Version</th><th className="px-4 py-3">Sources</th><th className="px-4 py-3">Tests</th><th className="px-4 py-3">Révision</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y">{registry.skills.flatMap((skill) => (versionBySkill.get(skill.id) ?? []).map((version, index) => {
          const links = registry.links.filter((link) => link.skillVersionId === version.id);
          const tests = registry.evaluations.filter((evaluation) => evaluation.skillVersionId === version.id);
          const passed = tests.filter((test) => test.result === "pass").length;
          return <tr key={version.id}><td className="px-4 py-4"><strong className="block text-slate-900">{skill.name}</strong><span className="text-xs text-slate-500">{skill.domain} · {skill.skillKey}</span></td><td className="px-4 py-4"><Status value={version.status} /><span className="ml-2 text-xs">{version.version}</span>{skill.activeVersionId === version.id ? <span className="ml-2 text-xs font-semibold text-emerald-700">Active</span> : null}</td><td className="px-4 py-4">{links.length}</td><td className="px-4 py-4"><span className={passed >= 11 && passed === tests.length ? "text-emerald-700" : "text-amber-700"}>{passed}/{tests.length || 11}</span><span className="block text-xs text-slate-500">minimum 11</span></td><td className="px-4 py-4 text-xs">{dateLabel(version.reviewDueAt)}</td><td className="px-4 py-4"><div className="flex justify-end gap-2">{index === 0 ? <IconAction title="Créer une nouvelle version" disabled={busy} onClick={() => startNewVersion(skill, version)}><Plus /></IconAction> : null}{version.status === "draft" ? <IconAction title="Envoyer en validation" disabled={busy} onClick={() => void versionAction(version.id, "submit_review")}><Send /></IconAction> : null}{version.status === "review" ? <IconAction title="Enregistrer un test exécuté" disabled={busy} onClick={() => startEvaluation(skill, version)}><ClipboardCheck /></IconAction> : null}{version.status === "review" ? <IconAction title="Publier" disabled={busy} onClick={() => void versionAction(version.id, "publish")}><BadgeCheck /></IconAction> : null}{version.status === "published" && skill.activeVersionId !== version.id ? <IconAction title="Réactiver cette version" disabled={busy} onClick={() => void versionAction(version.id, "rollback")}><ArrowLeftCircle /></IconAction> : null}{version.status === "published" ? <IconAction title="Retirer" disabled={busy} onClick={() => void versionAction(version.id, "retire")}><Ban /></IconAction> : null}</div></td></tr>;
        }))}</tbody></table>{registry.skills.length === 0 ? <Empty text="Aucune compétence n’est encore enregistrée." /> : null}</div>
      </section> : null}

      {!loading && tab === "sources" ? <section className="space-y-4"><div className="flex justify-between gap-3"><div><h2 className="text-lg font-bold">Sources de référence</h2><p className="text-sm text-slate-500">Une révocation désactive immédiatement les compétences dépendantes.</p></div><button type="button" onClick={() => setSourceOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Nouvelle</button></div>{sourceOpen ? <SourceForm draft={sourceDraft} setDraft={setSourceDraft} busy={busy} onSubmit={createSource} /> : null}<div className="divide-y border-y bg-white">{registry.sources.map((source) => <article key={source.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_180px_150px_auto] md:items-center"><div className="min-w-0"><strong className="block truncate">{source.title}</strong><span className="block truncate text-xs text-slate-500">{source.uri}</span></div><div><Status value={source.status} /><span className="ml-2 text-xs">{source.classification}</span></div><span className="text-xs text-slate-500">Valide jusqu’au<br />{dateLabel(source.expiresAt)}</span><div className="flex justify-end gap-2">{source.status === "draft" ? <IconAction title="Valider la source" disabled={busy} onClick={() => void sourceAction(source.id, "publish")}><FileCheck2 /></IconAction> : null}{source.status === "published" ? <IconAction title="Révoquer la source" disabled={busy} onClick={() => void sourceAction(source.id, "revoke")}><Ban /></IconAction> : null}</div></article>)}{registry.sources.length === 0 ? <Empty text="Aucune source n’est encore enregistrée." /> : null}</div></section> : null}

      {!loading && tab === "history" ? <section><h2 className="text-lg font-bold">Journal du registre</h2><div className="mt-4 divide-y border-y bg-white">{registry.audit.map((entry) => <div key={entry.id} className="flex items-center gap-3 px-4 py-3 text-sm"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" /><span className="min-w-0 flex-1"><strong className="block">{entry.action}</strong><span className="text-xs text-slate-500">{entry.resourceType}</span></span><time className="text-xs text-slate-500">{dateLabel(entry.createdAt)}</time></div>)}{registry.audit.length === 0 ? <Empty text="Aucune action enregistrée." /> : null}</div></section> : null}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: number }) {
  return <div className="flex items-center gap-3 border-l-4 border-emerald-600 bg-white px-4 py-3 shadow-sm"><Icon className="h-5 w-5 text-emerald-700" /><span><strong className="block text-xl text-slate-950">{value}</strong><span className="text-xs text-slate-500">{label}</span></span></div>;
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold ${active ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-500"}`}>{children}</button>;
}

function IconAction({ title, disabled, onClick, children }: { title: string; disabled: boolean; onClick: () => void; children: React.ReactElement<{ className?: string }> }) {
  return <button type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick} className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-white text-slate-700 disabled:opacity-40">{children}</button>;
}

function Empty({ text }: { text: string }) { return <p className="px-4 py-10 text-center text-sm text-slate-500">{text}</p>; }

function ProposalSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return <section><h4 className="text-xs font-bold text-slate-800">{title}</h4><ul className="mt-1 space-y-1 text-xs text-slate-600">{items.map((item, index) => <li className="break-words" key={`${title}-${index}`}>• {item}</li>)}</ul></section>;
}

function DocumentProposalReview({ proposal }: { proposal: DocumentReviewProposal }) {
  return <details className="mt-3 border-l-2 border-emerald-600 bg-emerald-50/60 px-3 py-2 text-left">
    <summary className="cursor-pointer text-xs font-bold text-emerald-900">Voir la proposition à vérifier</summary>
    <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
      {proposal.overview ? <section className="sm:col-span-2"><h4 className="text-xs font-bold text-slate-800">Résumé extrait</h4><p className="mt-1 break-words text-xs leading-5 text-slate-700">{proposal.overview}</p></section> : null}
      {proposal.instructionSignals.length > 0 ? <div className="sm:col-span-2 flex gap-2 border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950"><AlertTriangle className="h-4 w-4 shrink-0" /><p>Consigne visant potentiellement l’agent détectée. Vérifiez l’original et ne créez aucune source avant correction.</p></div> : null}
      <ProposalSection title="Points clés" items={proposal.keyPoints} />
      <ProposalSection title="Règles" items={proposal.rules} />
      <ProposalSection title="Interdictions" items={proposal.prohibitions} />
      <ProposalSection title="Dates repérées" items={proposal.datedStatements} />
      {proposal.conflicts.length > 0 ? <section className="sm:col-span-2"><h4 className="text-xs font-bold text-amber-900">Contradictions possibles</h4><div className="mt-1 space-y-2">{proposal.conflicts.map((conflict, index) => <div className="grid gap-1 border-l-2 border-amber-400 pl-2 text-xs text-slate-700" key={`conflict-${index}`}><p className="break-words">{conflict.first}</p><p className="break-words">{conflict.second}</p></div>)}</div></section> : null}
      <ProposalSection title="Questions avant validation" items={proposal.questions} />
      <p className="text-xs text-slate-500 sm:col-span-2">Cette proposition est automatique et ne publie rien. Comparez-la avec l’original privé avant votre décision.</p>
    </div>
  </details>;
}

function formatBytes(value: number): string {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} Ko`;
  return `${(value / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

type DocumentDraft = {
  title: string;
  purposeDescription: string;
  sourceType: string;
  classification: string;
  ownerServiceCode: string;
  serviceCodes: string[];
  validFrom: string;
  reviewDueAt: string;
};

function DocumentUploadForm({
  draft,
  setDraft,
  file,
  setFile,
  progress,
  busy,
  onSubmit,
}: {
  draft: DocumentDraft;
  setDraft: React.Dispatch<React.SetStateAction<DocumentDraft>>;
  file: File | null;
  setFile: React.Dispatch<React.SetStateAction<File | null>>;
  progress: number;
  busy: boolean;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const fileTooLarge = Boolean(file && file.size > KNOWLEDGE_DOCUMENT_MAX_BYTES);
  const unsupportedFile = Boolean(file && !knowledgeDocumentMime(file.name, file.type));
  return <form onSubmit={onSubmit} className="grid gap-4 border-y border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
    <Field label="Document" wide>
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center border-2 border-dashed border-slate-300 bg-white px-4 py-5 text-center hover:border-emerald-600">
        <FileUp className="h-6 w-6 text-emerald-700" />
        <strong className="mt-2 text-sm text-slate-900">{file ? file.name : "Choisir un fichier"}</strong>
        <span className="mt-1 text-xs text-slate-500">PDF, Word, Excel, PowerPoint, texte, CSV ou image · 50 Mo maximum</span>
        <input
          className="sr-only"
          type="file"
          required
          accept=".pdf,.docx,.xlsx,.pptx,.txt,.csv,.jpg,.jpeg,.png"
          disabled={busy}
          onChange={(event) => {
            const next = event.target.files?.[0] ?? null;
            setFile(next);
            if (next && !draft.title) {
              setDraft((value) => ({ ...value, title: next.name.replace(/\.[^.]+$/, "") }));
            }
          }}
        />
      </label>
      {file ? <small className={`mt-1 block text-xs ${fileTooLarge || unsupportedFile ? "text-red-700" : "text-slate-500"}`}>{fileTooLarge ? "Ce fichier dépasse la limite actuelle de 50 Mo." : unsupportedFile ? "Ce format n’est pas accepté." : formatBytes(file.size)}</small> : null}
    </Field>
    <Field label="Titre"><input className="field bg-white" required value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} /></Field>
    <Field label="Nature"><select className="field bg-white" value={draft.sourceType} onChange={(event) => setDraft((value) => ({ ...value, sourceType: event.target.value }))}><option value="procedure">Procédure</option><option value="internal_document">Document interne</option><option value="form_template">Formulaire vierge</option><option value="calendar">Calendrier</option></select></Field>
    <Field label="Confidentialité"><select className="field bg-white" value={draft.classification} onChange={(event) => setDraft((value) => ({ ...value, classification: event.target.value, serviceCodes: event.target.value === "public" ? [] : value.serviceCodes }))}><option value="public">Public</option><option value="internal">Interne</option><option value="personal">Données personnelles</option><option value="sensitive">Sensible</option></select></Field>
    <Field label="Service responsable"><select required className="field bg-white" value={draft.ownerServiceCode} onChange={(event) => setDraft((value) => ({ ...value, ownerServiceCode: event.target.value }))}>{SERVICE_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
    <Field label="Périmètre autorisé"><select disabled={draft.classification === "public"} className="field bg-white" value={draft.serviceCodes[0] ?? ""} onChange={(event) => setDraft((value) => ({ ...value, serviceCodes: event.target.value ? [event.target.value] : [] }))}><option value="">Tous les services habilités</option>{SERVICE_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
    <Field label="Valide à partir du"><input type="date" className="field bg-white" required value={draft.validFrom} onChange={(event) => setDraft((value) => ({ ...value, validFrom: event.target.value }))} /></Field>
    <Field label="Révision obligatoire avant le"><input type="datetime-local" className="field bg-white" required value={draft.reviewDueAt} onChange={(event) => setDraft((value) => ({ ...value, reviewDueAt: event.target.value }))} /></Field>
    <Field label="Ce que l’agent doit comprendre" wide><textarea className="field bg-white" rows={6} required minLength={20} maxLength={4000} placeholder="Expliquez le contenu, à qui il s’adresse, les règles importantes, les dates et ce que l’agent ne doit jamais déduire." value={draft.purposeDescription} onChange={(event) => setDraft((value) => ({ ...value, purposeDescription: event.target.value }))} /></Field>
    <p className="border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-950 sm:col-span-2">Les listes de personnes vont dans « Répertoire des identités ». Les mots de passe, codes ENT ou PRONOTE et secrets d’activation sont refusés partout.</p>
    {busy ? <div className="sm:col-span-2" role="status"><div className="mb-1 flex justify-between text-xs font-medium text-slate-600"><span>Transfert privé</span><span>{progress} %</span></div><div className="h-2 overflow-hidden bg-slate-200"><div className="h-full bg-emerald-600 transition-[width]" style={{ width: `${progress}%` }} /></div></div> : null}
    <div className="sm:col-span-2"><button type="submit" disabled={busy || !file || fileTooLarge || unsupportedFile} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Déposer pour analyse</button></div>
  </form>;
}

function SourceForm({ draft, setDraft, busy, onSubmit }: { draft: ReturnType<typeof sourceDefaults>; setDraft: React.Dispatch<React.SetStateAction<ReturnType<typeof sourceDefaults>>>; busy: boolean; onSubmit: (event: React.FormEvent) => void }) {
  return <form onSubmit={onSubmit} className="grid gap-4 border-y border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"><Field label="Titre"><input className="field bg-white" required value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} /></Field><Field label="Type"><select className="field bg-white" value={draft.sourceType} onChange={(event) => setDraft((value) => ({ ...value, sourceType: event.target.value }))}><option value="official_url">Page officielle</option><option value="internal_document">Document interne</option><option value="procedure">Procédure</option><option value="directory">Annuaire</option><option value="calendar">Calendrier</option></select></Field><Field label="Adresse ou référence privée" wide><input className="field bg-white" required value={draft.uri} onChange={(event) => setDraft((value) => ({ ...value, uri: event.target.value }))} /></Field><Field label="Classification"><select className="field bg-white" value={draft.classification} onChange={(event) => setDraft((value) => ({ ...value, classification: event.target.value, serviceCodes: event.target.value === "public" ? [] : value.serviceCodes }))}><option value="public">Publique</option><option value="internal">Interne</option><option value="personal">Personnelle</option><option value="sensitive">Sensible</option></select></Field><Field label="Service"><select disabled={draft.classification === "public"} className="field bg-white" value={draft.serviceCodes[0] ?? ""} onChange={(event) => setDraft((value) => ({ ...value, serviceCodes: event.target.value ? [event.target.value] : [] }))}><option value="">Transverse</option>{SERVICE_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field><Field label="Valide à partir du"><input type="datetime-local" className="field bg-white" required value={draft.validFrom} onChange={(event) => setDraft((value) => ({ ...value, validFrom: event.target.value }))} /></Field><Field label="Révision avant le"><input type="datetime-local" className="field bg-white" value={draft.expiresAt} onChange={(event) => setDraft((value) => ({ ...value, expiresAt: event.target.value }))} /></Field><Field label="Empreinte de contrôle du document" wide><input className="field bg-white font-mono text-xs" required minLength={64} maxLength={64} value={draft.checksum} onChange={(event) => setDraft((value) => ({ ...value, checksum: event.target.value.trim() }))} /><small className="mt-1 block text-xs text-slate-500">Elle garantit que l’agent utilise exactement la version validée.</small></Field><div className="sm:col-span-2"><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Database className="h-4 w-4" /> Enregistrer le brouillon</button></div></form>;
}

function sourceDefaults() { return { title: "", sourceType: "official_url", uri: "", classification: "public", serviceCodes: [] as string[], validFrom: "", expiresAt: "", checksum: "" }; }

function SkillForm({ draft, setDraft, sources, busy, onSubmit, isVersion }: { draft: typeof EMPTY_SKILL_SHAPE; setDraft: React.Dispatch<React.SetStateAction<typeof EMPTY_SKILL_SHAPE>>; sources: KnowledgeSource[]; busy: boolean; onSubmit: (event: React.FormEvent) => void; isVersion: boolean }) {
  return <form onSubmit={onSubmit} className="grid gap-4 border-y border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"><Field label="Nom"><input className="field bg-white" disabled={isVersion} required value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} /></Field><Field label="Identifiant stable"><input className="field bg-white" disabled={isVersion} required placeholder="ex. ordinateur-portable" value={draft.skillKey} onChange={(event) => setDraft((value) => ({ ...value, skillKey: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }))} /></Field><Field label="Domaine"><input className="field bg-white" disabled={isVersion} required value={draft.domain} onChange={(event) => setDraft((value) => ({ ...value, domain: event.target.value }))} /></Field><Field label="Version"><input className="field bg-white" required value={draft.version} onChange={(event) => setDraft((value) => ({ ...value, version: event.target.value }))} /></Field><Field label="Niveau de confidentialité"><select className="field bg-white" value={draft.dataClassification} onChange={(event) => setDraft((value) => ({ ...value, dataClassification: event.target.value }))}><option value="public">Public</option><option value="internal">Interne</option><option value="personal">Données personnelles</option><option value="sensitive">Sensible</option></select></Field><Field label="Révision avant le"><input type="datetime-local" className="field bg-white" required value={draft.reviewDueAt} onChange={(event) => setDraft((value) => ({ ...value, reviewDueAt: event.target.value }))} /></Field><Field label="Instructions validées" wide><textarea className="field bg-white" rows={8} required minLength={20} value={draft.instructions} onChange={(event) => setDraft((value) => ({ ...value, instructions: event.target.value }))} /></Field><Field label="Sources" wide><div className="grid gap-2 sm:grid-cols-2">{sources.map((source) => <label key={source.id} className="flex gap-2 border bg-white p-2 text-sm"><input type="checkbox" checked={draft.sourceIds.includes(source.id)} onChange={(event) => setDraft((value) => ({ ...value, sourceIds: event.target.checked ? [...value.sourceIds, source.id] : value.sourceIds.filter((id) => id !== source.id) }))} /><span>{source.title}</span></label>)}{sources.length === 0 ? <p className="text-sm text-amber-700">Validez d’abord une source.</p> : null}</div></Field><Field label="Actions techniques autorisées" wide><input className="field bg-white" value={draft.allowedTools} onChange={(event) => setDraft((value) => ({ ...value, allowedTools: event.target.value }))} /></Field><p className="border-l-4 border-emerald-600 bg-emerald-50 p-3 text-sm text-emerald-950 sm:col-span-2">Les tests ne sont plus déclarés ici. Envoyez d’abord la version en validation, puis enregistrez les 11 scénarios réellement exécutés.</p><div className="sm:col-span-2"><button type="submit" disabled={busy || sources.length === 0} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><BookOpenCheck className="h-4 w-4" /> {isVersion ? "Créer la nouvelle version" : "Créer le brouillon"}</button></div></form>;
}

function EvaluationForm({ draft, setDraft, tests, busy, onSubmit, onClose }: { draft: ReturnType<typeof evaluationDefaults>; setDraft: React.Dispatch<React.SetStateAction<ReturnType<typeof evaluationDefaults>>>; tests: Evaluation[]; busy: boolean; onSubmit: (event: React.FormEvent) => void; onClose: () => void }) {
  const [plan, setPlan] = useState<SkillScenarioPlanItem[]>([]);
  const [planName, setPlanName] = useState("");
  const [planError, setPlanError] = useState("");

  async function loadPlan(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const nextPlan = parseSkillScenarioPlan(await file.text());
      setPlan(nextPlan);
      setPlanName(file.name);
      setPlanError("");
    } catch (error) {
      setPlan([]);
      setPlanName("");
      setPlanError(error instanceof Error ? error.message : "Cette matrice de tests est invalide");
    }
  }

  function prepare(item: SkillScenarioPlanItem) {
    setDraft({
      ...evaluationDefaults(item.testCaseKey),
      kind: item.kind,
      scenario: item.scenario,
      expected: item.expected,
    });
  }

  function reuse(test: Evaluation) {
    setDraft({
      testCaseKey: test.testCaseKey,
      kind: test.kind,
      result: test.result,
      runner: test.evidence.runner ?? "manual",
      scenario: test.evidence.scenario ?? "",
      expected: test.evidence.expected ?? "",
      observed: test.evidence.observed ?? "",
      confirmed: false,
    });
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-4 border-y border-emerald-200 bg-emerald-50/60 p-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <h3 className="font-bold text-slate-950">Procès-verbal d’un test exécuté</h3>
        <p className="text-sm text-slate-600">Utilisez uniquement des données fictives. Il faut 5 tests normaux, 3 ambigus et 3 interdits.</p>
      </div>

      <div className="border-y border-emerald-200 bg-white p-3 sm:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">Matrice de tests locale</p>
            <p className="text-xs text-slate-500">Le fichier Markdown est lu uniquement dans ce navigateur. Aucun résultat n’est validé automatiquement.</p>
          </div>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-emerald-300 bg-white px-3 text-sm font-semibold text-emerald-800">
            <FileUp className="h-4 w-4" />
            Importer
            <input className="sr-only" type="file" accept=".md,text/markdown,text/plain" onChange={(event) => void loadPlan(event)} />
          </label>
        </div>
        {planError ? <p role="alert" className="mt-3 border-l-4 border-red-500 bg-red-50 p-3 text-sm text-red-800">{planError}</p> : null}
        {plan.length > 0 ? (
          <div className="mt-3 divide-y border-y border-slate-200">
            <p className="px-3 py-2 text-xs font-bold uppercase text-slate-500">{planName} · {plan.length} scénarios conformes</p>
            {plan.map((item) => {
              const recorded = tests.some((test) => test.testCaseKey === item.testCaseKey);
              return (
                <div key={item.testCaseKey} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <strong className="block break-words text-slate-900">{item.testCaseKey}</strong>
                    <span className="block break-words text-xs text-slate-500">{item.scenario}</span>
                  </div>
                  <span className={recorded ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-slate-500"}>
                    {recorded ? "Consigné" : "À exécuter"}
                  </span>
                  <button type="button" disabled={busy} onClick={() => prepare(item)} className="inline-flex h-10 items-center gap-1.5 rounded-md border bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-50">
                    <ClipboardCheck className="h-3.5 w-3.5" /> Préparer
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {tests.length > 0 ? (
        <div className="divide-y border-y border-emerald-200 bg-white sm:col-span-2">
          <p className="px-3 py-2 text-xs font-bold uppercase text-slate-500">Tests déjà enregistrés</p>
          {tests.map((test) => (
            <div key={test.testCaseKey} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <strong className="min-w-0 flex-1 break-words text-slate-900">{test.testCaseKey}</strong>
              <span className="text-xs text-slate-500">{test.kind === "positive" ? "Normal" : test.kind === "ambiguous" ? "Ambigu" : "Interdit"} · {dateLabel(test.runAt)}</span>
              <span className={test.result === "pass" ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-amber-700"}>{test.result === "pass" ? "Réussi" : test.result === "fail" ? "Échec" : "À revoir"}</span>
              <button type="button" disabled={busy} onClick={() => reuse(test)} className="inline-flex h-10 items-center gap-1.5 rounded-md border bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" /> Rejouer</button>
            </div>
          ))}
        </div>
      ) : null}

      <Field label="Identifiant du scénario"><input className="field bg-white" required minLength={2} maxLength={100} value={draft.testCaseKey} onChange={(event) => setDraft((value) => ({ ...value, testCaseKey: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }))} /></Field>
      <Field label="Type de scénario"><select className="field bg-white" value={draft.kind} onChange={(event) => setDraft((value) => ({ ...value, kind: event.target.value as typeof value.kind }))}><option value="positive">Normal</option><option value="ambiguous">Ambigu</option><option value="forbidden">Interdit</option></select></Field>
      <Field label="Mode d’exécution"><select className="field bg-white" value={draft.runner} onChange={(event) => setDraft((value) => ({ ...value, runner: event.target.value as typeof value.runner }))}><option value="manual">Vérification humaine</option><option value="deterministic">Test automatisé déterministe</option></select></Field>
      <Field label="Résultat"><select className="field bg-white" value={draft.result} onChange={(event) => setDraft((value) => ({ ...value, result: event.target.value as typeof value.result }))}><option value="needs_review">À revoir</option><option value="pass">Réussi</option><option value="fail">Échec</option></select></Field>
      <Field label="Scénario réellement essayé" wide><textarea className="field bg-white" required minLength={10} maxLength={1500} rows={3} value={draft.scenario} onChange={(event) => setDraft((value) => ({ ...value, scenario: event.target.value }))} /></Field>
      <Field label="Comportement attendu"><textarea className="field bg-white" required minLength={10} maxLength={1500} rows={3} value={draft.expected} onChange={(event) => setDraft((value) => ({ ...value, expected: event.target.value }))} /></Field>
      <Field label="Comportement observé"><textarea className="field bg-white" required minLength={10} maxLength={2500} rows={3} value={draft.observed} onChange={(event) => setDraft((value) => ({ ...value, observed: event.target.value }))} /></Field>
      <label className="flex items-start gap-2 border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-950 sm:col-span-2"><input className="mt-1" type="checkbox" checked={draft.confirmed} onChange={(event) => setDraft((value) => ({ ...value, confirmed: event.target.checked }))} /><span>Je confirme avoir exécuté ce scénario sur la version en validation, avec des données fictives et sans mot de passe ni code secret.</span></label>
      <div className="flex flex-wrap gap-2 sm:col-span-2"><button type="submit" disabled={busy || !draft.confirmed} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><ClipboardCheck className="h-4 w-4" /> Enregistrer ce test</button><button type="button" disabled={busy} onClick={onClose} className="rounded-md border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Fermer</button></div>
    </form>
  );
}

function evaluationDefaults(testCaseKey = "") { return { testCaseKey, kind: "positive" as "positive" | "ambiguous" | "forbidden", result: "needs_review" as "pass" | "fail" | "needs_review", runner: "manual" as "manual" | "deterministic", scenario: "", expected: "", observed: "", confirmed: false }; }

const EMPTY_SKILL_SHAPE = { skillKey: "", name: "", domain: "", version: "1.0.0", dataClassification: "internal", instructions: "", allowedTools: "", sourceIds: [] as string[], reviewDueAt: "" };

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>{children}</label>; }
