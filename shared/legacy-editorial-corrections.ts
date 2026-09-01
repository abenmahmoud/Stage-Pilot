export type LegacyEditorialDraft = {
  title: string;
  summary: string;
  bodyMarkdown: string;
};

export type LegacyEditorialCorrection = {
  code: string;
  field: keyof LegacyEditorialDraft;
  occurrences: number;
};

export type LegacyEditorialCorrectionResult = {
  draft: LegacyEditorialDraft;
  corrections: LegacyEditorialCorrection[];
};

type Replacement = string | ((match: string, ...captures: unknown[]) => string);

const MAXIMUM_LENGTHS: Record<keyof LegacyEditorialDraft, number> = {
  title: 300,
  summary: 1_000,
  bodyMarkdown: 30_000,
};

const TITLE_REPLACEMENTS = new Map<string, string>([
  ["Présentation Lycée", "Présentation du lycée"],
  ["Présentations Clubs", "Présentation des clubs"],
  ["Vie du Lycée", "Vie du lycée"],
]);

function assertDraft(value: LegacyEditorialDraft): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Brouillon éditorial invalide.");
  }
  const keys = Object.keys(value).sort();
  const expected = ["bodyMarkdown", "summary", "title"];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error("Champs éditoriaux inattendus.");
  }
  for (const field of expected as Array<keyof LegacyEditorialDraft>) {
    if (typeof value[field] !== "string" || value[field].length > MAXIMUM_LENGTHS[field]) {
      throw new Error("Valeur éditoriale hors limites.");
    }
  }
  if (!value.title.trim()) throw new Error("Titre éditorial manquant.");
}

function replacePattern(
  source: string,
  pattern: RegExp,
  replacement: Replacement
): { value: string; occurrences: number } {
  let occurrences = 0;
  const value = source.replace(pattern, (match, ...captures: unknown[]) => {
    occurrences += 1;
    return typeof replacement === "string" ? replacement : replacement(match, ...captures);
  });
  return { value, occurrences };
}

function applyRule(
  draft: LegacyEditorialDraft,
  corrections: LegacyEditorialCorrection[],
  field: keyof LegacyEditorialDraft,
  code: string,
  pattern: RegExp,
  replacement: Replacement
): void {
  const result = replacePattern(draft[field], pattern, replacement);
  if (!result.occurrences) return;
  draft[field] = result.value;
  corrections.push({ code, field, occurrences: result.occurrences });
}

function externalLinkLabel(match: string, marker: unknown, url: unknown): string {
  if (typeof marker !== "string" || typeof url !== "string") return match;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname) return match;
    return `${marker} [Consulter cette information sur ${parsed.hostname}](${url})`;
  } catch {
    return match;
  }
}

export function applyLegacyPreviewEditorialCorrections(
  input: LegacyEditorialDraft
): LegacyEditorialCorrectionResult {
  assertDraft(input);
  const draft = { ...input };
  const corrections: LegacyEditorialCorrection[] = [];

  for (const [current, replacement] of TITLE_REPLACEMENTS) {
    if (draft.title === current || draft.title.startsWith(`${current} `)) {
      draft.title = draft.title.replace(current, replacement);
      corrections.push({ code: "language.title_wording", field: "title", occurrences: 1 });
      break;
    }
  }

  for (const field of ["title", "summary", "bodyMarkdown"] as const) {
    applyRule(
      draft,
      corrections,
      field,
      "language.ordinal_typography",
      /\b2(?:ème|eme)\b/giu,
      "2e"
    );
    applyRule(
      draft,
      corrections,
      field,
      "language.baccalaureat_agreement",
      /\bBaccalauréat Générale\b/gu,
      "Baccalauréat général"
    );
    applyRule(
      draft,
      corrections,
      field,
      "language.heading_capitalization",
      /\bAccès Rapides\b/gu,
      "Accès rapides"
    );
  }

  applyRule(
    draft,
    corrections,
    "bodyMarkdown",
    "conversion.empty_heading",
    /^#{1,6}[ \t]*(?:\r?\n|$)/gmu,
    ""
  );
  applyRule(
    draft,
    corrections,
    "bodyMarkdown",
    "conversion.concatenated_call_to_action",
    /\[En savoir plus\s+([^\]]*?)Continuer\]\(([^)\s]+)\)/giu,
    (match, label, destination) => {
      if (typeof label !== "string" || typeof destination !== "string") return match;
      return `[En savoir plus : ${label.trim()}](${destination})`;
    }
  );
  applyRule(
    draft,
    corrections,
    "bodyMarkdown",
    "conversion.raw_url_heading",
    /^(#{1,6})\s+\[(https:\/\/[^\]\s]+)\]\(\2\)[ \t]*$/gmu,
    externalLinkLabel
  );
  applyRule(
    draft,
    corrections,
    "bodyMarkdown",
    "accessibility.map_link_label",
    /\[(?:Voir plus|Cliquez ici)\]\((https:\/\/maps\.app\.goo\.gl\/[^)\s]+)\)/giu,
    (match, destination) => typeof destination === "string"
      ? `[Ouvrir l’itinéraire](${destination})`
      : match
  );
  applyRule(
    draft,
    corrections,
    "bodyMarkdown",
    "links.remove_localhost_media",
    /!\[[^\]]*\]\(http:\/\/localhost\/wordpress\/wp-content\/uploads\/[^)\s]+\)[ \t]*(?:\r?\n)?/giu,
    "<!-- Image historique à remplacer avant publication. -->\n"
  );

  corrections.sort((left, right) =>
    left.code.localeCompare(right.code, "fr") || left.field.localeCompare(right.field, "fr")
  );
  return { draft, corrections };
}
