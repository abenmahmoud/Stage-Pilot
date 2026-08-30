import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Clock3,
  FilePenLine,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { COMMUNICATIONS_UI_ENABLED } from "../../lib/feature-flags";
import { useAuth } from "../../lib/auth-context";

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
};

type CommunicationsPayload = { communications: CommunicationRow[] };

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
  };
}

export default function CommunicationsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CommunicationRow[]>([]);
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(COMMUNICATIONS_UI_ENABLED);
  const [saving, setSaving] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!COMMUNICATIONS_UI_ENABLED) return;
    setLoading(true);
    setError("");
    try {
      const [communications, templatePayload] = await Promise.all([
        apiFetch<CommunicationsPayload>("communications/admin"),
        apiFetch<{ templates: CommunicationTemplate[] }>("communications/admin/templates"),
      ]);
      setRows(communications.communications);
      setTemplates(templatePayload.templates);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Communications indisponibles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId]
  );
  const canManageTemplates = user?.role === "superadmin" || user?.role === "proviseur";

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
    });
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
      const payload = await apiFetch<CreatePayload>("communications/admin", {
        method: "POST",
        body: JSON.stringify({ sourceType: "direct_text", ...draft }),
      });
      setNotice(
        payload.duplicate
          ? "Ce brouillon existait déjà. Aucun doublon n’a été créé."
          : "Le brouillon privé est enregistré."
      );
      setDraft(emptyDraft());
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
        <li className="flex min-h-16 items-center gap-3 bg-white px-4 py-3 text-slate-400">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-sm font-bold">2</span>
          <span><strong className="block text-sm">Vérifier</strong><small>Verrouillé</small></span>
        </li>
        <li className="flex min-h-16 items-center gap-3 bg-white px-4 py-3 text-slate-400">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-sm font-bold">3</span>
          <span><strong className="block text-sm">Publier et informer</strong><small>Verrouillé</small></span>
        </li>
      </ol>

      {error ? <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)]">
        <section aria-labelledby="communications-list-title" className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 id="communications-list-title" className="font-bold text-slate-950">Brouillons</h2>
              <p className="text-xs text-slate-500">{rows.length} élément{rows.length > 1 ? "s" : ""}</p>
            </div>
            <button type="button" onClick={() => { setDraft(emptyDraft()); setSelectedId(null); setNotice(""); }} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">
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
                onClick={() => setSelectedId(row.id)}
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
            <div className="mt-5 flex items-center gap-2 text-sm text-slate-500"><Clock3 className="h-4 w-4" /> Mis à jour {dateLabel(selected.updatedAt)}</div>
          </section>
        ) : (
          <form onSubmit={submit} className="min-w-0 space-y-5 border-t-4 border-emerald-700 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <FilePenLine className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div><h2 className="font-bold text-slate-950">Nouvelle communication</h2><p className="mt-1 text-sm text-slate-500">Enregistrée comme brouillon interne</p></div>
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

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex items-center gap-2 text-xs text-slate-500"><LockKeyhole className="h-4 w-4" /> Privé jusqu’à validation</span>
              <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </button>
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
        <div className="flex items-center gap-3 bg-white px-4 py-3 text-slate-500"><Check className="h-4 w-4" /><span className="text-sm"><strong className="block text-slate-700">Validation humaine</strong>Aucune validation disponible</span></div>
        <div className="flex items-center gap-3 bg-white px-4 py-3 text-slate-500"><Send className="h-4 w-4" /><span className="text-sm"><strong className="block text-slate-700">Publication et envoi</strong>Aucune action disponible</span></div>
      </section>
    </div>
  );
}
