import { detectForbiddenSupportSecret } from "./support-secret-policy.js";

export const COMMUNICATION_TEMPLATE_KEYS = [
  "hebdo",
  "urgent",
  "rentree",
  "document",
  "evenement",
  "rappel",
] as const;

export type CommunicationTemplateKey = (typeof COMMUNICATION_TEMPLATE_KEYS)[number];

export type CommunicationTemplateInput = {
  templateKey: CommunicationTemplateKey;
  label: string;
  defaultCategory: string;
  titleHint: string;
  summaryHint: string;
  bodyMarkdown: string;
  active: boolean;
};

export const COMMUNICATION_TEMPLATE_CATALOG: readonly CommunicationTemplateInput[] = [
  {
    templateKey: "hebdo",
    label: "Hebdo",
    defaultCategory: "information",
    titleHint: "L’Hebdo du lycée",
    summaryHint: "Les informations essentielles de la semaine.",
    bodyMarkdown: "## À retenir\n\n## Cette semaine\n\n## Documents et échéances",
    active: true,
  },
  {
    templateKey: "urgent",
    label: "Urgent",
    defaultCategory: "urgent",
    titleHint: "Information urgente",
    summaryHint: "La décision, les personnes concernées et l’échéance.",
    bodyMarkdown: "## Information\n\n## Action attendue\n\n## Échéance",
    active: true,
  },
  {
    templateKey: "rentree",
    label: "Rentrée",
    defaultCategory: "rentree",
    titleHint: "Organisation de la rentrée",
    summaryHint: "Dates, horaires et publics concernés.",
    bodyMarkdown: "## Calendrier\n\n## Accueil\n\n## Documents nécessaires",
    active: true,
  },
  {
    templateKey: "document",
    label: "Document",
    defaultCategory: "document",
    titleHint: "Document à consulter",
    summaryHint: "Objet du document et action attendue.",
    bodyMarkdown: "## Objet\n\n## Pour qui ?\n\n## Action attendue",
    active: true,
  },
  {
    templateKey: "evenement",
    label: "Événement",
    defaultCategory: "evenement",
    titleHint: "Événement du lycée",
    summaryHint: "Date, lieu et modalités de participation.",
    bodyMarkdown: "## Date et lieu\n\n## Programme\n\n## Participation",
    active: true,
  },
  {
    templateKey: "rappel",
    label: "Rappel",
    defaultCategory: "rappel",
    titleHint: "Rappel important",
    summaryHint: "Consigne et échéance à retenir.",
    bodyMarkdown: "## Rappel\n\n## Action attendue\n\n## Échéance",
    active: true,
  },
];

const FIELDS = new Set([
  "templateKey",
  "label",
  "defaultCategory",
  "titleHint",
  "summaryHint",
  "bodyMarkdown",
  "active",
]);

function boundedText(value: unknown, field: string, minimum: number, maximum: number): string {
  if (typeof value !== "string") throw new Error(`${field}_invalid`);
  const cleaned = value.trim().replace(/\r\n?/g, "\n");
  if (cleaned.length < minimum || cleaned.length > maximum) throw new Error(`${field}_invalid`);
  return cleaned;
}

export function parseCommunicationTemplateInput(value: unknown): CommunicationTemplateInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("input_invalid");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !FIELDS.has(key))) throw new Error("unknown_field");
  if (!COMMUNICATION_TEMPLATE_KEYS.includes(input.templateKey as CommunicationTemplateKey)) {
    throw new Error("template_key_invalid");
  }
  if (typeof input.active !== "boolean") throw new Error("active_invalid");
  const parsed: CommunicationTemplateInput = {
    templateKey: input.templateKey as CommunicationTemplateKey,
    label: boundedText(input.label, "label", 2, 80),
    defaultCategory: boundedText(input.defaultCategory, "category", 2, 40),
    titleHint: boundedText(input.titleHint ?? "", "title", 0, 180),
    summaryHint: boundedText(input.summaryHint ?? "", "summary", 0, 1000),
    bodyMarkdown: boundedText(input.bodyMarkdown, "body", 1, 20000),
    active: input.active,
  };
  if (!/^[a-z][a-z0-9_-]{1,39}$/.test(parsed.defaultCategory)) {
    throw new Error("category_invalid");
  }
  if (detectForbiddenSupportSecret(Object.values(parsed).join("\n"))) {
    throw new Error("secret_forbidden");
  }
  return parsed;
}

export function mergeCommunicationTemplates(
  overrides: ReadonlyArray<CommunicationTemplateInput & { id: string; version: number; updatedAt: Date | string }>
) {
  const byKey = new Map(overrides.map((item) => [item.templateKey, item]));
  return COMMUNICATION_TEMPLATE_CATALOG.map((fallback) => {
    const override = byKey.get(fallback.templateKey);
    return override
      ? { ...override, customized: true }
      : { ...fallback, id: null, version: 0, updatedAt: null, customized: false };
  });
}
