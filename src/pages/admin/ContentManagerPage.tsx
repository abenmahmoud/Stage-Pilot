import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Archive, BadgeCheck, Bold, Bot, Check, Copy, Download, ExternalLink, FileText, Heading2,
  Image, Italic, Link, List, LoaderCircle, Monitor, Newspaper, Plus, Quote,
  RotateCcw, Save, Search, Send, Settings2, Smartphone, Sparkles, Upload, X,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { supabase } from "../../lib/supabase-browser";

type ContentType = "article" | "alerte" | "page" | "document";
type ContentStatus = "brouillon" | "a_valider" | "publie" | "archive";
type Audience = "tous" | "eleves" | "parents" | "personnels" | "professeurs";
type Tab = "contenus" | "documents" | "modeles";
type ReviewFilter = "all" | "pending" | "ready";

type Item = {
  id: string; contentType: ContentType; slug: string; title: string; summary: string;
  bodyMarkdown: string; category: string; audience: Audience; status: ContentStatus;
  templateId: string | null; featured: boolean; metaTitle: string | null;
  metaDescription: string | null; publishAt: string | null; expiresAt: string | null;
  publishedAt: string | null; version: number; publishedVersion: number | null; updatedAt: string;
  sourceSystem: string | null; sourceUrl: string | null; sourceUpdatedAt: string | null;
  sourceDisposition: "durable" | "archive" | "a_confirmer" | null;
  needsReview: boolean; importedAt: string | null; reviewedAt: string | null;
};

type Asset = {
  id: string; originalName: string; mimeType: string; sizeBytes: number;
  assetKind: "image" | "document"; title: string; altText: string | null;
  status: string; signedUrl?: string | null; url?: string | null;
  importKey?: string | null;
  assetRole?: "couverture" | "illustration" | "document";
  publicLabel?: string; position?: number;
};

type Version = { id: string; version: number; createdAt: string };
type Template = {
  id: string; slug: string; name: string; contentType: ContentType; description: string;
  defaultTitle: string; defaultSummary: string; defaultBodyMarkdown: string;
  active: boolean; version: number;
};

type Draft = {
  id: string | null; contentType: ContentType; slug: string; title: string;
  summary: string; bodyMarkdown: string; category: string; audience: Audience;
  status: ContentStatus; templateId: string | null; featured: boolean;
  metaTitle: string; metaDescription: string; publishAt: string; expiresAt: string;
  sourceSystem: string | null; sourceUrl: string | null; sourceUpdatedAt: string | null;
  sourceDisposition: "durable" | "archive" | "a_confirmer" | null;
  needsReview: boolean; importedAt: string | null; reviewedAt: string | null;
  assets: Array<{ assetId: string; assetRole: "couverture" | "illustration" | "document"; publicLabel: string; position: number }>;
};

type Suggestion = {
  title: string; summary: string; bodyMarkdown: string; metaTitle: string;
  metaDescription: string; suggestedTitles: string[]; reviewNotes: string[];
};

type LegacyBatch = {
  phase: "media" | "contents";
  nextOffset: number;
  total: number;
  done: boolean;
  results: Array<{ ok: boolean; error?: string }>;
};

const TYPES: Record<ContentType, string> = { article: "Article", alerte: "Information urgente", page: "Page", document: "Document" };
const STATUSES: Record<ContentStatus, string> = { brouillon: "Brouillon", a_valider: "À valider", publie: "Publié", archive: "Archivé" };
const STATUS_STYLE: Record<ContentStatus, string> = {
  brouillon: "bg-slate-100 text-slate-700", a_valider: "bg-amber-100 text-amber-800",
  publie: "bg-emerald-100 text-emerald-800", archive: "bg-gray-200 text-gray-600",
};
const EMPTY: Draft = {
  id: null, contentType: "article", slug: "", title: "", summary: "", bodyMarkdown: "",
  category: "Vie du lycée", audience: "tous", status: "brouillon", templateId: null,
  featured: false, metaTitle: "", metaDescription: "", publishAt: "", expiresAt: "", assets: [],
  sourceSystem: null, sourceUrl: null, sourceUpdatedAt: null, sourceDisposition: null,
  needsReview: false, importedAt: null, reviewedAt: null,
};

function draftSignature(value: Draft) {
  return JSON.stringify(value);
}

function slug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 140);
}

function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return Number.isNaN(local.getTime()) ? "" : local.toISOString().slice(0, 16);
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

