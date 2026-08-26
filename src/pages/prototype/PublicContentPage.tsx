import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, FileText, LoaderCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Link, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import "./lycee-connect.css";

type PublicAsset = {
  id: string;
  assetKind: "image" | "document";
  title: string;
  altText: string | null;
  originalName: string;
  label: string;
  signedUrl: string | null;
};

type PublicItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  category: string;
  publishedAt: string | null;
  assets: PublicAsset[];
};

export default function PublicContentPage() {
  const { slug = "" } = useParams();
  const [item, setItem] = useState<PublicItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch(`/api/content/public?slug=${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { items?: PublicItem[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Cette page ne peut pas être chargée");
        setItem(payload.items?.[0] ?? null);
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Cette page ne peut pas être chargée");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [slug]);

  const documents = item?.assets.filter((asset) => asset.assetKind === "document" && asset.signedUrl) ?? [];

  return (
    <div className="lycee-connect lycee-article-page">
      <header className="lycee-article-header">
        <Link to="/?view=school" className="lycee-article-brand">
          <img src="/lycee-blaise-logo.png" alt="" />
          <span><strong>Blaise Cendrars</strong><small>Lycée polyvalent · Sevran</small></span>
        </Link>
        <Link to="/" className="lycee-article-back"><ArrowLeft aria-hidden="true" /> Accueil</Link>
      </header>

      <main className="lycee-article-main">
        {loading ? <div className="lycee-article-state"><LoaderCircle className="is-spinning" aria-hidden="true" /><p>Chargement de la page…</p></div> : null}
        {!loading && (error || !item) ? <div className="lycee-article-state"><h1>Page en cours de vérification</h1><p>{error || "Cette information n’est pas encore publiée dans le nouveau portail."}</p><Link to="/">Revenir à l’accueil</Link></div> : null}
        {item ? <article className="lycee-article-content">
          <p className="lycee-eyebrow">{item.category}</p>
          <h1>{item.title}</h1>
          {item.summary ? <p className="lycee-article-lead">{item.summary}</p> : null}
          <div className="lycee-public-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.bodyMarkdown}</ReactMarkdown></div>
          {documents.length ? <section className="lycee-article-documents" aria-labelledby="documents-title"><h2 id="documents-title">Documents</h2><div>{documents.map((asset) => <a key={asset.id} href={asset.signedUrl ?? "#"} target="_blank" rel="noreferrer"><FileText aria-hidden="true" /><span><strong>{asset.label}</strong><small>{asset.originalName}</small></span><ExternalLink aria-hidden="true" /></a>)}</div></section> : null}
        </article> : null}
      </main>
    </div>
  );
}
