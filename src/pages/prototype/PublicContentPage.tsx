import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, FileText, LoaderCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { PublicContentMarkdown } from "../../components/PublicContentMarkdown";
import { PublicPortalFooter } from "../../components/PublicPortalFooter";
import { publicPageAlternative } from "../../../shared/public-portal-navigation";
import {
  readPublicContentPagePayload,
  type PublicContent,
} from "./public-content-client";
import "./lycee-connect.css";

export default function PublicContentPage() {
  const { slug = "" } = useParams();
  const [item, setItem] = useState<PublicContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const alternative = publicPageAlternative(slug);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setItem(null);
    fetch(`/api/content/public?slug=${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (response) => {
        const nextItem = await readPublicContentPagePayload(response, slug);
        if (!controller.signal.aborted) setItem(nextItem);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setError("La page ne peut pas être chargée pour le moment. Vous pouvez réessayer ou consulter une autre rubrique.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug, attempt]);

  useEffect(() => {
    document.title = item?.slug === slug
      ? `${item.title} · Lycée Blaise Cendrars`
      : "Informations du lycée · Blaise Cendrars";
    window.scrollTo({ top: 0 });
  }, [slug, item]);

  const documents = item?.assets.filter((asset) => asset.assetKind === "document" && asset.signedUrl) ?? [];

  return (
    <div className="lycee-connect lycee-article-page">
      <a className="lycee-skip-link" href="#lycee-article-main">Aller au contenu</a>
      <header className="lycee-article-header">
        <Link to="/?view=school" className="lycee-article-brand">
          <img src="/lycee-blaise-logo.png" alt="" />
          <span><strong>Blaise Cendrars</strong><small>Lycée polyvalent · Sevran</small></span>
        </Link>
        <Link to="/" className="lycee-article-back"><ArrowLeft aria-hidden="true" /> Accueil</Link>
      </header>

      <main className="lycee-article-main" id="lycee-article-main" tabIndex={-1}>
        {loading ? <div className="lycee-article-state"><LoaderCircle className="is-spinning" aria-hidden="true" /><p>Chargement de la page…</p></div> : null}
        {!loading && (error || !item) ? <section className="lycee-article-state"><h1>{error ? "Chargement interrompu" : "Cette page n’est pas encore disponible"}</h1><p>{error || "Vous pouvez retrouver les informations disponibles dans la rubrique correspondante ou adresser votre question au lycée."}</p><div className="lycee-empty-actions">{error ? <button type="button" onClick={() => setAttempt((value) => value + 1)}>Réessayer</button> : null}<Link to={alternative.href}>{alternative.label}</Link><Link to="/?view=help">Demander de l’aide</Link></div><Link to="/">Revenir à l’accueil</Link></section> : null}
        {!loading && !error && item?.slug === slug ? <article className="lycee-article-content">
          <p className="lycee-eyebrow">{item.category}</p>
          <h1>{item.title}</h1>
          {item.summary ? <p className="lycee-article-lead">{item.summary}</p> : null}
          <div className="lycee-public-markdown"><PublicContentMarkdown>{item.bodyMarkdown}</PublicContentMarkdown></div>
          {documents.length ? <section className="lycee-article-documents" aria-labelledby="documents-title"><h2 id="documents-title">Documents</h2><div>{documents.map((asset) => <a key={asset.id} href={asset.signedUrl ?? "#"} target="_blank" rel="noreferrer"><FileText aria-hidden="true" /><span><strong>{asset.label}</strong><small>{asset.originalName}</small></span><ExternalLink aria-hidden="true" /></a>)}</div></section> : null}
        </article> : null}
      </main>
      <PublicPortalFooter />
    </div>
  );
}
