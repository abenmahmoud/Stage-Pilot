import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftCircle,
  BadgeCheck,
  Ban,
  BookOpenCheck,
  Database,
  FileCheck2,
  History,
  LoaderCircle,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "../../lib/api";

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
type Evaluation = {
  skillVersionId: string;
  testCaseKey: string;
  kind: "positive" | "ambiguous" | "forbidden";
  result: "pass" | "fail" | "needs_review";
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
  const [tab, setTab] = useState<"skills" | "sources" | "history">("skills");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  const [versionSkillId, setVersionSkillId] = useState<string | null>(null);
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
    positive: "needs_review",
    ambiguous: "needs_review",
    forbidden: "needs_review",
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
      setRegistry(await apiFetch<Registry>("knowledge/admin"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

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
          evaluations: (["positive", "ambiguous", "forbidden"] as const).map((kind) => ({
            testCaseKey: `${skillDraft.skillKey}-${kind}`,
            kind,
            result: skillDraft[kind],
          })),
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
      positive: "needs_review",
      ambiguous: "needs_review",
      forbidden: "needs_review",
    });
    setSkillOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

      <section className="grid gap-3 sm:grid-cols-3" aria-label="État du registre">
        <Metric icon={BookOpenCheck} label="Compétences actives" value={registry.skills.filter((skill) => skill.enabled).length} />
        <Metric icon={Database} label="Sources validées" value={publishedSources.length} />
        <Metric icon={AlertTriangle} label="À vérifier" value={registry.versions.filter((version) => version.status === "review").length + registry.sources.filter((source) => source.status === "draft").length} />
      </section>

      {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        <Tab active={tab === "skills"} onClick={() => setTab("skills")}><BookOpenCheck /> Compétences</Tab>
        <Tab active={tab === "sources"} onClick={() => setTab("sources")}><Database /> Sources</Tab>
        <Tab active={tab === "history"} onClick={() => setTab("history")}><History /> Historique</Tab>
      </div>

      {loading ? <div className="flex min-h-64 items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin text-emerald-700" /></div> : null}

      {!loading && tab === "skills" ? <section className="space-y-4">
        <div className="flex justify-between gap-3"><div><h2 className="text-lg font-bold">Compétences de l’agent</h2><p className="text-sm text-slate-500">Une version publiée peut être retirée immédiatement.</p></div><button type="button" onClick={startNewSkill} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Nouvelle</button></div>
        {skillOpen ? <SkillForm draft={skillDraft} setDraft={setSkillDraft} sources={publishedSources} busy={busy} onSubmit={createSkill} isVersion={Boolean(versionSkillId)} /> : null}
        <div className="overflow-x-auto border-y border-slate-200 bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Compétence</th><th className="px-4 py-3">Version</th><th className="px-4 py-3">Sources</th><th className="px-4 py-3">Tests</th><th className="px-4 py-3">Révision</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y">{registry.skills.flatMap((skill) => (versionBySkill.get(skill.id) ?? []).map((version, index) => {
          const links = registry.links.filter((link) => link.skillVersionId === version.id);
          const tests = registry.evaluations.filter((evaluation) => evaluation.skillVersionId === version.id);
          const passed = tests.filter((test) => test.result === "pass").length;
          return <tr key={version.id}><td className="px-4 py-4"><strong className="block text-slate-900">{skill.name}</strong><span className="text-xs text-slate-500">{skill.domain} · {skill.skillKey}</span></td><td className="px-4 py-4"><Status value={version.status} /><span className="ml-2 text-xs">{version.version}</span>{skill.activeVersionId === version.id ? <span className="ml-2 text-xs font-semibold text-emerald-700">Active</span> : null}</td><td className="px-4 py-4">{links.length}</td><td className="px-4 py-4"><span className={passed === 3 ? "text-emerald-700" : "text-amber-700"}>{passed}/{tests.length || 3}</span></td><td className="px-4 py-4 text-xs">{dateLabel(version.reviewDueAt)}</td><td className="px-4 py-4"><div className="flex justify-end gap-2">{index === 0 ? <IconAction title="Créer une nouvelle version" disabled={busy} onClick={() => startNewVersion(skill, version)}><Plus /></IconAction> : null}{version.status === "draft" ? <IconAction title="Envoyer en validation" disabled={busy} onClick={() => void versionAction(version.id, "submit_review")}><Send /></IconAction> : null}{version.status === "review" ? <IconAction title="Publier" disabled={busy} onClick={() => void versionAction(version.id, "publish")}><BadgeCheck /></IconAction> : null}{version.status === "published" && skill.activeVersionId !== version.id ? <IconAction title="Réactiver cette version" disabled={busy} onClick={() => void versionAction(version.id, "rollback")}><ArrowLeftCircle /></IconAction> : null}{version.status === "published" ? <IconAction title="Retirer" disabled={busy} onClick={() => void versionAction(version.id, "retire")}><Ban /></IconAction> : null}</div></td></tr>;
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

function SourceForm({ draft, setDraft, busy, onSubmit }: { draft: ReturnType<typeof sourceDefaults>; setDraft: React.Dispatch<React.SetStateAction<ReturnType<typeof sourceDefaults>>>; busy: boolean; onSubmit: (event: React.FormEvent) => void }) {
  return <form onSubmit={onSubmit} className="grid gap-4 border-y border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"><Field label="Titre"><input className="field bg-white" required value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} /></Field><Field label="Type"><select className="field bg-white" value={draft.sourceType} onChange={(event) => setDraft((value) => ({ ...value, sourceType: event.target.value }))}><option value="official_url">Page officielle</option><option value="internal_document">Document interne</option><option value="procedure">Procédure</option><option value="directory">Annuaire</option><option value="calendar">Calendrier</option></select></Field><Field label="Adresse ou référence privée" wide><input className="field bg-white" required value={draft.uri} onChange={(event) => setDraft((value) => ({ ...value, uri: event.target.value }))} /></Field><Field label="Classification"><select className="field bg-white" value={draft.classification} onChange={(event) => setDraft((value) => ({ ...value, classification: event.target.value, serviceCodes: event.target.value === "public" ? [] : value.serviceCodes }))}><option value="public">Publique</option><option value="internal">Interne</option><option value="personal">Personnelle</option><option value="sensitive">Sensible</option></select></Field><Field label="Service"><select disabled={draft.classification === "public"} className="field bg-white" value={draft.serviceCodes[0] ?? ""} onChange={(event) => setDraft((value) => ({ ...value, serviceCodes: event.target.value ? [event.target.value] : [] }))}><option value="">Transverse</option>{SERVICE_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field><Field label="Valide à partir du"><input type="datetime-local" className="field bg-white" required value={draft.validFrom} onChange={(event) => setDraft((value) => ({ ...value, validFrom: event.target.value }))} /></Field><Field label="Révision avant le"><input type="datetime-local" className="field bg-white" value={draft.expiresAt} onChange={(event) => setDraft((value) => ({ ...value, expiresAt: event.target.value }))} /></Field><Field label="Empreinte de contrôle du document" wide><input className="field bg-white font-mono text-xs" required minLength={64} maxLength={64} value={draft.checksum} onChange={(event) => setDraft((value) => ({ ...value, checksum: event.target.value.trim() }))} /><small className="mt-1 block text-xs text-slate-500">Elle garantit que l’agent utilise exactement la version validée.</small></Field><div className="sm:col-span-2"><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Database className="h-4 w-4" /> Enregistrer le brouillon</button></div></form>;
}

function sourceDefaults() { return { title: "", sourceType: "official_url", uri: "", classification: "public", serviceCodes: [] as string[], validFrom: "", expiresAt: "", checksum: "" }; }

function SkillForm({ draft, setDraft, sources, busy, onSubmit, isVersion }: { draft: typeof EMPTY_SKILL_SHAPE; setDraft: React.Dispatch<React.SetStateAction<typeof EMPTY_SKILL_SHAPE>>; sources: KnowledgeSource[]; busy: boolean; onSubmit: (event: React.FormEvent) => void; isVersion: boolean }) {
  return <form onSubmit={onSubmit} className="grid gap-4 border-y border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"><Field label="Nom"><input className="field bg-white" disabled={isVersion} required value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} /></Field><Field label="Identifiant stable"><input className="field bg-white" disabled={isVersion} required placeholder="ex. ordinateur-portable" value={draft.skillKey} onChange={(event) => setDraft((value) => ({ ...value, skillKey: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }))} /></Field><Field label="Domaine"><input className="field bg-white" disabled={isVersion} required value={draft.domain} onChange={(event) => setDraft((value) => ({ ...value, domain: event.target.value }))} /></Field><Field label="Version"><input className="field bg-white" required value={draft.version} onChange={(event) => setDraft((value) => ({ ...value, version: event.target.value }))} /></Field><Field label="Niveau de confidentialité"><select className="field bg-white" value={draft.dataClassification} onChange={(event) => setDraft((value) => ({ ...value, dataClassification: event.target.value }))}><option value="public">Public</option><option value="internal">Interne</option><option value="personal">Données personnelles</option><option value="sensitive">Sensible</option></select></Field><Field label="Révision avant le"><input type="datetime-local" className="field bg-white" required value={draft.reviewDueAt} onChange={(event) => setDraft((value) => ({ ...value, reviewDueAt: event.target.value }))} /></Field><Field label="Instructions validées" wide><textarea className="field bg-white" rows={8} required minLength={20} value={draft.instructions} onChange={(event) => setDraft((value) => ({ ...value, instructions: event.target.value }))} /></Field><Field label="Sources" wide><div className="grid gap-2 sm:grid-cols-2">{sources.map((source) => <label key={source.id} className="flex gap-2 border bg-white p-2 text-sm"><input type="checkbox" checked={draft.sourceIds.includes(source.id)} onChange={(event) => setDraft((value) => ({ ...value, sourceIds: event.target.checked ? [...value.sourceIds, source.id] : value.sourceIds.filter((id) => id !== source.id) }))} /><span>{source.title}</span></label>)}{sources.length === 0 ? <p className="text-sm text-amber-700">Validez d’abord une source.</p> : null}</div></Field><Field label="Actions techniques autorisées" wide><input className="field bg-white" value={draft.allowedTools} onChange={(event) => setDraft((value) => ({ ...value, allowedTools: event.target.value }))} /></Field>{(["positive", "ambiguous", "forbidden"] as const).map((kind) => <Field key={kind} label={kind === "positive" ? "Test normal" : kind === "ambiguous" ? "Test ambigu" : "Test interdit"}><select className="field bg-white" value={draft[kind]} onChange={(event) => setDraft((value) => ({ ...value, [kind]: event.target.value }))}><option value="needs_review">À vérifier</option><option value="pass">Réussi</option><option value="fail">Échec</option></select></Field>)}<div className="sm:col-span-2"><button type="submit" disabled={busy || sources.length === 0} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><BookOpenCheck className="h-4 w-4" /> {isVersion ? "Créer la nouvelle version" : "Créer le brouillon"}</button></div></form>;
}

const EMPTY_SKILL_SHAPE = { skillKey: "", name: "", domain: "", version: "1.0.0", dataClassification: "internal", instructions: "", allowedTools: "", sourceIds: [] as string[], reviewDueAt: "", positive: "needs_review", ambiguous: "needs_review", forbidden: "needs_review" };

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>{children}</label>; }
