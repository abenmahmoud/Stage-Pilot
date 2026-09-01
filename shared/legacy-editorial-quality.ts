export type LegacyEditorialDisposition = "durable" | "archive" | "a_confirmer";
export type LegacyEditorialSeverity = "blocking" | "major" | "review";

export type LegacyEditorialContent = {
  slug: string;
  originalSlug: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  disposition: LegacyEditorialDisposition;
  sourceModifiedAt: string | null;
};

export type LegacyEditorialIssue = {
  code: string;
  severity: LegacyEditorialSeverity;
  field: "title" | "summary" | "bodyMarkdown" | "slug" | "decision";
  evidence: string;
  recommendation: string;
};

export type LegacyEditorialItemReview = {
  slug: string;
  title: string;
  disposition: LegacyEditorialDisposition;
  sourceModifiedAt: string | null;
  issues: LegacyEditorialIssue[];
};

export type LegacyEditorialReview = {
  contentsReviewed: number;
  issueCounts: Record<LegacyEditorialSeverity, number>;
  items: LegacyEditorialItemReview[];
};

const SEVERITY_ORDER: Record<LegacyEditorialSeverity, number> = {
  blocking: 0,
  major: 1,
  review: 2,
};

const TITLE_RECOMMENDATIONS = new Map<string, string>([
  ["Présentation Lycée", "Présentation du lycée"],
  ["Présentations Clubs", "Présentation des clubs"],
  ["Vie du Lycée", "Vie du lycée"],
]);

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,139}$/;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function assertEditorialContent(value: unknown): asserts value is LegacyEditorialContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Contenu éditorial invalide.");
  }
  const content = value as Record<string, unknown>;
  const keys = Object.keys(content).sort();
  const expected = [
    "bodyMarkdown",
    "disposition",
    "originalSlug",
    "slug",
    "sourceModifiedAt",
    "summary",
    "title",
  ].sort();
  const allowed = new Set([
    ...expected,
    "allReferencedUrls",
    "category",
    "contentType",
    "importKey",
    "referencedMedia",
    "sourceUrl",
    "wordpressCategories",
    "wordpressId",
    "wordpressType",
  ]);
  if (!expected.every((key) => keys.includes(key)) || keys.some((key) => !allowed.has(key))) {
    throw new Error("Champs éditoriaux inattendus.");
  }
  if (
    typeof content.slug !== "string"
    || !SLUG_PATTERN.test(content.slug)
    || typeof content.originalSlug !== "string"
    || content.originalSlug.length < 1
    || content.originalSlug.length > 300
    || typeof content.title !== "string"
    || content.title.trim().length < 1
    || content.title.length > 300
    || typeof content.summary !== "string"
    || content.summary.length > 1_000
    || typeof content.bodyMarkdown !== "string"
    || content.bodyMarkdown.length > 30_000
    || !["durable", "archive", "a_confirmer"].includes(String(content.disposition))
  ) throw new Error("Valeur éditoriale hors limites.");
  if (content.sourceModifiedAt !== null) {
    if (typeof content.sourceModifiedAt !== "string" || !ISO_PATTERN.test(content.sourceModifiedAt)) {
      throw new Error("Date éditoriale invalide.");
    }
    const parsed = new Date(content.sourceModifiedAt);
    if (!Number.isFinite(parsed.getTime())) throw new Error("Date éditoriale non canonique.");
    const canonical = parsed.toISOString();
    if (
      canonical !== content.sourceModifiedAt
      && canonical.replace(".000Z", "Z") !== content.sourceModifiedAt
    ) {
      throw new Error("Date éditoriale non canonique.");
    }
  }
}

function boundedEvidence(value: string, matchIndex = 0, matchLength = value.length): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 140) return normalized;
  const normalizedPrefix = value.slice(0, matchIndex).replace(/\s+/g, " ").trim();
  const start = Math.max(0, normalizedPrefix.length - 45);
  const wanted = Math.max(20, Math.min(matchLength + 90, 140));
  const excerpt = normalized.slice(start, start + wanted).trim();
  return `${start > 0 ? "..." : ""}${excerpt}${start + wanted < normalized.length ? "..." : ""}`;
}

function matchingIssue(
  value: string,
  pattern: RegExp,
  issue: Omit<LegacyEditorialIssue, "evidence">
): LegacyEditorialIssue | null {
  const match = pattern.exec(value);
  return match
    ? { ...issue, evidence: boundedEvidence(value, match.index, match[0].length) }
    : null;
}

