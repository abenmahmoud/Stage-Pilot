import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, ExternalLink, FileText, LoaderCircle } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { calendarDateLabel } from "../../../shared/school-calendar";
import "../../styles/school-calendar.css";
import { PublicContentMarkdown } from "../../components/PublicContentMarkdown";
import { NewsPhoto } from "../../components/NewsPhoto";
import { PublicPortalShell } from "../../components/PublicPortalShell";
import { publicPageAlternative } from "../../../shared/public-portal-navigation";
import {
  readPublicContentPagePayload,
  type PublicContent,
} from "./public-content-client";
import "./lycee-connect.css";

export default function PublicContentPage() {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const scope = params.get("archive") === "expired" ? "expired" : "current";
  const [item, setItem] = useState<PublicContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const alternative = publicPageAlternative(slug);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setItem(null);
    fetch(`/api/content/public?slug=${encodeURIComponent(slug)}${scope === "expired" ? "&archive=expired" : ""}`, { signal: controller.signal })
      .then(async (response) => {
        const nextItem = await readPublicContentPagePayload(response, slug, scope);
        if (!controller.signal.aborted) setItem(nextItem);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setError("La page ne peut pas être chargée pour le moment. Vous pouvez réessayer ou consulter une autre rubrique.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug, scope, attempt]);

  useEffect(() => {
    document.title = item?.slug === slug
      ? `${item.title} · Lycée Blaise Cendrars`
      : "Informations du lycée · Blaise Cendrars";
    window.scrollTo({ top: 0 });
  }, [slug, item]);

  const documents = item?.assets.filter((asset) => asset.assetKind === "document" && asset.signedUrl) ?? [];

  return (
    <PublicPortalShell view="school" className="lycee-content-page">
      <div className="lycee-article-main" id="lycee-article-main">
        <Link to="/?view=school" className="lycee-breadcrumb"><ArrowLeft aria-hidden="true" /> Vie du lycée</Link>
        {loading ? <div className="lycee-article-state"><LoaderCircle className="is-spinning" aria-hidden="true" /><p>Chargement de la page…</p></div> : null}
        {!loading && (error || !item) ? <section className="lycee-article-state"><h1>{error ? "Chargement interrompu" : "Cette page n’est pas encore disponible"}</h1><p>{error || "Retrouvez les informations du lycée à l’accueil ou posez votre question à l’assistant."}</p><div className="lycee-empty-actions">{error ? <button type="button" onClick={() => setAttempt((value) => value + 1)}>Réessayer</button> : null}<Link to={alternative.href}>{alternative.label}</Link><Link to="/?view=help">Demander de l’aide</Link></div><Link to="/">Revenir à l’accueil</Link></section> : null}
        {!loading && !error && item?.slug === slug ? <article className="lycee-article-content">
          {item.contentType === "article" || item.contentType === "alerte" ? <NewsPhoto content={item} className="lycee-article-photo" /> : null}
          <p className="lycee-eyebrow">{scope === "expired" ? "Archive · " : ""}{item.category}</p>
          <h1>{item.title}</h1>
          {item.summary ? <p className="lycee-article-lead">{item.summary}</p> : null}
          {item.calendarEvents?.length ? <div className="school-calendar-article-links">{item.calendarEvents.map(event => <Link key={event.key} to={`/?view=calendar&date=${event.startDate}`}><CalendarDays aria-hidden="true" /> {calendarDateLabel(event)}</Link>)}</div> : null}
          <div className="lycee-public-markdown"><PublicContentMarkdown>{item.bodyMarkdown}</PublicContentMarkdown></div>
          {documents.length ? <section className="lycee-article-documents" aria-labelledby="documents-title"><h2 id="documents-title">Documents</h2><div>{documents.map((asset) => <a key={asset.id} href={asset.signedUrl ?? "#"} target="_blank" rel="noreferrer"><FileText aria-hidden="true" /><span><strong>{asset.label}</strong><small>{asset.originalName}</small></span><ExternalLink aria-hidden="true" /></a>)}</div></section> : null}
        </article> : null}
      </div>
    </PublicPortalShell>
  );
}
