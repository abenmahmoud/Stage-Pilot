import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BellRing,
  CalendarDays,
  Check,
  ChevronRight,
  Eye,
  FileText,
  LoaderCircle,
  Mail,
  MonitorSmartphone,
  PencilLine,
  ShieldCheck,
  Sparkles,
  Star,
  UploadCloud,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { extractPdfTextLocally } from "../../lib/pdf-text";
import { PublicContentMarkdown } from "../../components/PublicContentMarkdown";
import {
  parseWeeklyBriefAssistPayload,
  parseWeeklyBriefSuggestion,
  sanitizeWeeklySourceText,
  weeklyAudienceGroupRef,
  WEEKLY_BRIEF_CATEGORIES,
  type WeeklyBriefCard,
  type WeeklyBriefAudience,
  type WeeklyBriefChannel,
  type WeeklyBriefImportance,
  type WeeklyBriefSuggestion,
} from "../../../shared/weekly-brief";
import { parseSiteContentAdminMutationPayload } from "../../../shared/site-content-admin-payload";
import { isValidFlashInfoVersionPayload } from "../../../shared/flash-payload-policy";
import { normalizeSiteSlug } from "../../../shared/site-content";

type CardState = WeeklyBriefCard & {
  selected: boolean;
  draftId: string | null;
  flashId: string | null;
  error: string;
};

const AUDIENCES: Array<{ value: WeeklyBriefAudience; label: string }> = [
  { value: "tous", label: "Tout le lycée" },
  { value: "eleves", label: "Élèves" },
  { value: "parents", label: "Parents" },
];

const IMPORTANCE: Array<{ value: WeeklyBriefImportance; label: string; help: string }> = [
  { value: "normale", label: "Normale", help: "Site uniquement" },
  { value: "importante", label: "Importante", help: "Push, email possible" },
  { value: "urgente", label: "Urgente", help: "Push et email" },
];

const CHANNEL_LABELS: Record<WeeklyBriefChannel, string> = {
  push: "Push",
  email: "Email",
  sms: "SMS ciblé",
};

function localDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function readableDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "long" }).format(date);
}

function channelsForImportance(
  importance: WeeklyBriefImportance,
  previous: WeeklyBriefChannel[] = []
): WeeklyBriefChannel[] {
  if (importance === "normale") return [];
  if (importance === "importante") return previous.includes("email") ? ["push", "email"] : ["push"];
  return previous.includes("sms") ? ["push", "email", "sms"] : ["push", "email"];
}

function submissionPayload(value: unknown): { flashInfoId: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!isValidFlashInfoVersionPayload(record.version) || typeof record.duplicate !== "boolean") return null;
  return { flashInfoId: record.version.flashInfoId };
}

function cardTone(card: CardState): string {
  if (card.importance === "urgente") return "from-rose-600 to-orange-500";
  if (card.importance === "importante") return "from-indigo-700 to-sky-500";
  return card.featured ? "from-emerald-700 to-teal-500" : "from-slate-700 to-slate-500";
}

