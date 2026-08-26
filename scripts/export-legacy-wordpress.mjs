import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import TurndownService from "turndown";

const SOURCE_ORIGIN = "https://lycee-blaise-cendrars-sevran.fr";
const API_ROOT = `${SOURCE_ORIGIN}/wp-json/wp/v2`;
const OUTPUT_DIR = path.resolve("content", "legacy-site");
const MAX_BODY_LENGTH = 30_000;

function decodeHtml(value = "") {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&rsquo;|&lsquo;/gi, "'")
    .replace(/&rdquo;|&ldquo;/gi, '"')
    .replace(/&ndash;/gi, "-")
    .replace(/&mdash;/gi, "-")
    .replace(/&hellip;/gi, "...")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanText(value = "") {
  return decodeHtml(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeSlug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

function normalizedUrl(value) {
  if (!value) return null;
  const decoded = decodeHtml(value.trim());
  try {
    return new URL(decoded, SOURCE_ORIGIN).href;
  } catch {
    return null;
  }
}

function youtubeWatchUrl(value) {
  try {
    const url = new URL(value);
    if (!url.hostname.includes("youtube.com")) return value;
    const match = url.pathname.match(/^\/embed\/([^/?]+)/);
    return match ? `https://www.youtube.com/watch?v=${match[1]}` : value;
  } catch {
    return value;
  }
}

function prepareHtml(value = "") {
  return value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, "")
    .replace(/<(input|button|textarea|select)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(input|button|textarea|select)[^>]*\/?\s*>/gi, "")
    .replace(/<iframe[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/iframe>/gi, (_match, src) => {
      const url = normalizedUrl(src);
      if (!url || url.includes("google.com/maps/embed") || url.includes("maps.googleapis.com")) return "";
      const safeUrl = youtubeWatchUrl(url);
      return `<p><a href="${safeUrl}">Voir le contenu associé</a></p>`;
    })
    .replace(/\s(?:style|class|id|data-[\w-]+|aria-[\w-]+)=("[^"]*"|'[^']*')/gi, "");
}

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "_",
  strongDelimiter: "**",
});

turndown.remove(["script", "style", "noscript", "form", "input", "button", "textarea", "select"]);

turndown.addRule("safeLinks", {
  filter: "a",
  replacement(content, node) {
    const href = normalizedUrl(node.getAttribute("href"));
    const label = content.trim() || cleanText(node.getAttribute("title") ?? "") || href || "Lien";
    if (!href || href.startsWith("javascript:")) return label;
    return `[${label}](${href})`;
  },
});

turndown.addRule("safeImages", {
  filter: "img",
  replacement(_content, node) {
    const src = normalizedUrl(node.getAttribute("src"));
    if (!src) return "";
    const alt = cleanText(node.getAttribute("alt") ?? "") || "Illustration du lycée";
    return `![${alt}](${src})`;
  },
});

function htmlToMarkdown(value) {
  return turndown
    .turndown(prepareHtml(value))
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

async function fetchCollection(route) {
  const firstUrl = `${API_ROOT}/${route}?per_page=50&page=1&_embed=1`;
  const firstResponse = await fetch(firstUrl, { headers: { "user-agent": "LyceeGest legacy inventory" } });
  if (!firstResponse.ok) throw new Error(`${route}: HTTP ${firstResponse.status}`);
  const first = await firstResponse.json();
  const total = Number(firstResponse.headers.get("x-wp-total") ?? first.length);
  const totalPages = Number(firstResponse.headers.get("x-wp-totalpages") ?? 1);
  const rows = [...first];
  for (let page = 2; page <= totalPages; page += 1) {
    const response = await fetch(`${API_ROOT}/${route}?per_page=50&page=${page}&_embed=1`, {
      headers: { "user-agent": "LyceeGest legacy inventory" },
    });
    if (!response.ok) throw new Error(`${route} page ${page}: HTTP ${response.status}`);
    rows.push(...await response.json());
  }
  return { rows, total, totalPages };
}

function classifyContent(type, slug) {
  if (slug === "presentation-lycee") {
    return { contentType: "page", category: "Le lycée", disposition: "durable" };
  }
  if (slug === "presentations-clubs") {
    return { contentType: "page", category: "Vie du lycée", disposition: "durable" };
  }
  if (type === "post") return { contentType: "article", category: "Archives et actualités", disposition: "archive" };
  if (/^(formations|bac-|cap-|specialites|nsi$|hlp$|llce$|maths$)/.test(slug)) {
    return { contentType: "page", category: "Formations", disposition: "durable" };
  }
  if (/^(vie-du-lycee|cdi|unss|presentations-clubs)/.test(slug)) {
    return { contentType: "page", category: "Vie du lycée", disposition: "durable" };
  }
  if (/^(contact|localisation|se-connecter)/.test(slug)) {
    return { contentType: "page", category: "Informations pratiques", disposition: "a_confirmer" };
  }
  if (slug.startsWith("https-docs-google-com-forms")) {
    return { contentType: "page", category: "Mini-stages", disposition: "a_confirmer" };
  }
  return { contentType: "page", category: "Le lycée", disposition: "a_confirmer" };
}

function categoriesFor(item) {
  const terms = item._embedded?.["wp:term"]?.flat?.() ?? [];
  return terms
    .filter((term) => term.taxonomy === "category")
    .map((term) => ({ id: term.id, slug: term.slug, name: cleanText(term.name) }));
}

function urlsInHtml(value) {
  return [...value.matchAll(/(?:href|src)=["']([^"']+)["']/gi)]
    .map((match) => normalizedUrl(match[1]))
    .filter((url) => url && !url.includes("google.com/maps/embed") && !/[?&]key=/i.test(url));
}

function mediaAliases(item) {
  const sizes = Object.values(item.media_details?.sizes ?? {})
    .map((size) => normalizedUrl(size.source_url))
    .filter(Boolean);
  return [...new Set([normalizedUrl(item.source_url), ...sizes].filter(Boolean))];
}

function mediaRecord(item) {
  return {
    wordpressId: item.id,
    parentId: item.parent || null,
    slug: item.slug,
    title: cleanText(item.title?.rendered),
    caption: cleanText(item.caption?.rendered),
    altText: cleanText(item.alt_text),
    mimeType: item.mime_type,
    sourceUrl: normalizedUrl(item.source_url),
    aliases: mediaAliases(item),
    modifiedAt: item.modified_gmt ? `${item.modified_gmt}Z` : null,
  };
}

function contentRecord(item, mediaByAlias) {
  const title = cleanText(item.title?.rendered) || `Contenu WordPress ${item.id}`;
  let bodyMarkdown = htmlToMarkdown(item.content?.rendered ?? "");
  for (const [alias, media] of mediaByAlias) {
    if (bodyMarkdown.includes(alias)) {
      bodyMarkdown = bodyMarkdown.split(alias).join(`legacy-media:${media.wordpressId}`);
    }
  }
  if (bodyMarkdown.length > MAX_BODY_LENGTH) {
    throw new Error(`${item.type}/${item.slug}: ${bodyMarkdown.length} caractères après conversion`);
  }
  const excerpt = cleanText(item.excerpt?.rendered);
  const summary = (excerpt || bodyMarkdown.replace(/[#*_>`\[\]()!-]/g, " ").replace(/\s+/g, " ").trim()).slice(0, 600);
  const classification = classifyContent(item.type, item.slug);
  const urls = [...new Set(urlsInHtml(item.content?.rendered ?? ""))];
  const referencedMedia = [...new Set(urls.map((url) => mediaByAlias.get(url)?.wordpressId).filter(Boolean))];
  return {
    importKey: `wordpress:${item.type}:${item.id}`,
    wordpressId: item.id,
    wordpressType: item.type,
    slug: item.slug === "accueil" ? "accueil-historique" : safeSlug(item.slug),
    originalSlug: item.slug,
    sourceUrl: item.link,
    sourceModifiedAt: item.modified_gmt ? `${item.modified_gmt}Z` : null,
    title,
    summary,
    bodyMarkdown,
    contentType: classification.contentType,
    category: classification.category,
    disposition: classification.disposition,
    wordpressCategories: categoriesFor(item),
    referencedMedia,
    allReferencedUrls: urls,
  };
}

function markdownReport(exported) {
  const lines = [
    "# Inventaire du site WordPress historique",
    "",
    `**Généré le** : ${exported.generatedAt}`,
    `**Source** : ${SOURCE_ORIGIN}`,
    `**Contenus** : ${exported.counts.contentsAccessible} accessibles / ${exported.counts.contentsDeclared} déclarés`,
    `**Médias** : ${exported.counts.mediaAccessible} accessibles / ${exported.counts.mediaDeclared} déclarés`,
    "",
  ];
  if (exported.counts.mediaAccessible !== exported.counts.mediaDeclared) {
    lines.push(
      `> Écart à contrôler avant bascule : WordPress annonce ${exported.counts.mediaDeclared} médias mais son API publique n'en renvoie que ${exported.counts.mediaAccessible}.`,
      ""
    );
  }
  lines.push("## Contenus", "", "| Type | Adresse | Titre | Date source | Classement | Médias liés |", "| --- | --- | --- | --- | --- | ---: |");
  for (const item of exported.contents) {
    lines.push(`| ${item.wordpressType} | \`${item.originalSlug}\` | ${item.title.replace(/\|/g, "\\|")} | ${item.sourceModifiedAt?.slice(0, 10) ?? "-"} | ${item.disposition} | ${item.referencedMedia.length} |`);
  }
  lines.push("", "## Médias", "", "| Type | Nombre |", "| --- | ---: |");
  const mimeCounts = Object.entries(exported.media.reduce((counts, item) => {
    counts[item.mimeType] = (counts[item.mimeType] ?? 0) + 1;
    return counts;
  }, {})).sort((left, right) => right[1] - left[1]);
  for (const [mime, count] of mimeCounts) lines.push(`| ${mime} | ${count} |`);
  lines.push("", "## Liens à contrôler", "");
  for (const url of exported.unresolvedUploadUrls) lines.push(`- ${url}`);
  if (!exported.unresolvedUploadUrls.length) lines.push("- Aucun lien de média non rapproché dans les contenus accessibles.");
  lines.push("");
  return lines.join("\n");
}

function rewriteInternalContentLinks(contents) {
  const destinations = new Map();
  for (const content of contents) {
    const source = new URL(content.sourceUrl);
    const variants = new Set([
      source.href,
      source.href.replace(/\/$/, ""),
      `${source.href.replace(/\/$/, "")}/`,
    ]);
    for (const variant of variants) destinations.set(variant, `/site/${content.slug}`);
  }
  return contents.map((content) => {
    let bodyMarkdown = content.bodyMarkdown;
    for (const [source, destination] of destinations) {
      if (bodyMarkdown.includes(source)) bodyMarkdown = bodyMarkdown.split(source).join(destination);
    }
    return { ...content, bodyMarkdown };
  });
}

async function main() {
  const [pages, posts, media, categories] = await Promise.all([
    fetchCollection("pages"),
    fetchCollection("posts"),
    fetchCollection("media"),
    fetchCollection("categories"),
  ]);
  const mediaRows = media.rows.map(mediaRecord);
  const mediaByAlias = new Map(mediaRows.flatMap((item) => item.aliases.map((alias) => [alias, item])));
  const contents = rewriteInternalContentLinks([...pages.rows, ...posts.rows]
    .map((item) => contentRecord(item, mediaByAlias))
    .sort((left, right) => left.sourceUrl.localeCompare(right.sourceUrl, "fr")));
  const uploadUrls = [...new Set(contents.flatMap((item) => item.allReferencedUrls)
    .filter((url) => url.includes("/wp-content/uploads/")))];
  const unresolvedUploadUrls = uploadUrls.filter((url) => !mediaByAlias.has(url));
  const exported = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceOrigin: SOURCE_ORIGIN,
    counts: {
      contentsDeclared: pages.total + posts.total,
      contentsAccessible: contents.length,
      pagesDeclared: pages.total,
      pagesAccessible: pages.rows.length,
      postsDeclared: posts.total,
      postsAccessible: posts.rows.length,
      mediaDeclared: media.total,
      mediaAccessible: mediaRows.length,
    },
    contents,
    media: mediaRows,
    categories: categories.rows.map((item) => ({ id: item.id, slug: item.slug, name: cleanText(item.name), count: item.count })),
    unresolvedUploadUrls,
  };
  await mkdir(OUTPUT_DIR, { recursive: true });
  await Promise.all([
    writeFile(path.join(OUTPUT_DIR, "inventory.json"), `${JSON.stringify(exported, null, 2)}\n`, "utf8"),
    writeFile(path.join(OUTPUT_DIR, "inventory.md"), `${markdownReport(exported).trimEnd()}\n`, "utf8"),
  ]);
  console.log(JSON.stringify({ output: OUTPUT_DIR, counts: exported.counts, unresolvedUploadUrls: unresolvedUploadUrls.length }, null, 2));
}

await main();