function decisionIssue(content: LegacyEditorialContent): LegacyEditorialIssue {
  if (content.disposition === "a_confirmer") {
    return {
      code: "decision.current_facts_required",
      severity: "major",
      field: "decision",
      evidence: "Information marquée à confirmer",
      recommendation: "Faire confirmer les dates, coordonnées, responsables et liens par le service compétent.",
    };
  }
  if (content.disposition === "archive") {
    return {
      code: "decision.archive_required",
      severity: "review",
      field: "decision",
      evidence: "Contenu historique classé en archive",
      recommendation: "Confirmer l'archivage et vérifier qu'aucune formulation ne le présente comme actuel.",
    };
  }
  return {
    code: "decision.business_review_required",
    severity: "review",
    field: "decision",
    evidence: "Contenu durable à valider",
    recommendation: "Faire relire les informations par le service responsable avant publication.",
  };
}

function reviewContent(content: LegacyEditorialContent): LegacyEditorialItemReview {
  const issues: LegacyEditorialIssue[] = [decisionIssue(content)];
  const combined = `${content.title}\n${content.summary}\n${content.bodyMarkdown}`;
  const candidates = [
    matchingIssue(content.bodyMarkdown, /^#{1,6}[ \t]*$/m, {
      code: "conversion.empty_heading",
      severity: "major",
      field: "bodyMarkdown",
      recommendation: "Supprimer le titre Markdown vide.",
    }),
    matchingIssue(content.bodyMarkdown, /\[En savoir plus[^\]]*Continuer\]\(/iu, {
      code: "conversion.concatenated_call_to_action",
      severity: "major",
      field: "bodyMarkdown",
      recommendation: "Remplacer le libellé concaténé par un lien court et explicite.",
    }),
    matchingIssue(content.bodyMarkdown, /^#{1,6}\s+\[(https?:\/\/[^\]]+)\]\(\1\)/mu, {
      code: "conversion.raw_url_heading",
      severity: "major",
      field: "bodyMarkdown",
      recommendation: "Remplacer l'adresse brute par un titre de lien compréhensible.",
    }),
    matchingIssue(combined, /\b2(?:ème|eme)\b/iu, {
      code: "language.ordinal_typography",
      severity: "major",
      field: "bodyMarkdown",
      recommendation: "Employer « 2e ».",
    }),
    matchingIssue(combined, /\bBaccalauréat Générale\b/u, {
      code: "language.baccalaureat_agreement",
      severity: "major",
      field: "bodyMarkdown",
      recommendation: "Employer « baccalauréat général ».",
    }),
    matchingIssue(combined, /\bAccès Rapides\b/u, {
      code: "language.heading_capitalization",
      severity: "major",
      field: "bodyMarkdown",
      recommendation: "Employer « Accès rapides ».",
    }),
    matchingIssue(content.bodyMarkdown, /\[(?:Voir plus|Cliquez ici)\]\(/iu, {
      code: "accessibility.generic_link_label",
      severity: "major",
      field: "bodyMarkdown",
      recommendation: "Nommer la destination ou l'action du lien.",
    }),
    matchingIssue(content.bodyMarkdown, /!\[(?:Illustration du lycée|image|photo)\]\(/iu, {
      code: "accessibility.generic_image_alt",
      severity: "review",
      field: "bodyMarkdown",
      recommendation: "Décrire brièvement l'image utile ou laisser l'alternative vide si elle est décorative.",
    }),
    matchingIssue(content.bodyMarkdown, /\]\(http:\/\//iu, {
      code: "links.insecure_http",
      severity: "blocking",
      field: "bodyMarkdown",
      recommendation: "Remplacer par une destination HTTPS officielle ou retirer le lien.",
    }),
  ];
  issues.push(...candidates.filter((issue): issue is LegacyEditorialIssue => issue !== null));

  const titleRecommendation = [...TITLE_RECOMMENDATIONS.entries()].find(
    ([current]) => content.title === current || content.title.startsWith(`${current} `)
  );
  const recommendedTitle = titleRecommendation
    ? content.title.replace(titleRecommendation[0], titleRecommendation[1])
    : null;
  if (recommendedTitle) {
    issues.push({
      code: "language.title_wording",
      severity: "major",
      field: "title",
      evidence: content.title,
      recommendation: `Employer « ${recommendedTitle} ».`,
    });
  }
  if (content.slug.length > 80 || content.slug.startsWith("https-")) {
    issues.push({
      code: "routing.opaque_slug",
      severity: "major",
      field: "slug",
      evidence: boundedEvidence(content.slug),
      recommendation: "Choisir une adresse courte, stable et compréhensible avant publication.",
    });
  }
  const slugYears = new Set(content.originalSlug.match(/\b20\d{2}\b/g) ?? []);
  const titleYears = new Set(content.title.match(/\b20\d{2}\b/g) ?? []);
  if (slugYears.size > 0 && titleYears.size > 0 && ![...slugYears].some((year) => titleYears.has(year))) {
    issues.push({
      code: "freshness.slug_title_year_mismatch",
      severity: "major",
      field: "title",
      evidence: `${content.originalSlug} / ${content.title}`,
      recommendation: "Confirmer l'année, puis aligner le titre et la future adresse sans casser la redirection historique.",
    });
  }
  if (!content.bodyMarkdown.trim()) {
    issues.push({
      code: "content.empty_body",
      severity: "blocking",
      field: "bodyMarkdown",
      evidence: "Corps vide",
      recommendation: "Rédiger ou archiver explicitement ce contenu avant publication.",
    });
  }

  issues.sort((left, right) =>
    SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
    || left.code.localeCompare(right.code, "fr")
  );
  return {
    slug: content.slug,
    title: content.title,
    disposition: content.disposition,
    sourceModifiedAt: content.sourceModifiedAt,
    issues,
  };
}

