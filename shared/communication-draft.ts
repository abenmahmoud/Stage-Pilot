import { createHash } from "node:crypto";
import { detectForbiddenSupportSecret } from "./support-secret-policy.js";
import {
  COMMUNICATION_TEMPLATE_KEYS,
  type CommunicationTemplateKey,
} from "./communication-templates.js";

export type CommunicationDraftInput = {
  sourceType: "direct_text";
  title: string;
  summary: string;
  bodyMarkdown: string;
  category: string;
  templateKey: CommunicationTemplateKey | null;
  structuredFacts: CommunicationStructuredFacts;
  openQuestions: string[];
};

export type CommunicationStructuredFacts = {
  dates: string[];
  times: string[];
  places: string[];
  documents: string[];
  actions: string[];
};

const FIELDS = new Set([
  "sourceType",
  "title",
  "summary",
  "bodyMarkdown",
  "category",
  "templateKey",
  "structuredFacts",
  "openQuestions",
]);
const STRUCTURED_FACT_FIELDS = new Set(["dates", "times", "places", "documents", "actions"]);

function boundedText(value: unknown, field: string, minimum: number, maximum: number): string {
  if (typeof value !== "string") throw new Error(`${field}_invalid`);
  const cleaned = value.trim().replace(/\r\n?/g, "\n");
  if (cleaned.length < minimum || cleaned.length > maximum) {
    throw new Error(`${field}_invalid`);
  }
  return cleaned;
}

function boundedList(value: unknown, field: string, maximumItems: number, maximumLength: number): string[] {
  if (!Array.isArray(value) || value.length > maximumItems) throw new Error(`${field}_invalid`);
  return value.map((item) => boundedText(item, field, 1, maximumLength));
}

export function parseCommunicationStructuredFacts(value: unknown): CommunicationStructuredFacts {
  if (value == null) {
    return { dates: [], times: [], places: [], documents: [], actions: [] };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("structured_facts_invalid");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !STRUCTURED_FACT_FIELDS.has(key))) {
    throw new Error("structured_facts_invalid");
  }
  return {
    dates: boundedList(input.dates ?? [], "dates", 12, 160),
    times: boundedList(input.times ?? [], "times", 12, 120),
    places: boundedList(input.places ?? [], "places", 12, 180),
    documents: boundedList(input.documents ?? [], "documents", 12, 180),
    actions: boundedList(input.actions ?? [], "actions", 12, 240),
  };
}

export function parseCommunicationOpenQuestions(value: unknown): string[] {
  return boundedList(value ?? [], "open_questions", 12, 300);
}

export function parseCommunicationDraftInput(value: unknown): CommunicationDraftInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("input_invalid");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !FIELDS.has(key))) throw new Error("unknown_field");
  if (input.sourceType !== "direct_text") throw new Error("source_type_invalid");

  const parsed: CommunicationDraftInput = {
    sourceType: "direct_text",
    title: boundedText(input.title, "title", 2, 180),
    summary: boundedText(input.summary ?? "", "summary", 0, 1000),
    bodyMarkdown: boundedText(input.bodyMarkdown, "body", 1, 100000),
    category: boundedText(input.category ?? "information", "category", 2, 40),
    templateKey: input.templateKey == null
      ? null
      : input.templateKey as CommunicationTemplateKey,
    structuredFacts: parseCommunicationStructuredFacts(input.structuredFacts),
    openQuestions: parseCommunicationOpenQuestions(input.openQuestions),
  };
  if (!/^[a-z][a-z0-9_-]{1,39}$/.test(parsed.category)) throw new Error("category_invalid");
  if (parsed.templateKey && !COMMUNICATION_TEMPLATE_KEYS.includes(parsed.templateKey)) {
    throw new Error("template_key_invalid");
  }

  const combined = `${parsed.title}\n${parsed.summary}\n${parsed.bodyMarkdown}\n${JSON.stringify(parsed.structuredFacts)}\n${parsed.openQuestions.join("\n")}`;
  if (detectForbiddenSupportSecret(combined)) throw new Error("secret_forbidden");
  return parsed;
}

function hashCommunicationDraft(input: CommunicationDraftInput, purpose: string): string {
  const canonical = JSON.stringify({ purpose, ...input });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function communicationDraftSourceFingerprint(input: CommunicationDraftInput): string {
  return hashCommunicationDraft({
    sourceType: input.sourceType,
    title: input.title,
    summary: input.summary,
    bodyMarkdown: input.bodyMarkdown,
    category: "source",
    templateKey: null,
    structuredFacts: { dates: [], times: [], places: [], documents: [], actions: [] },
    openQuestions: [],
  }, "source");
}

export function communicationDraftContentHash(input: CommunicationDraftInput): string {
  return hashCommunicationDraft(input, "version");
}
