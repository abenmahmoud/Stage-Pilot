import { useState } from "react";
import { newsIllustration } from "../lib/news-illustrations";
import "../styles/news-photo.css";

type PhotoAsset = {
  assetKind: string;
  role?: string;
  signedUrl?: string | null;
  altText?: string | null;
};
type Props = {
  content: { title: string; slug?: string; category?: string; assets?: PhotoAsset[] };
  compact?: boolean;
  className?: string;
};

export function NewsPhoto({ content, compact = false, className = "" }: Props) {
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const candidates = content.assets?.filter(asset => asset.assetKind === "image" && asset.signedUrl) ?? [];
  const supplied = candidates.find(asset => asset.role === "couverture") ?? candidates[0];
  const fallback = newsIllustration(content);
  const custom = supplied?.signedUrl && !failedSources.includes(supplied.signedUrl) ? supplied : null;
  const defaultSource = compact ? fallback.thumbnail : fallback.src;
  const src = custom?.signedUrl || (failedSources.includes(defaultSource) ? "/lycee-blaise-hero.webp" : defaultSource);
  const illustrated = !custom && fallback.illustrative && src !== "/lycee-blaise-hero.webp";

  return <figure className={`news-photo ${compact ? "news-photo--compact" : ""} ${className}`} data-photo-theme={custom ? "custom" : fallback.key}>
    <img
      src={src}
      srcSet={!custom && src === fallback.src && fallback.illustrative ? `${fallback.thumbnail} 360w, ${fallback.src} 960w` : undefined}
      sizes={!compact ? "(max-width: 640px) 100vw, 420px" : undefined}
      width={compact ? 360 : 960}
      height={compact ? 240 : 640}
      alt={compact ? "" : custom?.altText ?? fallback.alt}
      loading={compact ? "lazy" : "eager"}
      decoding="async"
      onError={() => setFailedSources(current => current.includes(src) ? current : [...current, src])}
    />
    {!compact && illustrated ? <figcaption>Photo d’illustration</figcaption> : null}
  </figure>;
}