export function reviewLegacyEditorialQuality(contents: LegacyEditorialContent[]): LegacyEditorialReview {
  if (!Array.isArray(contents) || contents.length > 100) {
    throw new Error("L'inventaire éditorial doit contenir au plus 100 éléments.");
  }
  const slugs = new Set<string>();
  const items = contents.map((content: unknown) => {
    assertEditorialContent(content);
    if (!content.slug || slugs.has(content.slug)) throw new Error("Slug éditorial manquant ou dupliqué.");
    slugs.add(content.slug);
    return reviewContent(content);
  });
  const issueCounts: Record<LegacyEditorialSeverity, number> = { blocking: 0, major: 0, review: 0 };
  for (const issue of items.flatMap((item) => item.issues)) issueCounts[issue.severity] += 1;
  return { contentsReviewed: items.length, issueCounts, items };
}

function markdownText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/([`*_\[\]<>])/g, "\\$1")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

export function renderLegacyEditorialReviewMarkdown(
  review: LegacyEditorialReview,
  sourceGeneratedAt: string
): string {
  const parsedSourceGeneratedAt = new Date(sourceGeneratedAt);
  const canonicalSourceGeneratedAt = Number.isFinite(parsedSourceGeneratedAt.getTime())
    ? parsedSourceGeneratedAt.toISOString()
    : "";
  if (
    !ISO_PATTERN.test(sourceGeneratedAt)
    || (
      canonicalSourceGeneratedAt !== sourceGeneratedAt
      && canonicalSourceGeneratedAt.replace(".000Z", "Z") !== sourceGeneratedAt
    )
  ) {
    throw new Error("Date de génération de l'inventaire invalide.");
  }
  const lines = [
    "# Relecture éditoriale de la reprise WordPress",
    "",
    `**Inventaire source généré le** : ${sourceGeneratedAt.slice(0, 10)}`,
    "**Cible** : brouillons de preview uniquement",
    "",
    "Ce rapport est un contrôle automatique d'aide à la relecture. Il ne corrige, ne valide et ne publie aucun contenu.",
    "",
    "## Synthèse",
    "",
    `- Contenus analysés : **${review.contentsReviewed}**`,
    `- Bloquants techniques : **${review.issueCounts.blocking}**`,
    `- Corrections importantes : **${review.issueCounts.major}**`,
    `- Validations humaines : **${review.issueCounts.review}**`,
    "",
    "## Ordre conseillé",
    "",
    "1. Corriger les bloquants et défauts de conversion.",
    "2. Corriger titres, libellés de liens, français et adresses opaques.",
    "3. Faire valider les contenus durables, les archives et les informations à confirmer par le service responsable.",
    "4. Contrôler les trois médias refusés dans le rapport d'import avant toute publication.",
    "",
    "## Contenus",
    "",
  ];
  for (const item of review.items) {
    lines.push(
      `### ${markdownText(item.title)}`,
      "",
      `- Adresse : \`/site/${markdownText(item.slug)}\``,
      `- Classement : \`${item.disposition}\``,
      `- Source modifiée : ${item.sourceModifiedAt?.slice(0, 10) ?? "date inconnue"}`,
    );
    for (const issue of item.issues) {
      const label = issue.severity === "blocking" ? "BLOQUANT" : issue.severity === "major" ? "À CORRIGER" : "À VALIDER";
      lines.push(
        `- **${label}** \`${issue.code}\` (${issue.field}) : ${markdownText(issue.evidence)}. ${markdownText(issue.recommendation)}`
      );
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
