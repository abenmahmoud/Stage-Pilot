import { detectForbiddenSupportSecret } from "./support-secret-policy.js";
export const WEEKLY_BRIEF_IMPORTANCE_LEVELS = ["normale", "importante", "urgente"] as const;
export const WEEKLY_BRIEF_CHANNELS = ["push", "email", "sms"] as const;
export const WEEKLY_BRIEF_CATEGORIES = ["Rentrée", "Vie du lycée", "Événement", "Orientation"] as const;
export const WEEKLY_BRIEF_AUDIENCES = ["tous", "eleves", "parents"] as const;

export type WeeklyBriefImportance = (typeof WEEKLY_BRIEF_IMPORTANCE_LEVELS)[number];
export type WeeklyBriefChannel = (typeof WEEKLY_BRIEF_CHANNELS)[number];
export type WeeklyBriefCategory = (typeof WEEKLY_BRIEF_CATEGORIES)[number];
export type WeeklyBriefAudience = (typeof WEEKLY_BRIEF_AUDIENCES)[number];

export type WeeklyBriefCard = {
  key: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  category: WeeklyBriefCategory;
  audience: WeeklyBriefAudience;
  importance: WeeklyBriefImportance;
  channels: WeeklyBriefChannel[];
  eventDate: string;
  expiresAt: string;
  featured: boolean;
  sourceExcerpt: string;
  openQuestions: string[];
};

export type WeeklyBriefSuggestion = {
  issueTitle: string;
  issueSummary: string;
  weekStart: string;
  weekEnd: string;
  cards: WeeklyBriefCard[];
  reviewNotes: string[];
};

export type WeeklyBriefSanitization = {
  text: string;
  sourceLineCount: number;
  retainedLineCount: number;
  excludedLineCount: number;
  maskedValueCount: number;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const EMAIL_PATTERN = /\b[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+\b/giu;
const PHONE_PATTERN = /(?<!\d)(?:(?:\+|00)33[\s.-]?(?:\(0\)[\s.-]?)?|0)[1-9](?:[\s.-]?\d{2}){4}(?!\d)/gu;
const HONORIFIC_NAME_PATTERN = /\b(?:M(?:me|lle)?\.?|Monsieur|Madame)\s+[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’ -]{1,80}/gu;
const INSTRUCTION_PATTERN = /\b(?:ignore|oublie|contourne|remplace)\s+(?:toutes?\s+)?(?:les?\s+)?(?:instructions?|r[eè]gles?|consignes?)\b|\b(?:system prompt|prompt syst[eè]me|message d[eé]veloppeur|developer message)\b/iu;
const INTERNAL_LINE_PATTERNS = [
  /\babsence\b/iu,
  /\b(?:r[eé]union|concertation|[eé]changes?)\b.*\b(?:direction|personnels?|intercat[eé]gorielle|financements?)\b/iu,
  /\b[eé]tats?\s+de\s+services?\b/iu,
  /\bsecr[eé]tariat\s+de\s+direction\b/iu,
  /\bcandidatures?\b.*\brepr[eé]sentants?\s+des\s+personnels?\b/iu,
  /\bsalle\s+des\s+archives\b/iu,
  /\bexercice\b.*\b(?:[eé]vacuation|incendie|intrusion)\b/iu,
];

const INPUT_FIELDS = new Set(["sourceName", "extractedText"]);
const ROOT_FIELDS = new Set(["issueTitle", "issueSummary", "weekStart", "weekEnd", "cards", "reviewNotes"]);
const CARD_FIELDS = new Set([
  "key", "title", "summary", "bodyMarkdown", "category", "audience", "importance",
  "channels", "eventDate", "expiresAt", "featured", "sourceExcerpt", "openQuestions",
]);

function exactRecord(value: unknown, fields: Set<string>, reason: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(reason);
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== fields.size || keys.some((key) => !fields.has(key))) throw new Error(reason);
  return record;
}

function text(value: unknown, reason: string, minimum: number, maximum: number): string {
  if (typeof value !== "string") throw new Error(reason);
  const clean = value.trim().replace(/\r\n?/g, "\n");
  if (clean.length < minimum || clean.length > maximum || CONTROL_PATTERN.test(clean)) throw new Error(reason);
  if (detectForbiddenSupportSecret(clean)) throw new Error("secret_forbidden");
  return clean;
}

function stringList(value: unknown, reason: string, maximumItems: number, maximumLength: number): string[] {
  if (!Array.isArray(value) || value.length > maximumItems) throw new Error(reason);
  return value.map((entry) => text(entry, reason, 1, maximumLength));
}

function enumValue<T extends readonly string[]>(value: unknown, allowed: T, reason: string): T[number] {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) throw new Error(reason);
  return value as T[number];
}

