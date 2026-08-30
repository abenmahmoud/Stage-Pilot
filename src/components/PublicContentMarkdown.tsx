import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { isAllowedPublicContentSignedUrl } from "../pages/prototype/public-content-client";

function safePublicContentHref(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 1 || value.length > 2_048) return null;
  if (value !== value.trim() || /[\u0000-\u001f\\]/.test(value)) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (/^mailto:[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,63}$/i.test(value)) return value;
  if (/^tel:\+?[0-9]{6,15}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const PUBLIC_CONTENT_COMPONENTS: Components = {
  a: ({ href, children }) => {
    const safeHref = safePublicContentHref(href);
    if (!safeHref) return <span>{children}</span>;
    const external = safeHref.startsWith("https://");
    return <a href={safeHref} target={external ? "_blank" : undefined} rel={external ? "noreferrer noopener" : undefined}>{children}</a>;
  },
  img: ({ src, alt }) => isAllowedPublicContentSignedUrl(src)
    ? <img src={src} alt={alt ?? ""} loading="lazy" referrerPolicy="no-referrer" />
    : null,
};

export function PublicContentMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={PUBLIC_CONTENT_COMPONENTS}>
      {children}
    </ReactMarkdown>
  );
}