export default function WeeklyBriefPage() {
  const [file, setFile] = useState<File | null>(null);
  const [suggestion, setSuggestion] = useState<WeeklyBriefSuggestion | null>(null);
  const [cards, setCards] = useState<CardState[]>([]);
  const [sanitization, setSanitization] = useState<{
    sourceLineCount: number;
    retainedLineCount: number;
    excludedLineCount: number;
    maskedValueCount: number;
  } | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [busy, setBusy] = useState<"prepare" | "save" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idempotencyKeys = useRef(new Map<string, string>());

  const selectedCount = cards.filter((card) => card.selected).length;
  const featuredCount = cards.filter((card) => card.selected && card.featured).length;
  const savedCount = cards.filter((card) => card.draftId).length;
  const pendingQuestionCount = cards.reduce((total, card) => total + card.openQuestions.length, 0);
  const canSave = selectedCount > 0 && featuredCount <= 3 && busy === null;

  const completion = useMemo(() => {
    if (!suggestion) return 1;
    if (savedCount === selectedCount && selectedCount > 0) return 3;
    return 2;
  }, [savedCount, selectedCount, suggestion]);

  function updateCard(index: number, update: Partial<CardState>) {
    setCards((previous) => previous.map((card, cardIndex) => cardIndex === index ? { ...card, ...update } : card));
    setNotice("");
  }

  function changeImportance(index: number, importance: WeeklyBriefImportance) {
    setCards((previous) => previous.map((card, cardIndex) => cardIndex === index
      ? { ...card, importance, channels: channelsForImportance(importance, card.channels), error: "" }
      : card));
  }

  function toggleChannel(index: number, channel: WeeklyBriefChannel) {
    setCards((previous) => previous.map((card, cardIndex) => {
      if (cardIndex !== index) return card;
      const required = card.importance === "urgente" ? ["push", "email"] : card.importance === "importante" ? ["push"] : [];
      if (required.includes(channel) || card.importance === "normale") return card;
      if (channel === "sms" && card.importance !== "urgente") return card;
      const channels = card.channels.includes(channel)
        ? card.channels.filter((value) => value !== channel)
        : [...card.channels, channel];
      return { ...card, channels, error: "" };
    }));
  }

  function toggleFeatured(index: number) {
    const card = cards[index];
    if (!card.featured && featuredCount >= 3) {
      setError("Trois actualités au maximum peuvent être mises à la une.");
      return;
    }
    setError("");
    updateCard(index, { featured: !card.featured });
  }

  async function prepareWeeklyBrief() {
    if (!file) {
      setError("Choisissez d’abord l’hebdo au format PDF.");
      return;
    }
    setBusy("prepare");
    setError("");
    setNotice("");
    try {
      const extracted = await extractPdfTextLocally(file);
      setPageCount(extracted.pageCount);
      // Le premier filtrage a lieu dans le navigateur. Le serveur répète le
      // même contrôle avant que le texte puisse être transmis au modèle.
      const clientSanitized = sanitizeWeeklySourceText(extracted.text);
      const response = await apiFetch<unknown>("content/admin/weekly-assist", {
        method: "POST",
        body: JSON.stringify({ sourceName: file.name, extractedText: clientSanitized.text }),
      });
      const parsed = parseWeeklyBriefAssistPayload(response);
      if (!parsed) throw new Error("La proposition IA reçue n’est pas conforme.");
      setSuggestion(parsed.suggestion);
      setCards(parsed.suggestion.cards.map((card) => ({
        ...card,
        selected: true,
        draftId: null,
        flashId: null,
        error: "",
      })));
      setSanitization({
        sourceLineCount: clientSanitized.sourceLineCount,
        retainedLineCount: parsed.sanitization.retainedLineCount,
        excludedLineCount: clientSanitized.excludedLineCount + parsed.sanitization.excludedLineCount,
        maskedValueCount: clientSanitized.maskedValueCount + parsed.sanitization.maskedValueCount,
      });
      setMode("edit");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La préparation de l’hebdo a échoué.");
    } finally {
      setBusy(null);
    }
  }

  function validateCards(): WeeklyBriefSuggestion {
    if (!suggestion) throw new Error("Aucune proposition à enregistrer.");
    const selected = cards.filter((card) => card.selected);
    if (selected.length === 0) throw new Error("Choisissez au moins une actualité.");
    if (selected.filter((card) => card.featured).length > 3) throw new Error("Trois actualités au maximum peuvent être à la une.");
    if (selected.some((card) => card.openQuestions.length > 0)) {
      throw new Error("Répondez aux points à vérifier ou retirez les actualités concernées avant l’enregistrement.");
    }
    return parseWeeklyBriefSuggestion({
      ...suggestion,
      cards: selected.map(({ selected: _selected, draftId: _draftId, flashId: _flashId, error: _error, ...card }) => card),
    });
  }

  async function createDraft(card: CardState, weekStart: string): Promise<string> {
    const response = await apiFetch<unknown>("content/admin", {
      method: "POST",
      body: JSON.stringify({
        contentType: "article",
        slug: normalizeSiteSlug(`hebdo-${weekStart}-${card.key}`),
        title: card.title,
        summary: card.summary,
        bodyMarkdown: card.bodyMarkdown,
        category: card.category,
        // L'Hebdo alimente l'actualité publique. Le champ `card.audience`
        // cible uniquement la proposition de notification créée plus bas.
        audience: "tous",
        templateId: null,
        featured: card.featured,
        metaTitle: card.title,
        metaDescription: card.summary.slice(0, 320),
        publishAt: null,
        expiresAt: card.expiresAt,
        assets: [],
      }),
    });
    const parsed = parseSiteContentAdminMutationPayload(response, { action: "create" });
    if (!parsed) throw new Error("La création du brouillon n’a pas été confirmée.");
    return parsed.itemId;
  }

  async function createFlashProposal(card: CardState): Promise<string | null> {
    if (card.channels.length === 0) return null;
    let idempotencyKey = idempotencyKeys.current.get(card.key);
    if (!idempotencyKey) {
      idempotencyKey = crypto.randomUUID();
      idempotencyKeys.current.set(card.key, idempotencyKey);
    }
    const response = await apiFetch<unknown>("flash/proposals", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        title: card.title,
        bodyMarkdown: card.bodyMarkdown,
        importance: card.importance,
        channels: card.channels,
        groupRefs: [weeklyAudienceGroupRef(card.audience)],
        expiresAt: card.expiresAt,
      }),
    });
    const parsed = submissionPayload(response);
    if (!parsed) throw new Error("La proposition de notification n’a pas été confirmée.");
    return parsed.flashInfoId;
  }

  async function saveSelected() {
    setError("");
    setNotice("");
    let validated: WeeklyBriefSuggestion;
    try {
      validated = validateCards();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Les actualités doivent être revues.");
      return;
    }

    setBusy("save");
    let failures = 0;
    const workingCards = cards.map((card) => ({ ...card }));
    for (const validatedCard of validated.cards) {
      const index = workingCards.findIndex((card) => card.key === validatedCard.key);
      if (index < 0) continue;
      const current = workingCards[index];
      let draftId = current.draftId;
      let flashId = current.flashId;
      try {
        if (!draftId) draftId = await createDraft(current, validated.weekStart);
        if (current.channels.length > 0 && !flashId) flashId = await createFlashProposal(current);
        setCards((previous) => previous.map((card, cardIndex) => cardIndex === index
          ? { ...card, draftId, flashId, error: "" }
          : card));
        workingCards[index] = { ...current, draftId, flashId, error: "" };
      } catch (caught) {
        failures += 1;
        const message = caught instanceof Error ? caught.message : "Enregistrement impossible.";
        setCards((previous) => previous.map((card, cardIndex) => cardIndex === index
          ? { ...card, draftId, flashId, error: message }
          : card));
        workingCards[index] = { ...current, draftId, flashId, error: message };
      }
    }
    setBusy(null);
    setNotice(failures === 0
      ? "Les brouillons sont enregistrés. Les notifications restent en attente de validation humaine."
      : `${failures} actualité(s) restent à reprendre. Les créations déjà confirmées sont conservées.`);
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-3 pb-12 sm:px-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-emerald-900 p-6 text-white shadow-xl sm:p-9">
        <div className="grid gap-7 lg:grid-cols-[1.3fr_.7fr] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Assistant éditorial du lycée
            </div>
            <h1 className="max-w-3xl font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Un hebdo devient une actualité claire en quelques minutes
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
              Déposez le PDF, relisez les cartes préparées par l’IA, puis créez les brouillons du site et les notifications à valider.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {["Déposer", "Relire", "Valider"].map((label, index) => (
              <div key={label} className={`rounded-2xl px-2 py-3 ring-1 ${completion > index ? "bg-white text-slate-950 ring-white" : "bg-white/5 text-white/60 ring-white/15"}`}>
                <span className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white">{completion > index + 1 ? <Check className="h-4 w-4" /> : index + 1}</span>
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {error && <div role="alert" className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><Check className="h-5 w-5 shrink-0" />{notice}</div>}

      <section className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700"><UploadCloud className="h-5 w-5" /></span>
            <div><h2 className="font-heading text-lg font-bold text-slate-900">1. Déposer l’hebdo</h2><p className="text-xs text-slate-500">PDF · 10 Mo maximum · 40 pages</p></div>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-5 w-full rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 px-5 py-8 text-center transition hover:border-indigo-400 hover:bg-indigo-50"
          >
            <FileText className="mx-auto h-8 w-8 text-indigo-600" />
            <span className="mt-3 block font-semibold text-slate-900">{file?.name ?? "Choisir le PDF de la semaine"}</span>
            <span className="mt-1 block text-xs text-slate-500">Le PDF brut ne quitte pas votre navigateur.</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setSuggestion(null); setCards([]); setError(""); setNotice(""); setSanitization(null);
            }}
          />
          <button
            type="button"
            disabled={!file || busy !== null}
            onClick={() => void prepareWeeklyBrief()}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "prepare" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy === "prepare" ? "L’IA prépare les actualités…" : "Préparer avec l’IA"}
          </button>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="font-heading text-lg font-bold text-slate-900">Contrôle avant diffusion</h2><p className="mt-1 text-sm text-slate-500">Le filtrage protège les informations internes et signale les points à confirmer.</p></div>
            <ShieldCheck className="h-7 w-7 shrink-0 text-emerald-600" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [pageCount || "—", "pages lues"],
              [sanitization?.retainedLineCount ?? "—", "lignes utiles"],
              [sanitization?.excludedLineCount ?? "—", "lignes écartées"],
              [pendingQuestionCount || "—", "points à vérifier"],
            ].map(([value, label]) => <div key={label} className="rounded-2xl bg-slate-50 p-3"><div className="text-xl font-bold text-slate-900">{value}</div><div className="text-xs text-slate-500">{label}</div></div>)}
          </div>
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <strong>Règle de publication :</strong> l’IA propose. Un membre autorisé vérifie les dates, le public et le texte. Aucun envoi ni aucune publication n’a lieu depuis cet écran.
          </div>
        </div>
      </section>

      {suggestion && (
        <section className="space-y-5">
          <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{suggestion.issueTitle}</p>
              <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">2. Relire et personnaliser</h2>
              <p className="mt-1 text-sm text-slate-500">{suggestion.issueSummary}</p>
            </div>
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button type="button" onClick={() => setMode("edit")} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${mode === "edit" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}><PencilLine className="h-4 w-4" />Modifier</button>
              <button type="button" onClick={() => setMode("preview")} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${mode === "preview" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}><Eye className="h-4 w-4" />Aperçu</button>
            </div>
          </div>

          {suggestion.reviewNotes.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-amber-950"><AlertCircle className="h-4 w-4" />À contrôler dans la source</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">{suggestion.reviewNotes.map((note) => <li key={note}>{note}</li>)}</ul>
            </div>
          )}

          {mode === "preview" ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {cards.filter((card) => card.selected).map((card) => (
                <article key={card.key} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className={`bg-gradient-to-br ${cardTone(card)} p-5 text-white`}>
                    <div className="flex items-start justify-between gap-3"><span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">{card.category}</span>{card.featured && <Star className="h-5 w-5 fill-amber-300 text-amber-300" />}</div>
                    <h3 className="mt-8 font-heading text-xl font-bold leading-tight">{card.title}</h3>
                    <p className="mt-2 text-sm leading-5 text-white/80">{card.summary}</p>
                  </div>
                  <div className="p-5">
                    <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500"><CalendarDays className="h-4 w-4" />{readableDate(card.eventDate)} · concerne {AUDIENCES.find((value) => value.value === card.audience)?.label}</div>
                    <div className="content-markdown text-sm text-slate-700"><PublicContentMarkdown>{card.bodyMarkdown}</PublicContentMarkdown></div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {cards.map((card, index) => (
                <article key={card.key} className={`rounded-3xl border bg-white p-5 shadow-sm transition sm:p-6 ${card.selected ? "border-indigo-200" : "border-slate-200 opacity-65"}`}>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
                    <label className="flex min-w-48 cursor-pointer items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                      <input type="checkbox" checked={card.selected} onChange={(event) => updateCard(index, { selected: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                      Retenir cette actualité
                    </label>
                    <div className="grid flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <label className="text-xs font-semibold text-slate-600">Public à notifier
                        <select value={card.audience} onChange={(event) => updateCard(index, { audience: event.target.value as WeeklyBriefAudience })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900">
                          {AUDIENCES.map((audience) => <option key={audience.value} value={audience.value}>{audience.label}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-600">Importance
                        <select value={card.importance} onChange={(event) => changeImportance(index, event.target.value as WeeklyBriefImportance)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900">
                          {IMPORTANCE.map((importance) => <option key={importance.value} value={importance.value}>{importance.label} · {importance.help}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-600">Date de l’événement
                        <input type="date" value={card.eventDate} onChange={(event) => updateCard(index, { eventDate: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900" />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">Expiration
                        <input type="datetime-local" value={localDateTime(card.expiresAt)} onChange={(event) => {
                          const date = new Date(event.target.value);
                          if (!Number.isNaN(date.getTime())) updateCard(index, { expiresAt: date.toISOString() });
                        }} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900" />
                      </label>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
                    <div className="space-y-4">
                      <label className="block text-xs font-semibold text-slate-600">Titre
                        <input value={card.title} maxLength={180} onChange={(event) => updateCard(index, { title: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base font-bold text-slate-950" />
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">Résumé
                        <textarea value={card.summary} maxLength={600} rows={3} onChange={(event) => updateCard(index, { summary: event.target.value })} className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800" />
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">Texte publié
                        <textarea value={card.bodyMarkdown} maxLength={8000} rows={6} onChange={(event) => updateCard(index, { bodyMarkdown: event.target.value })} className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-6 text-slate-800" />
                      </label>
                    </div>
                    <div className="space-y-4">
                      <label className="block text-xs font-semibold text-slate-600">Catégorie
                        <select value={card.category} onChange={(event) => updateCard(index, { category: event.target.value as WeeklyBriefCard["category"] })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900">
                          {WEEKLY_BRIEF_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                        </select>
                      </label>
                      <div>
                        <p className="text-xs font-semibold text-slate-600">Notification proposée</p>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {(["push", "email", "sms"] as WeeklyBriefChannel[]).map((channel) => {
                            const required = (card.importance === "importante" && channel === "push") || (card.importance === "urgente" && (channel === "push" || channel === "email"));
                            const disabled = card.importance === "normale" || (channel === "sms" && card.importance !== "urgente") || required;
                            return <button key={channel} type="button" disabled={disabled} onClick={() => toggleChannel(index, channel)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${card.channels.includes(channel) ? "bg-indigo-700 text-white ring-indigo-700" : "bg-white text-slate-500 ring-slate-200"} disabled:cursor-not-allowed`}>{CHANNEL_LABELS[channel]}{required ? " · requis" : ""}</button>;
                          })}
                        </div>
                      </div>
                      <button type="button" onClick={() => toggleFeatured(index)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${card.featured ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-white text-slate-600 ring-slate-200"}`}><Star className={`h-4 w-4 ${card.featured ? "fill-amber-400 text-amber-400" : ""}`} />{card.featured ? "À la une" : "Mettre à la une"}</button>
                      <div className="rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600"><strong className="text-slate-800">Extrait source</strong><br />« {card.sourceExcerpt} »</div>
                      {card.openQuestions.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>À vérifier avant création</strong><ul className="mt-2 list-disc space-y-1 pl-5">{card.openQuestions.map((question) => <li key={question}>{question}</li>)}</ul><button type="button" onClick={() => updateCard(index, { openQuestions: [] })} className="mt-3 rounded-lg bg-white px-3 py-1.5 text-xs font-bold ring-1 ring-amber-300">J’ai vérifié et corrigé</button></div>}
                      {card.draftId && <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Check className="h-4 w-4" />Brouillon créé{card.channels.length > 0 ? card.flashId ? " · notification proposée" : "" : ""}</div>}
                      {card.error && <p role="alert" className="text-sm font-semibold text-rose-700">{card.error}</p>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg sm:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div><p className="font-bold text-slate-950">{selectedCount} actualité(s) retenue(s) · {featuredCount}/3 à la une</p><p className="text-xs text-slate-500">Création en brouillon. La publication et les envois demandent encore une validation humaine.</p></div>
              <button type="button" disabled={!canSave} onClick={() => void saveSelected()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
                {busy === "save" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                {busy === "save" ? "Création en cours…" : "Créer les brouillons et notifications"}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <Link to="/admin/contenus" className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-300"><span className="flex items-center gap-3"><MonitorSmartphone className="h-5 w-5 text-indigo-600" /><span><strong className="block text-sm text-slate-900">Contenus du site</strong><span className="text-xs text-slate-500">Relire et publier les brouillons</span></span></span><ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-indigo-600" /></Link>
        <Link to="/admin/informations-flash/valider" className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-emerald-300"><span className="flex items-center gap-3"><Mail className="h-5 w-5 text-emerald-600" /><span><strong className="block text-sm text-slate-900">Notifications à valider</strong><span className="text-xs text-slate-500">Contrôler le public et les canaux</span></span></span><ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-emerald-600" /></Link>
      </section>
    </main>
  );
}