function isoDate(value: unknown, reason: string): string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(reason);
  }
  return value;
}

function isoTimestamp(value: unknown, reason: string): string {
  if (typeof value !== "string" || value.length > 40 || !Number.isFinite(Date.parse(value))) throw new Error(reason);
  return new Date(value).toISOString();
}

function validChannels(value: unknown, importance: WeeklyBriefImportance): WeeklyBriefChannel[] {
  if (!Array.isArray(value) || value.length > 3) throw new Error("channels_invalid");
  const channels = value.map((entry) => enumValue(entry, WEEKLY_BRIEF_CHANNELS, "channels_invalid"));
  if (new Set(channels).size !== channels.length) throw new Error("channels_invalid");
  if (importance === "normale" && channels.length !== 0) throw new Error("channels_invalid");
  if (importance === "importante" && (!channels.includes("push") || channels.includes("sms"))) {
    throw new Error("channels_invalid");
  }
  if (importance === "urgente" && (!channels.includes("push") || !channels.includes("email"))) {
    throw new Error("channels_invalid");
  }
  return channels;
}

function redactLine(line: string): { line: string; masked: number } {
  let masked = 0;
  const replace = (pattern: RegExp, label: string) => {
    line = line.replace(pattern, () => {
      masked += 1;
      return label;
    });
  };
  replace(EMAIL_PATTERN, "[EMAIL MASQUÉ]");
  replace(PHONE_PATTERN, "[TÉLÉPHONE MASQUÉ]");
  replace(HONORIFIC_NAME_PATTERN, "[NOM MASQUÉ]");
  line = line.replace(/\b(mot de passe|mdp|password|code secret)\s*[:=]\s*\S+/giu, (_match, label: string) => {
    masked += 1;
    return `${label}: [SECRET MASQUÉ]`;
  });
  return { line, masked };
}

export function sanitizeWeeklySourceText(value: string): WeeklyBriefSanitization {
  if (typeof value !== "string" || value.length < 1 || value.length > 100_000) throw new Error("source_text_invalid");
  const lines = value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const retained: string[] = [];
  let excludedLineCount = 0;
  let maskedValueCount = 0;
  for (const rawLine of lines) {
    if (INSTRUCTION_PATTERN.test(rawLine) || INTERNAL_LINE_PATTERNS.some((pattern) => pattern.test(rawLine))) {
      excludedLineCount += 1;
      continue;
    }
    const redacted = redactLine(rawLine);
    maskedValueCount += redacted.masked;
    retained.push(redacted.line);
  }
  const clean = retained.join("\n").slice(0, 24_000).trim();
  if (clean.length < 40) throw new Error("source_public_text_missing");
  if (detectForbiddenSupportSecret(clean)) throw new Error("secret_forbidden");
  return {
    text: clean,
    sourceLineCount: lines.length,
    retainedLineCount: retained.length,
    excludedLineCount,
    maskedValueCount,
  };
}

export function parseWeeklyBriefAssistInput(value: unknown): {
  sourceName: string;
  source: WeeklyBriefSanitization;
} {
  const input = exactRecord(value, INPUT_FIELDS, "input_invalid");
  const sourceName = text(input.sourceName, "source_name_invalid", 1, 180);
  if (!/\.pdf$/iu.test(sourceName) || /[\\/]/.test(sourceName)) throw new Error("source_name_invalid");
  if (typeof input.extractedText !== "string"
    || input.extractedText.length < 1
    || input.extractedText.length > 100_000
    || CONTROL_PATTERN.test(input.extractedText)) {
    throw new Error("source_text_invalid");
  }
  const extractedText = input.extractedText;
  return { sourceName, source: sanitizeWeeklySourceText(extractedText) };
}

