import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, CircleHelp, ClipboardList, Search, ShieldCheck, X } from "lucide-react";
import { MANUAL_ARTICLES, MANUAL_GROUPS, MANUAL_REVIEW_DATE, MANUAL_SHORTCUTS, searchManual, type ManualArticle } from "../../data/superadmin-manual";

const focusStyle = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600";

function ToolLink({ label, to }: ManualArticle["links"][number]) {
  const style = `inline-flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:border-emerald-500 hover:text-emerald-800 ${focusStyle}`;
  const content = <><span>{label}</span><ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" /></>;
  return to.startsWith("https://")
    ? <a href={to} target="_blank" rel="noreferrer" className={style} aria-label={`${label} (nouvel onglet)`}>{content}</a>
    : <Link to={to} className={style}>{content}</Link>;
}

function ArticleGuide({ article }: { article: ManualArticle }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "start" });
  }, [article.id]);
  return <article aria-labelledby="manual-article-title" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <header className="border-b border-slate-100 p-5 sm:p-8">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-700">{MANUAL_GROUPS.find(group => group.id === article.group)?.label}</p>
      <h2 ref={heading} tabIndex={-1} id="manual-article-title" className="scroll-mt-6 font-heading text-2xl font-bold leading-tight text-slate-950 outline-none sm:text-3xl">{article.title}</h2>
      <p className="mt-3 leading-relaxed text-slate-600">{article.summary}</p>
      {article.availability && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950"><strong className="block">{article.availability.label}</strong><p className="mt-1">{article.availability.detail}</p></div>}
    </header>
    <div className="grid gap-8 p-5 sm:p-8 xl:grid-cols-[minmax(0,1fr)_240px]">
      <div className="min-w-0 space-y-8">
        <section aria-labelledby="manual-steps-title">
          <h3 id="manual-steps-title" className="mb-5 flex items-center gap-2 font-semibold text-slate-950"><ClipboardList className="h-5 w-5 text-emerald-700" aria-hidden="true" />La démarche, pas à pas</h3>
          <ol className="space-y-5">{article.steps.map((step, index) => <li key={step} className="flex gap-3 sm:gap-4"><span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-800">{index + 1}</span><p className="pt-0.5 text-sm leading-7 text-slate-700">{step}</p></li>)}</ol>
        </section>
        <section className="rounded-xl bg-emerald-50 p-4 sm:p-5"><h3 className="flex items-center gap-2 font-semibold text-emerald-950"><Check className="h-4 w-4 shrink-0" aria-hidden="true" />Le résultat attendu</h3><p className="mt-2 text-sm leading-7 text-emerald-950">{article.result}</p></section>
        <section><h3 className="flex items-center gap-2 font-semibold text-slate-950"><CircleHelp className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />À vérifier si ça bloque</h3><p className="mt-2 text-sm leading-7 text-slate-600">{article.check}</p></section>
      </div>
      <aside className="min-w-0 space-y-6 border-t border-slate-100 pt-6 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0" aria-label="Préparer et ouvrir l’outil">
        <div><h3 className="text-sm font-semibold text-slate-950">Qui peut agir ?</h3><p className="mt-2 text-sm leading-6 text-slate-600">{article.access}</p></div>
        <div><h3 className="text-sm font-semibold text-slate-950">Avant de commencer</h3><p className="mt-2 text-sm leading-6 text-slate-600">{article.prerequisite}</p></div>
        <div><h3 className="mb-3 text-sm font-semibold text-slate-950">Accéder aux outils</h3><div className="flex flex-col gap-2">{article.links.map(link => <ToolLink key={link.to} {...link} />)}</div></div>
      </aside>
    </div>
  </article>;
}

export default function SuperadminManualPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const group = MANUAL_GROUPS.some(item => item.id === params.get("theme")) ? params.get("theme")! : "";
  const articleId = params.get("fiche");
  const article = MANUAL_ARTICLES.find(item => item.id === articleId);
  const filtered = searchManual(query, group);
  const searchInput = useRef<HTMLInputElement>(null);
  const catalogueHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const previous = document.title;
    document.title = `${article?.title ?? "Manuel d’utilisation"} — Gestion du lycée`;
    return () => { document.title = previous; };
  }, [article?.title]);

  function filter(nextQuery: string, nextGroup: string) {
    const next = new URLSearchParams();
    if (nextQuery) next.set("q", nextQuery);
    if (nextGroup) next.set("theme", nextGroup);
    setParams(next, { replace: true, preventScrollReset: true });
  }
  function openArticle(id: string) {
    const next = new URLSearchParams(params);
    next.set("fiche", id);
    setParams(next, { preventScrollReset: true });
  }
  function backToCatalogue() {
    const next = new URLSearchParams(params);
    next.delete("fiche");
    setParams(next, { preventScrollReset: true });
    // The catalogue is rendered after navigation; the callback ref handles focus.
    returnFocus.current = true;
  }
  const returnFocus = useRef(false);

  return <div className="mx-auto max-w-6xl space-y-6 pb-8">
    <header className="space-y-3 border-b border-slate-200 pb-6">
      <Link to="/gestion" className={`inline-flex min-h-11 items-center gap-2 text-sm text-slate-600 hover:text-emerald-800 ${focusStyle}`}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Gestion du lycée</Link>
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><BookOpen className="h-4 w-4" aria-hidden="true" />Superadministration</p>
      <div className="flex flex-wrap items-start justify-between gap-3"><h1 className="font-heading text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Le manuel du lycée</h1><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />Accès superadmin</span></div>
      <p className="max-w-2xl leading-relaxed text-slate-600">Chaque outil, son rôle et les étapes pour bien l’utiliser. Retrouvez une démarche, puis ouvrez directement le bon espace.</p>
      <p className="text-xs leading-5 text-slate-500">{MANUAL_ARTICLES.length} fiches · Révisé le {MANUAL_REVIEW_DATE}. Les disponibilités actuelles se vérifient dans chaque outil.</p>
    </header>

    {!articleId && !query && !group && <section aria-label="Démarches fréquentes" className="grid gap-3 md:grid-cols-3">{MANUAL_SHORTCUTS.map((shortcut, index) => <button key={shortcut.id} type="button" onClick={() => openArticle(shortcut.id)} className={`group flex min-h-28 flex-col items-start justify-between gap-4 rounded-2xl border p-5 text-left transition-colors ${index === 1 ? "border-slate-800 bg-slate-800 text-white hover:bg-slate-900" : "border-slate-200 bg-white text-slate-950 hover:border-emerald-500"} ${focusStyle}`}><strong className="text-sm leading-6">{shortcut.label}</strong><span className={`flex w-full items-center justify-between gap-3 text-xs ${index === 1 ? "text-slate-200" : "text-slate-500"}`}>{shortcut.hint}<ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" /></span></button>)}</section>}

    <section aria-label="Rechercher dans le manuel" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px]">
      <div className="relative"><label htmlFor="manual-search" className="sr-only">Rechercher une démarche</label><Search className="pointer-events-none absolute left-4 top-4 h-5 w-5 text-slate-400" aria-hidden="true" /><input ref={searchInput} id="manual-search" type="search" maxLength={180} autoComplete="off" value={query} onChange={event => filter(event.target.value, group)} placeholder="Rechercher : SMS, hebdo, emploi du temps…" className="min-h-13 w-full min-w-0 rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-12 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />{query && <button type="button" aria-label="Effacer la recherche" onClick={() => { filter("", group); searchInput.current?.focus(); }} className={`absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 ${focusStyle}`}><X className="h-4 w-4" aria-hidden="true" /></button>}</div>
      <div><label htmlFor="manual-theme" className="sr-only">Thème du manuel</label><select id="manual-theme" value={group} onChange={event => filter(query, event.target.value)} className="min-h-13 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"><option value="">Tous les thèmes</option>{MANUAL_GROUPS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
    </section>

    {articleId ? <div className="space-y-4">
      <button type="button" onClick={backToCatalogue} className={`inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-800 ${focusStyle}`}><ArrowLeft className="h-4 w-4" aria-hidden="true" />{query || group ? "Revenir aux résultats" : "Toutes les fiches"}</button>
      {article ? <ArticleGuide article={article} /> : <div role="status" className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-semibold text-slate-950">Cette fiche n’existe pas</h2><p className="mt-2 text-sm text-slate-600">Revenez au sommaire ou recherchez une démarche avec un autre mot.</p></div>}
    </div> : <section aria-labelledby="manual-catalogue-title" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="manual-catalogue-title" tabIndex={-1} ref={element => { catalogueHeading.current = element; if (element && returnFocus.current) { returnFocus.current = false; element.focus({ preventScroll: true }); element.scrollIntoView({ block: "start" }); } }} className="scroll-mt-6 text-lg font-semibold text-slate-950 outline-none">{query || group ? "Les fiches qui vous aident" : "Tous les outils, expliqués"}</h2><p aria-live="polite" aria-atomic="true" className="text-sm text-slate-500">{filtered.length} fiche{filtered.length > 1 ? "s" : ""}</p></div>
      {!filtered.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center"><Search className="mx-auto mb-3 h-6 w-6 text-slate-400" aria-hidden="true" /><h3 className="font-semibold text-slate-900">Aucune fiche pour cette recherche</h3><p className="mt-2 text-sm text-slate-600">Essayez un mot plus court ou choisissez tous les thèmes.</p><button type="button" onClick={() => { filter("", ""); searchInput.current?.focus(); }} className={`mt-4 min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-emerald-800 ${focusStyle}`}>Réinitialiser les filtres</button></div> : MANUAL_GROUPS.map(section => {
        const items = filtered.filter(item => item.group === section.id);
        return items.length ? <section key={section.id} aria-labelledby={`manual-group-${section.id}`} className="space-y-3"><h3 id={`manual-group-${section.id}`} className="text-sm font-semibold text-slate-500">{section.label}</h3><div className="grid gap-3 md:grid-cols-2">{items.map(item => <button key={item.id} type="button" onClick={() => openArticle(item.id)} className={`group flex min-h-28 items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left hover:border-emerald-500 ${focusStyle}`}><span className="min-w-0 flex-1"><strong className="block text-sm leading-6 text-slate-950 group-hover:text-emerald-800">{item.title}</strong><span className="mt-1 block text-sm leading-6 text-slate-500">{item.summary}</span>{item.availability && <span className="mt-3 inline-block rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">{item.availability.label}</span>}</span><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /></button>)}</div></section> : null;
      })}
    </section>}
    <footer className="border-t border-slate-200 pt-5 text-xs leading-6 text-slate-500">Guide de référence du portail Blaise Cendrars. Les fiches décrivent les parcours vérifiés et leurs prérequis ; elles ne remplacent pas l’état des traitements ni les décisions de validation. Ce manuel évolue avec les outils du lycée.</footer>
  </div>;
}
