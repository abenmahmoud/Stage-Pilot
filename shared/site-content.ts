export const SITE_CONTENT_TYPES = ["article", "alerte", "page", "document"] as const;
export const SITE_CONTENT_STATUSES = ["brouillon", "a_valider", "publie", "archive"] as const;
export const SITE_CONTENT_AUDIENCES = ["tous", "eleves", "parents", "personnels", "professeurs"] as const;
export const SITE_ASSET_ROLES = ["couverture", "illustration", "document"] as const;

export type SiteContentType = (typeof SITE_CONTENT_TYPES)[number];
export type SiteContentStatus = (typeof SITE_CONTENT_STATUSES)[number];
export type SiteContentAudience = (typeof SITE_CONTENT_AUDIENCES)[number];
export type SiteAssetRole = (typeof SITE_ASSET_ROLES)[number];

export type SiteContentAssetLinkInput = {
  assetId: string;
  assetRole: SiteAssetRole;
  publicLabel: string;
  position: number;
};

export type SiteContentInput = {
  contentType: SiteContentType;
  slug: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  category: string;
  audience: SiteContentAudience;
  templateId: string | null;
  featured: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  publishAt: Date | null;
  expiresAt: Date | null;
  assets: SiteContentAssetLinkInput[];
};

export type SiteContentTemplateInput = {
  slug: string;
  name: string;
  contentType: SiteContentType;
  description: string;
  defaultTitle: string;
  defaultSummary: string;
  defaultBodyMarkdown: string;
  active: boolean;
};

export type SiteAssetInput = {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  assetKind: "image" | "document";
  title: string;
  altText: string | null;
};

export type SiteContentAiInput = {
  action: "rediger" | "ameliorer" | "raccourcir" | "simplifier" | "titres";
  contentType: SiteContentType;
  title: string;
  summary: string;
  bodyMarkdown: string;
  instructions: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Les données envoyées sont invalides");
  }
  return value as Record<string, unknown>;
}

function textValue(value: unknown, label: string, maxLength: number, required = true): string {
  if (typeof value !== "string") {
    if (!required && (value === null || value === undefined)) return "";
    throw new Error(`${label} est requis`);
  }
  const clean = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (required && !clean) throw new Error(`${label} est requis`);
  if (clean.length > maxLength) throw new Error(`${label} dépasse ${maxLength} caractères`);
  return clean;
}

function enumValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string
): T[number] {
  const clean = textValue(value, label, 40);
  if (!(allowed as readonly string[]).includes(clean)) throw new Error(`${label} est invalide`);
  return clean as T[number];
}

function nullableUuid(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  const clean = textValue(value, label, 36);
  if (!UUID_PATTERN.test(clean)) throw new Error(`${label} est invalide`);
  return clean;
}