function parseCard(value: unknown): WeeklyBriefCard {
  const card = exactRecord(value, CARD_FIELDS, "card_invalid");
  const key = text(card.key, "card_key_invalid", 2, 80);
  if (!KEY_PATTERN.test(key)) throw new Error("card_key_invalid");
  const importance = enumValue(card.importance, WEEKLY_BRIEF_IMPORTANCE_LEVELS, "importance_invalid");
  const eventDate = isoDate(card.eventDate, "event_date_invalid");
  const expiresAt = isoTimestamp(card.expiresAt, "expires_at_invalid");
  if (Date.parse(expiresAt) <= Date.parse(`${eventDate}T00:00:00Z`)) throw new Error("expires_at_invalid");
  return {
    key,
    title: text(card.title, "title_invalid", 2, 180),
    summary: text(card.summary, "summary_invalid", 1, 600),
    bodyMarkdown: text(card.bodyMarkdown, "body_invalid", 1, 8_000),
    category: enumValue(card.category, WEEKLY_BRIEF_CATEGORIES, "category_invalid"),
    audience: enumValue(card.audience, WEEKLY_BRIEF_AUDIENCES, "audience_invalid"),
    importance,
    channels: validChannels(card.channels, importance),
    eventDate,
    expiresAt,
    featured: card.featured === true,
    sourceExcerpt: text(card.sourceExcerpt, "source_excerpt_invalid", 1, 300),
    openQuestions: stringList(card.openQuestions, "open_questions_invalid", 4, 300),
  };
}

export function parseWeeklyBriefSuggestion(value: unknown): WeeklyBriefSuggestion {
  const root = exactRecord(value, ROOT_FIELDS, "output_invalid");
  if (!Array.isArray(root.cards) || root.cards.length < 1 || root.cards.length > 8) throw new Error("cards_invalid");
  const cards = root.cards.map(parseCard);
  if (new Set(cards.map((card) => card.key)).size !== cards.length) throw new Error("card_key_duplicate");
  if (cards.filter((card) => card.featured).length > 3) throw new Error("featured_limit");
  const weekStart = isoDate(root.weekStart, "week_start_invalid");
  const weekEnd = isoDate(root.weekEnd, "week_end_invalid");
  if (Date.parse(`${weekEnd}T00:00:00Z`) < Date.parse(`${weekStart}T00:00:00Z`)) throw new Error("week_range_invalid");
  return {
    issueTitle: text(root.issueTitle, "issue_title_invalid", 2, 180),
    issueSummary: text(root.issueSummary, "issue_summary_invalid", 1, 600),
    weekStart,
    weekEnd,
    cards,
    reviewNotes: stringList(root.reviewNotes, "review_notes_invalid", 8, 300),
  };
}

export function parseWeeklyBriefAssistPayload(value: unknown): {
  suggestion: WeeklyBriefSuggestion;
  sanitization: Omit<WeeklyBriefSanitization, "text">;
} | null {
  try {
    const root = exactRecord(value, new Set(["suggestion", "sanitization"]), "payload_invalid");
    const sanitization = exactRecord(
      root.sanitization,
      new Set(["sourceLineCount", "retainedLineCount", "excludedLineCount", "maskedValueCount"]),
      "sanitization_invalid"
    );
    for (const key of ["sourceLineCount", "retainedLineCount", "excludedLineCount", "maskedValueCount"] as const) {
      if (!Number.isSafeInteger(sanitization[key]) || Number(sanitization[key]) < 0) throw new Error("sanitization_invalid");
    }
    return {
      suggestion: parseWeeklyBriefSuggestion(root.suggestion),
      sanitization: {
        sourceLineCount: Number(sanitization.sourceLineCount),
        retainedLineCount: Number(sanitization.retainedLineCount),
        excludedLineCount: Number(sanitization.excludedLineCount),
        maskedValueCount: Number(sanitization.maskedValueCount),
      },
    };
  } catch {
    return null;
  }
}

export function weeklyAudienceGroupRef(audience: WeeklyBriefAudience): string {
  const groups: Record<WeeklyBriefAudience, string> = {
    tous: "etablissement:tous",
    eleves: "public:eleves",
    parents: "public:parents",
  };
  return groups[audience];
}