function Status({ value }: { value: ContentStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[value]}`}>{STATUSES[value]}</span>;
}

function Preview({ draft, mobile }: { draft: Draft; mobile: boolean }) {
  return (
    <article className={`content-markdown bg-white ${mobile ? "px-5 py-7" : "mx-auto max-w-3xl px-8 py-10"}`}>
      <p className="!mt-0 text-xs font-bold uppercase text-emerald-700">{draft.category} · {TYPES[draft.contentType]}</p>
      <h1>{draft.title || "Titre de votre contenu"}</h1>
      {draft.summary ? <p className="lead">{draft.summary}</p> : null}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.bodyMarkdown || "Votre texte apparaîtra ici."}</ReactMarkdown>
    </article>
  );
}

function resolveLegacyMedia(bodyMarkdown: string, links: Draft["assets"], assetMap: Map<string, Asset>) {
  const urls = new Map<string, string>();
  for (const link of links) {
    const asset = assetMap.get(link.assetId);
    const match = asset?.importKey?.match(/^wordpress:media:(\d+)$/);
    if (match && asset?.url) urls.set(match[1], asset.url);
  }
  return bodyMarkdown.replace(/legacy-media:(\d+)/g, (reference, mediaId) => urls.get(mediaId) ?? reference);
}

export default function ContentManagerPage() {
  const { user } = useAuth();
  const canPublish = user?.role === "superadmin" || user?.role === "proviseur";
  const canImportLegacy = canPublish || user?.role === "administration";
  const [tab, setTab] = useState<Tab>("contenus");
  const [items, setItems] = useState<Item[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [savedDraftSignature, setSavedDraftSignature] = useState(() => draftSignature(EMPTY));
  const [templateId, setTemplateId] = useState("");
  const [templateDraft, setTemplateDraft] = useState<Template | null>(null);
  const [search, setSearch] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<"edit" | "desktop" | "mobile">("edit");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiAction, setAiAction] = useState("ameliorer");
  const [aiInstructions, setAiInstructions] = useState("");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState("");
  const [fileAlt, setFileAlt] = useState("");
  const [legacyBusy, setLegacyBusy] = useState(false);
  const [legacyProgress, setLegacyProgress] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  async function load(selectId?: string) {
    setLoading(true);
    try {
      const data = await apiFetch<{ items: Item[]; templates: Template[]; assets: Asset[] }>("content/admin");
      setItems(data.items); setTemplates(data.templates); setAssets(data.assets.filter((asset) => asset.status === "ready"));
      if (selectId) await openItem(selectId);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }

  async function openItem(id: string) {
    setBusy(true); setError("");
    try {
      const data = await apiFetch<{ item: Item; assets: Asset[]; versions: Version[] }>(`content/admin/${id}`);
      const item = data.item;
      setAssets((current) => {
        const linkedIds = new Set(data.assets.map((asset) => asset.id));
        return [...data.assets, ...current.filter((asset) => !linkedIds.has(asset.id))];
      });
      const nextDraft: Draft = {
        id: item.id, contentType: item.contentType, slug: item.slug, title: item.title,
        summary: item.summary, bodyMarkdown: item.bodyMarkdown, category: item.category,
        audience: item.audience, status: item.status, templateId: item.templateId,
        featured: item.featured, metaTitle: item.metaTitle ?? "", metaDescription: item.metaDescription ?? "",
        publishAt: localDate(item.publishAt), expiresAt: localDate(item.expiresAt),
        sourceSystem: item.sourceSystem, sourceUrl: item.sourceUrl,
        sourceUpdatedAt: item.sourceUpdatedAt, sourceDisposition: item.sourceDisposition,
        needsReview: item.needsReview, importedAt: item.importedAt, reviewedAt: item.reviewedAt,
        assets: data.assets.map((asset, position) => ({
          assetId: asset.id, assetRole: asset.assetRole ?? (asset.assetKind === "image" ? "illustration" : "document"),
          publicLabel: asset.publicLabel ?? asset.title, position: asset.position ?? position,
        })),
      };
      setDraft(nextDraft);
      setSavedDraftSignature(draftSignature(nextDraft));
      setVersions(data.versions); setMode("edit"); setNotice("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Ouverture impossible"); }
    finally { setBusy(false); }
  }

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => (tab === "documents" ? item.contentType === "document" : item.contentType !== "document")
      && (tab === "documents" || reviewFilter === "all" || (reviewFilter === "pending" ? item.needsReview : item.sourceSystem === "wordpress" && !item.needsReview))
      && (!query || `${item.title} ${item.category}`.toLowerCase().includes(query)));
  }, [items, reviewFilter, search, tab]);
  const reviewCounts = useMemo(() => {
    const legacy = items.filter((item) => item.sourceSystem === "wordpress");
    return {
      all: legacy.length,
      pending: legacy.filter((item) => item.needsReview).length,
      ready: legacy.filter((item) => !item.needsReview).length,
    };
  }, [items]);
  const assetMap = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const previewDraft = useMemo(
    () => ({ ...draft, bodyMarkdown: resolveLegacyMedia(draft.bodyMarkdown, draft.assets, assetMap) }),
    [draft, assetMap]
  );
  const draftDirty = useMemo(
    () => draftSignature(draft) !== savedDraftSignature,
    [draft, savedDraftSignature]
  );

  useEffect(() => {
    if (!draftDirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [draftDirty]);

  function confirmDraftChange() {
    return !draftDirty || window.confirm("Des modifications ne sont pas enregistrées. Les abandonner ?");
  }

  function newDraft() {
    if (!confirmDraftChange()) return;
    const template = templates.find((value) => value.id === templateId);
    const contentType = tab === "documents" ? "document" : template?.contentType ?? "article";
    const nextDraft: Draft = { ...EMPTY, contentType, templateId: template?.id ?? null, title: template?.defaultTitle ?? "",
      slug: slug(template?.defaultTitle ?? ""), summary: template?.defaultSummary ?? "", bodyMarkdown: template?.defaultBodyMarkdown ?? "" };
    setDraft(nextDraft);
    setSavedDraftSignature(draftSignature({ ...EMPTY, contentType }));
    setVersions([]); setMode("edit"); setError(""); setNotice("");
  }

  async function discardDraftChanges() {
    if (!window.confirm("Annuler les modifications non enregistrées ?")) return;
    if (draft.id) {
      await openItem(draft.id);
      return;
    }
    const nextDraft: Draft = { ...EMPTY, contentType: tab === "documents" ? "document" : "article" };
    setDraft(nextDraft);
    setSavedDraftSignature(draftSignature(nextDraft));
    setVersions([]); setNotice(""); setError("");
  }

  function payload() {
    return { ...draft, id: undefined, status: undefined,
      publishAt: draft.publishAt ? new Date(draft.publishAt).toISOString() : null,
      expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null };
  }

  async function save() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await apiFetch<{ item: Item }>(draft.id ? `content/admin/${draft.id}` : "content/admin", {
        method: draft.id ? "PATCH" : "POST", body: JSON.stringify(payload()),
      });
      setNotice("Brouillon enregistré. La version précédente est conservée."); await load(result.item.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Enregistrement impossible"); }
    finally { setBusy(false); }
  }

  async function act(action: "submit_review" | "publish" | "archive" | "duplicate" | "restore" | "verify_source", version?: number) {
    if (!draft.id) return;
    const question = action === "publish" ? "Publier cette version sur le site ?" : action === "archive" ? "Archiver et retirer ce contenu du site ?" : action === "restore" ? `Restaurer la version ${version} ?` : action === "verify_source" ? "Confirmer que le texte, les dates, les liens et les fichiers ont été vérifiés ?" : null;
    if (question && !window.confirm(question)) return;
    setBusy(true); setError("");
    try {
      const result = await apiFetch<{ item: Item }>(`content/admin/${draft.id}/action`, { method: "POST", body: JSON.stringify({ action, version }) });
      setNotice(action === "publish" ? "Contenu publié." : action === "submit_review" ? "Contenu envoyé à la direction pour validation." : action === "verify_source" ? "Reprise vérifiée. Le contenu peut maintenant être publié." : "Action terminée.");
      await load(result.item.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Action impossible"); }
    finally { setBusy(false); }
  }

  function insert(before: string, after = "", placeholder = "texte") {
    const area = textRef.current; if (!area) return;
    const start = area.selectionStart; const end = area.selectionEnd;
    const selected = draft.bodyMarkdown.slice(start, end) || placeholder;
    setDraft((value) => ({ ...value, bodyMarkdown: `${value.bodyMarkdown.slice(0, start)}${before}${selected}${after}${value.bodyMarkdown.slice(end)}` }));
    setTimeout(() => { area.focus(); area.setSelectionRange(start + before.length, start + before.length + selected.length); }, 0);
  }

  async function upload() {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const reserve = await apiFetch<{ asset: Asset; upload: { path: string; token: string } }>("content/admin/assets", { method: "POST", body: JSON.stringify({
        originalName: file.name, mimeType: file.type, sizeBytes: file.size,
        title: fileTitle || file.name.replace(/\.[^.]+$/, ""), altText: file.type.startsWith("image/") ? fileAlt : null,
      }) });
      const result = await supabase.storage.from("site-content").uploadToSignedUrl(reserve.upload.path, reserve.upload.token, file, { contentType: file.type });
      if (result.error) throw new Error("Le transfert du fichier a échoué");
      const confirmed = await apiFetch<{ asset: Asset }>(`content/admin/assets/${reserve.asset.id}/confirm`, { method: "POST" });
      setAssets((value) => [confirmed.asset, ...value]);
      setDraft((value) => ({ ...value, assets: [...value.assets, { assetId: confirmed.asset.id,
        assetRole: confirmed.asset.assetKind === "image" ? "illustration" : "document",
        publicLabel: confirmed.asset.title, position: value.assets.length }] }));
      setFile(null); setFileTitle(""); setFileAlt(""); setNotice("Fichier ajouté. Enregistrez maintenant le brouillon.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Ajout impossible"); }
    finally { setBusy(false); }
  }

  async function askAi() {
    setBusy(true); setSuggestion(null); setError("");
    try {
      const result = await apiFetch<{ suggestion: Suggestion }>("content/admin/assist", { method: "POST", body: JSON.stringify({
        action: aiAction, contentType: draft.contentType, title: draft.title, summary: draft.summary,
        bodyMarkdown: draft.bodyMarkdown, instructions: aiInstructions,
      }) });
      setSuggestion(result.suggestion);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "L’aide IA ne répond pas"); }
    finally { setBusy(false); }
  }

  function applySuggestion() {
    if (!suggestion) return;
    setDraft((value) => ({ ...value, title: suggestion.title || value.title, slug: value.slug || slug(suggestion.title),
      summary: suggestion.summary, bodyMarkdown: suggestion.bodyMarkdown, metaTitle: suggestion.metaTitle, metaDescription: suggestion.metaDescription }));
    setAiOpen(false); setNotice("Proposition ajoutée au brouillon. Relisez-la avant d’enregistrer.");
  }

  async function importLegacySite() {
    if (!canImportLegacy || legacyBusy) return;
    if (!window.confirm("Importer les pages, actualités et médias de l’ancien site comme brouillons à vérifier ?")) return;
    setLegacyBusy(true); setError(""); setNotice("");
    let failures = 0;
    try {
      for (const phase of ["media", "contents"] as const) {
        let offset = 0;
        let done = false;
        while (!done) {
          const label = phase === "media" ? "Médias" : "Pages et actualités";
          setLegacyProgress(`${label} : ${offset} traité(s)…`);
          const batch = await apiFetch<LegacyBatch>("content/admin/legacy-import", {
            method: "POST",
            body: JSON.stringify({ phase, offset, limit: phase === "media" ? 4 : 10 }),
          });
          failures += batch.results.filter((result) => !result.ok).length;
          offset = batch.nextOffset;
          done = batch.done;
          setLegacyProgress(`${label} : ${Math.min(offset, batch.total)} / ${batch.total}`);
        }
      }
      await load();
      setNotice(failures
        ? `Reprise terminée avec ${failures} élément(s) à récupérer manuellement. Aucun contenu n’a été publié.`
        : "Reprise terminée. Tous les contenus sont en brouillon et attendent la vérification de la direction.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La reprise s’est interrompue. Vous pouvez la relancer sans créer de doublons.");
    } finally {
      setLegacyBusy(false); setLegacyProgress("");
    }
  }

  if (loading && !items.length) return <div className="flex min-h-[50vh] items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin text-emerald-700" /></div>;

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Newspaper className="h-4 w-4" /> Espace agent</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Contenus du site</h1><p className="mt-1 text-sm text-slate-600">Articles, documents, pages et modèles du lycée.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">{reviewCounts.pending ? <button type="button" onClick={() => { const next = items.find((item) => item.needsReview); if (next && confirmDraftChange()) void openItem(next.id); }} className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-800 px-4 py-2.5 text-sm font-semibold text-white"><BadgeCheck className="h-4 w-4" /> Vérifier la reprise <span className="rounded bg-white/20 px-1.5 py-0.5 text-xs">{reviewCounts.pending}</span></button> : null}{canImportLegacy ? <button type="button" disabled={legacyBusy} onClick={importLegacySite} className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 disabled:opacity-60">{legacyBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {legacyProgress || "Reprendre l’ancien site"}</button> : null}<a href="/?view=news" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800"><Monitor className="h-4 w-4" /> Voir le site</a></div>
      </header>

      <div className="inline-flex max-w-full overflow-x-auto rounded-md border border-slate-200 bg-white p-1" role="tablist">
        {(["contenus", "documents", "modeles"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => { if (tab === value || confirmDraftChange()) setTab(value); }} className={`whitespace-nowrap rounded px-4 py-2 text-sm font-semibold ${tab === value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{value === "contenus" ? "Articles et pages" : value === "documents" ? "Documents" : "Modèles"}</button>)}
      </div>
      {error ? <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"><X className="h-4 w-4 shrink-0" />{error}</div> : null}
      {notice ? <div className="flex gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><Check className="h-4 w-4 shrink-0" />{notice}</div> : null}

      {tab === "modeles" ? (
        <Templates templates={templates} canPublish={canPublish} current={templateDraft} setCurrent={setTemplateDraft} onSaved={load} setError={setError} setNotice={setNotice} />
      ) : (
        <div className="grid min-h-[680px] overflow-hidden rounded-md border border-slate-200 bg-white xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-slate-50 xl:border-b-0 xl:border-r">
            <div className="space-y-3 border-b border-slate-200 p-4"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm" placeholder="Rechercher" /></div>{tab === "contenus" && reviewCounts.all ? <div className="grid grid-cols-3 rounded-md border border-slate-200 bg-white p-1" role="group" aria-label="Filtrer la reprise de l’ancien site">{([['all', 'Tous'], ['pending', 'À vérifier'], ['ready', 'Vérifiés']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={reviewFilter === value} onClick={() => setReviewFilter(value)} className={`min-w-0 rounded px-1 py-2 text-xs font-semibold ${reviewFilter === value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}><span className="block truncate">{label}</span><span className={`mt-0.5 block text-[11px] ${reviewFilter === value ? "text-slate-300" : "text-slate-400"}`}>{reviewCounts[value]}</span></button>)}</div> : null}<div className="flex gap-2"><select value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 text-sm"><option value="">Sans modèle</option>{templates.filter((value) => value.active).map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}</select><button type="button" onClick={newDraft} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white" title="Nouveau contenu" aria-label="Nouveau contenu"><Plus className="h-4 w-4" /></button></div></div>
            <div className="max-h-[600px] space-y-1 overflow-y-auto p-2 xl:max-h-[calc(100vh-300px)]">{visible.length ? visible.map((item) => <button key={item.id} type="button" onClick={() => { if (draft.id === item.id) return; if (confirmDraftChange()) void openItem(item.id); }} className={`w-full rounded-md border p-3 text-left ${draft.id === item.id ? "border-emerald-300 bg-emerald-50" : "border-transparent hover:bg-white"}`}><div className="mb-2 flex items-center justify-between gap-2"><span className="text-[11px] font-semibold uppercase text-slate-500">{TYPES[item.contentType]}</span><Status value={item.status} /></div>{item.needsReview ? <span className="mb-2 inline-flex rounded bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900">Ancien site · à vérifier</span> : null}<p className="line-clamp-2 text-sm font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-xs text-slate-500">Modifié le {displayDate(item.updatedAt)}</p></button>) : <p className="px-3 py-8 text-center text-sm text-slate-500">Aucun contenu.</p>}</div>
          </aside>

          <section className="min-w-0">
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur"><div><p className="text-sm font-semibold text-slate-900">{draft.title || "Nouveau contenu"}</p><p className="text-xs text-slate-500">{draft.id ? `Version ${items.find((item) => item.id === draft.id)?.version ?? 1}` : "Pas encore enregistré"}</p>{draftDirty ? <p className="mt-1 text-xs font-semibold text-amber-700">Modifications non enregistrées</p> : null}</div><div className="flex flex-wrap gap-2"><div className="inline-flex rounded-md border border-slate-200 p-0.5"><ModeButton active={mode === "edit"} onClick={() => setMode("edit")} title="Modifier"><Settings2 /></ModeButton><ModeButton active={mode === "desktop"} onClick={() => setMode("desktop")} title="Aperçu ordinateur"><Monitor /></ModeButton><ModeButton active={mode === "mobile"} onClick={() => setMode("mobile")} title="Aperçu téléphone"><Smartphone /></ModeButton></div><button type="button" onClick={() => setAiOpen(true)} className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800"><Sparkles className="h-4 w-4" /> Aide IA</button>{draftDirty ? <button type="button" disabled={busy} onClick={() => void discardDraftChanges()} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"><RotateCcw className="h-4 w-4" /> Annuler</button> : null}<button type="button" disabled={busy || !draftDirty} onClick={save} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer</button></div></div>

            {mode !== "edit" ? <div className="min-h-[620px] bg-slate-100 p-4 sm:p-8"><div className={mode === "mobile" ? "mx-auto max-w-[390px] overflow-hidden rounded-[24px] border-[8px] border-slate-900 shadow-xl" : "mx-auto max-w-5xl overflow-hidden rounded-md border border-slate-200 shadow-sm"}><Preview draft={previewDraft} mobile={mode === "mobile"} /></div></div> : (
              <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0 space-y-5 p-4 sm:p-6">
                  <Field label="Titre"><input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value, slug: !value.slug || value.slug === slug(value.title) ? slug(event.target.value) : value.slug }))} maxLength={180} className="field text-lg font-semibold" placeholder="Titre clair et précis" /></Field>
                  <Field label="Résumé"><textarea value={draft.summary} onChange={(event) => setDraft((value) => ({ ...value, summary: event.target.value }))} maxLength={600} rows={3} className="field resize-y leading-6" placeholder="L’essentiel en deux ou trois phrases" /></Field>
                  <div><p className="mb-1.5 text-sm font-semibold text-slate-800">Message</p><div className="flex flex-wrap gap-1 rounded-t-md border border-b-0 border-slate-300 bg-slate-50 p-2"><Tool title="Gras" onClick={() => insert("**", "**")}><Bold /></Tool><Tool title="Italique" onClick={() => insert("_", "_")}><Italic /></Tool><Tool title="Sous-titre" onClick={() => insert("## ", "", "Sous-titre")}><Heading2 /></Tool><Tool title="Liste" onClick={() => insert("- ", "", "élément")}><List /></Tool><Tool title="Citation" onClick={() => insert("> ", "", "information importante")}><Quote /></Tool><Tool title="Lien" onClick={() => insert("[", "](https://)", "texte du lien")}><Link /></Tool></div><textarea ref={textRef} value={draft.bodyMarkdown} onChange={(event) => setDraft((value) => ({ ...value, bodyMarkdown: event.target.value }))} rows={18} className="w-full resize-y rounded-b-md border border-slate-300 px-4 py-3 font-mono text-sm leading-6" placeholder="Écrivez le contenu ici…" /></div>
                  <div className="border-t border-slate-200 pt-5"><h2 className="font-bold text-slate-900">Fichiers et images</h2><p className="mt-1 text-sm text-slate-500">PDF, Word, Excel, JPG, PNG ou WebP, jusqu’à 10 Mo.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Choisir un fichier" wide><input type="file" accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.webp" onChange={(event) => { const next = event.target.files?.[0] ?? null; setFile(next); setFileTitle(next?.name.replace(/\.[^.]+$/, "") ?? ""); }} className="field bg-white" /></Field><Field label="Titre du fichier"><input value={fileTitle} onChange={(event) => setFileTitle(event.target.value)} className="field" /></Field><Field label="Description de l’image"><input value={fileAlt} onChange={(event) => setFileAlt(event.target.value)} disabled={!file?.type.startsWith("image/")} className="field disabled:bg-slate-100" placeholder="Obligatoire pour une image" /></Field></div><button type="button" disabled={!file || busy} onClick={upload} className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"><Upload className="h-4 w-4" /> Ajouter au contenu</button><div className="mt-4 space-y-2">{draft.assets.map((entry) => { const asset = assetMap.get(entry.assetId); return <div key={entry.assetId} className="flex items-center gap-3 rounded-md border border-slate-200 p-3"><span className="flex h-9 w-9 items-center justify-center rounded bg-slate-100">{asset?.assetKind === "image" ? <Image className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{asset?.title ?? entry.publicLabel}</p><p className="text-xs text-slate-500">{asset?.originalName}</p></div><button type="button" title="Retirer" onClick={() => setDraft((value) => ({ ...value, assets: value.assets.filter((link) => link.assetId !== entry.assetId) }))} className="p-2 text-slate-500"><X className="h-4 w-4" /></button></div>; })}</div></div>
                </div>

                <aside className="space-y-4 border-t border-slate-200 bg-slate-50 p-4 lg:border-l lg:border-t-0"><div><p className="mb-2 text-sm font-bold">Publication</p><Status value={draft.status} /></div>{draft.sourceSystem ? <div className={`rounded-md border p-3 ${draft.needsReview ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}><div className="flex items-start gap-2"><BadgeCheck className={`mt-0.5 h-4 w-4 shrink-0 ${draft.needsReview ? "text-amber-700" : "text-emerald-700"}`} /><div><strong className="block text-sm">{draft.needsReview ? "Reprise à vérifier" : "Reprise vérifiée"}</strong><p className="mt-1 text-xs text-slate-600">Ancien site{draft.sourceUpdatedAt ? ` · modifié le ${displayDate(draft.sourceUpdatedAt)}` : ""}</p>{draft.sourceUrl ? <a href={draft.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">Voir la source <ExternalLink className="h-3.5 w-3.5" /></a> : null}</div></div>{draft.needsReview && canPublish ? <button type="button" onClick={() => act("verify_source")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-amber-800 px-3 py-2 text-sm font-semibold text-white"><Check className="h-4 w-4" /> Marquer comme vérifié</button> : null}</div> : null}<Select label="Type" value={draft.contentType} onChange={(value) => setDraft((draftValue) => ({ ...draftValue, contentType: value as ContentType }))}>{Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><Field label="Catégorie"><input value={draft.category} onChange={(event) => setDraft((value) => ({ ...value, category: event.target.value }))} className="field bg-white" /></Field><Select label="Public" value={draft.audience} onChange={(value) => setDraft((draftValue) => ({ ...draftValue, audience: value as Audience }))}><option value="tous">Tout le monde</option><option value="eleves">Élèves</option><option value="parents">Parents</option><option value="professeurs">Professeurs</option><option value="personnels">Personnels</option></Select><Field label="Adresse de la page"><input value={draft.slug} onChange={(event) => setDraft((value) => ({ ...value, slug: slug(event.target.value) }))} className="field bg-white" /></Field><label className="flex gap-3 rounded-md border border-slate-200 bg-white p-3"><input type="checkbox" checked={draft.featured} onChange={(event) => setDraft((value) => ({ ...value, featured: event.target.checked }))} /><span><strong className="block text-sm">Mettre à la une</strong><span className="text-xs text-slate-500">Affiché en priorité.</span></span></label><Field label="Publication prévue"><input type="datetime-local" value={draft.publishAt} onChange={(event) => setDraft((value) => ({ ...value, publishAt: event.target.value }))} className="field bg-white" /></Field><Field label="Retrait automatique"><input type="datetime-local" value={draft.expiresAt} onChange={(event) => setDraft((value) => ({ ...value, expiresAt: event.target.value }))} className="field bg-white" /></Field><details className="border-t pt-4"><summary className="cursor-pointer text-sm font-semibold">Référencement</summary><div className="mt-3 space-y-3"><Field label="Titre de recherche"><input value={draft.metaTitle} onChange={(event) => setDraft((value) => ({ ...value, metaTitle: event.target.value }))} className="field bg-white" /></Field><Field label="Description"><textarea rows={3} value={draft.metaDescription} onChange={(event) => setDraft((value) => ({ ...value, metaDescription: event.target.value }))} className="field bg-white" /></Field></div></details>
                  {draft.id && draft.status !== "archive" ? <div className="space-y-2 border-t pt-4"><Action onClick={() => act("submit_review")} tone="amber"><Send /> Faire valider</Action>{canPublish && !draft.needsReview ? <Action onClick={() => act("publish")} tone="green"><Check /> Publier</Action> : null}<Action onClick={() => act("duplicate")}><Copy /> Dupliquer</Action>{canPublish ? <Action onClick={() => act("archive")}><Archive /> Archiver</Action> : null}</div> : null}
                  {draft.id && draft.status === "archive" && canPublish && versions[0] ? <Action onClick={() => act("restore", versions[0].version)} tone="dark"><RotateCcw /> Restaurer en brouillon</Action> : null}
                  {draft.id && versions.length > 1 && canPublish ? <details className="border-t pt-4"><summary className="cursor-pointer text-sm font-semibold">Anciennes versions</summary><div className="mt-2 space-y-2">{versions.slice(1).map((version) => <button key={version.id} type="button" onClick={() => act("restore", version.version)} className="flex w-full items-center justify-between rounded-md border bg-white p-2 text-left text-xs"><span>Version {version.version}<br />{displayDate(version.createdAt)}</span><RotateCcw className="h-4 w-4" /></button>)}</div></details> : null}
                </aside>
              </div>
            )}
          </section>
        </div>
      )}

      {aiOpen ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-6" role="dialog" aria-modal="true"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-md bg-white p-5 shadow-2xl sm:rounded-md sm:p-6"><div className="flex justify-between gap-4"><div><p className="flex items-center gap-2 text-sm font-semibold text-blue-700"><Bot className="h-4 w-4" /> Assistant de rédaction</p><h2 className="mt-1 text-xl font-bold">Préparer une proposition</h2><p className="mt-1 text-sm text-slate-500">L’IA propose. Vous relisez et décidez.</p></div><button type="button" onClick={() => setAiOpen(false)} title="Fermer"><X /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Select label="Action" value={aiAction} onChange={setAiAction}><option value="rediger">Rédiger</option><option value="ameliorer">Corriger et améliorer</option><option value="raccourcir">Raccourcir</option><option value="simplifier">Rendre plus simple</option><option value="titres">Proposer des titres</option></Select><Field label="Consigne complémentaire"><input value={aiInstructions} onChange={(event) => setAiInstructions(event.target.value)} className="field" placeholder="Ex. ton chaleureux" /></Field></div><button type="button" onClick={askAi} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Générer</button>{suggestion ? <div className="mt-5 border-t pt-5"><h3 className="font-bold">Proposition</h3><p className="mt-2 text-lg font-semibold">{suggestion.title}</p><p className="mt-2 text-sm text-slate-600">{suggestion.summary}</p>{suggestion.suggestedTitles.length ? <div className="mt-3 flex flex-wrap gap-2">{suggestion.suggestedTitles.map((title) => <button key={title} type="button" onClick={() => setSuggestion((value) => value ? { ...value, title } : value)} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-800">{title}</button>)}</div> : null}{suggestion.reviewNotes.length ? <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-semibold">À vérifier avant publication</p><ul className="mt-1 list-disc pl-5 text-sm">{suggestion.reviewNotes.map((note) => <li key={note}>{note}</li>)}</ul></div> : null}<button type="button" onClick={applySuggestion} className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white"><Check className="h-4 w-4" /> Utiliser dans le brouillon</button></div> : null}</div></div> : null}
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`block ${wide ? "sm:col-span-2" : ""}`}><span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>{children}</label>;
}
function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <Field label={label}><select value={value} onChange={(event) => onChange(event.target.value)} className="field bg-white">{children}</select></Field>;
}
function Tool({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactElement<{ className?: string }> }) {
  return <button type="button" title={title} aria-label={title} onClick={onClick} className="rounded p-2 text-slate-600 hover:bg-white">{children}</button>;
}
function ModeButton({ active, title, onClick, children }: { active: boolean; title: string; onClick: () => void; children: React.ReactElement<{ className?: string }> }) {
  return <button type="button" title={title} aria-label={title} aria-pressed={active} onClick={onClick} className={`rounded p-2 ${active ? "bg-slate-900 text-white" : "text-slate-500"}`}>{children}</button>;
}
function Action({ onClick, tone = "plain", children }: { onClick: () => void; tone?: "plain" | "amber" | "green" | "dark"; children: React.ReactNode }) {
  const style = tone === "green" ? "bg-emerald-700 text-white" : tone === "amber" ? "border-amber-300 bg-amber-50 text-amber-900" : tone === "dark" ? "bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700";
  return <button type="button" onClick={onClick} className={`flex w-full items-center justify-center gap-2 rounded-md border border-transparent px-3 py-2.5 text-sm font-semibold ${style}`}>{children}</button>;
}

function Templates({ templates, canPublish, current, setCurrent, onSaved, setError, setNotice }: {
  templates: Template[]; canPublish: boolean; current: Template | null;
  setCurrent: React.Dispatch<React.SetStateAction<Template | null>>; onSaved: () => Promise<void>;
  setError: (value: string) => void; setNotice: (value: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  function change(update: Partial<Template>) { setCurrent((value) => value ? { ...value, ...update } : value); }
  async function saveTemplate() {
    if (!current || !canPublish) return;
    setSaving(true); setError("");
    try {
      const result = await apiFetch<{ template: Template }>("content/admin/templates", { method: current.id ? "PATCH" : "POST", body: JSON.stringify(current) });
      setCurrent(result.template); setNotice("Modèle enregistré et disponible pour les prochains contenus."); await onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Enregistrement impossible"); }
    finally { setSaving(false); }
  }
  const fresh = () => setCurrent({ id: "", slug: "", name: "", contentType: "article", description: "", defaultTitle: "", defaultSummary: "", defaultBodyMarkdown: "", active: true, version: 0 });
  return <div className="grid min-h-[620px] overflow-hidden rounded-md border border-slate-200 bg-white lg:grid-cols-[300px_minmax(0,1fr)]"><aside className="border-b bg-slate-50 p-3 lg:border-b-0 lg:border-r"><button type="button" disabled={!canPublish} onClick={fresh} className="mb-3 flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Nouveau modèle</button>{templates.map((template) => <button key={template.id} type="button" onClick={() => setCurrent(template)} className={`mb-1 w-full rounded-md p-3 text-left ${current?.id === template.id ? "bg-emerald-50 ring-1 ring-emerald-300" : "hover:bg-white"}`}><strong className="text-sm">{template.name}</strong><p className="mt-1 text-xs text-slate-500">{TYPES[template.contentType]} · version {template.version}</p></button>)}</aside><section className="p-4 sm:p-6">{!current ? <div className="flex min-h-[420px] flex-col items-center justify-center text-center"><FileText className="h-10 w-10 text-slate-300" /><h2 className="mt-3 text-lg font-bold">Choisissez un modèle</h2><p className="mt-1 text-sm text-slate-500">Les modèles accélèrent les publications répétitives.</p></div> : <div className="mx-auto max-w-3xl space-y-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">{current.id ? "Modifier le modèle" : "Nouveau modèle"}</h2><p className="text-sm text-slate-500">La direction garde la main sur les modèles officiels.</p></div><button type="button" disabled={!canPublish || saving} onClick={saveTemplate} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer</button></div>{!canPublish ? <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">Seule la direction peut modifier les modèles.</p> : null}<div className="grid gap-4 sm:grid-cols-2"><Field label="Nom"><input disabled={!canPublish} value={current.name} onChange={(event) => change({ name: event.target.value, slug: current.slug || slug(event.target.value) })} className="field" /></Field><Select label="Type" value={current.contentType} onChange={(value) => change({ contentType: value as ContentType })}>{Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div><Field label="Description interne"><input disabled={!canPublish} value={current.description} onChange={(event) => change({ description: event.target.value })} className="field" /></Field><Field label="Titre proposé"><input disabled={!canPublish} value={current.defaultTitle} onChange={(event) => change({ defaultTitle: event.target.value })} className="field" /></Field><Field label="Résumé proposé"><textarea disabled={!canPublish} value={current.defaultSummary} onChange={(event) => change({ defaultSummary: event.target.value })} rows={3} className="field" /></Field><Field label="Structure du message"><textarea disabled={!canPublish} value={current.defaultBodyMarkdown} onChange={(event) => change({ defaultBodyMarkdown: event.target.value })} rows={13} className="field font-mono text-sm" /></Field><label className="flex items-center gap-3"><input disabled={!canPublish} type="checkbox" checked={current.active} onChange={(event) => change({ active: event.target.checked })} /><span className="text-sm font-medium">Modèle disponible lors de la création</span></label></div>}</section></div>;
}