function nullableDate(value: unknown, label: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const clean = textValue(value, label, 40);
  const date = new Date(clean);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} est invalide`);
  return date;
}

export function normalizeSiteSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

function parseAssetLinks(value: unknown): SiteContentAssetLinkInput[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 20) throw new Error("La liste des fichiers est invalide");
  const seen = new Set<string>();
  return value.map((entry, index) => {
    const row = objectValue(entry);
    const assetId = nullableUuid(row.assetId, "Fichier");
    if (!assetId || seen.has(assetId)) throw new Error("Un fichier lié est invalide ou dupliqué");
    seen.add(assetId);
    const position = Number.isInteger(row.position) ? Number(row.position) : index;
    if (position < 0 || position > 1000) throw new Error("La position du fichier est invalide");
    return {
      assetId,
      assetRole: enumValue(row.assetRole, SITE_ASSET_ROLES, "Rôle du fichier"),
      publicLabel: textValue(row.publicLabel, "Libellé du fichier", 180),
      position,
    };
  });
}

export function parseSiteContentInput(value: unknown): SiteContentInput {
  const input = objectValue(value);
  const title = textValue(input.title, "Titre", 180);
  const suppliedSlug = typeof input.slug === "string" ? input.slug : title;
  const slug = normalizeSiteSlug(suppliedSlug);
  if (!slug || !SLUG_PATTERN.test(slug)) throw new Error("L’adresse de la page est invalide");
  const publishAt = nullableDate(input.publishAt, "Date de publication");
  const expiresAt = nullableDate(input.expiresAt, "Date d’expiration");
  if (publishAt && expiresAt && expiresAt <= publishAt) {
    throw new Error("La date d’expiration doit être postérieure à la publication");
  }
  return {
    contentType: enumValue(input.contentType, SITE_CONTENT_TYPES, "Type"),
    slug,
    title,
    summary: textValue(input.summary ?? "", "Résumé", 600, false),
    bodyMarkdown: textValue(input.bodyMarkdown ?? "", "Contenu", 30000, false),
    category: textValue(input.category ?? "Vie du lycée", "Catégorie", 100),
    audience: enumValue(input.audience ?? "tous", SITE_CONTENT_AUDIENCES, "Public"),
    templateId: nullableUuid(input.templateId, "Modèle"),
    featured: input.featured === true,
    metaTitle: textValue(input.metaTitle ?? "", "Titre de recherche", 180, false) || null,
    metaDescription: textValue(input.metaDescription ?? "", "Description de recherche", 320, false) || null,
    publishAt,
    expiresAt,
    assets: parseAssetLinks(input.assets),
  };
}

export function parseSiteTemplateInput(value: unknown): SiteContentTemplateInput & { id: string | null } {
  const input = objectValue(value);
  const name = textValue(input.name, "Nom du modèle", 120);
  const slug = normalizeSiteSlug(typeof input.slug === "string" ? input.slug : name);
  if (!slug || !SLUG_PATTERN.test(slug)) throw new Error("L’identifiant du modèle est invalide");
  return {
    id: nullableUuid(input.id, "Modèle"),
    slug,
    name,
    contentType: enumValue(input.contentType, SITE_CONTENT_TYPES, "Type"),
    description: textValue(input.description ?? "", "Description", 500, false),
    defaultTitle: textValue(input.defaultTitle ?? "", "Titre proposé", 180, false),
    defaultSummary: textValue(input.defaultSummary ?? "", "Résumé proposé", 600, false),
    defaultBodyMarkdown: textValue(input.defaultBodyMarkdown ?? "", "Contenu proposé", 30000, false),
    active: input.active !== false,
  };
}

export function parseSiteAssetInput(value: unknown): SiteAssetInput {
  const input = objectValue(value);
  const mimeType = textValue(input.mimeType, "Type de fichier", 150);
  if (!ALLOWED_MIME_TYPES.has(mimeType)) throw new Error("Ce format de fichier n’est pas accepté");
  const sizeBytes = Number(input.sizeBytes);
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > 10 * 1024 * 1024) {
    throw new Error("Le fichier doit faire moins de 10 Mo");
  }
  const assetKind = mimeType.startsWith("image/") ? "image" : "document";
  const altText = textValue(input.altText ?? "", "Texte alternatif", 300, false) || null;
  if (assetKind === "image" && !altText) throw new Error("Décrivez l’image pour les personnes qui ne peuvent pas la voir");
  return {
    originalName: textValue(input.originalName, "Nom du fichier", 255),
    mimeType,
    sizeBytes,
    assetKind,
    title: textValue(input.title, "Titre du fichier", 180),
    altText,
  };
}

export function parseSiteContentAiInput(value: unknown): SiteContentAiInput {
  const input = objectValue(value);
  return {
    action: enumValue(
      input.action,
      ["rediger", "ameliorer", "raccourcir", "simplifier", "titres"] as const,
      "Action IA"
    ),
    contentType: enumValue(input.contentType, SITE_CONTENT_TYPES, "Type"),
    title: textValue(input.title ?? "", "Titre", 180, false),
    summary: textValue(input.summary ?? "", "Résumé", 600, false),
    bodyMarkdown: textValue(input.bodyMarkdown ?? "", "Contenu", 8000, false),
    instructions: textValue(input.instructions ?? "", "Consigne", 1000, false),
  };
}
