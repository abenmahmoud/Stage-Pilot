export type PublicContentFeedItem = {
  id: string;
  title: string;
  summary: string;
  category: string;
  featured: boolean;
  publishedAt: string | null;
};

function normalizeSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/\s+/g, " ")
    .trim();
}

export function publicContentFeedCategories<T extends PublicContentFeedItem>(items: T[]): string[] {
  return [...new Set(items.map((item) => item.category.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "fr", { sensitivity: "base" }));
}

export function filterPublicContentFeed<T extends PublicContentFeedItem>(
  items: T[],
  query: string,
  category: string
): T[] {
  const normalizedQuery = normalizeSearch(query);
  return items.filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    if (!normalizedQuery) return true;
    return normalizeSearch(`${item.title} ${item.summary} ${item.category}`).includes(normalizedQuery);
  });
}

export function publicContentDateLabel(value: string | null): string {
  if (!value) return "Date non disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date non disponible";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(date);
}
