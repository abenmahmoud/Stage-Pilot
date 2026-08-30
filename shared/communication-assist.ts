import {
  parseCommunicationDraftInput,
  parseCommunicationOpenQuestions,
  parseCommunicationStructuredFacts,
  type CommunicationStructuredFacts,
} from "./communication-draft.js";
import type { CommunicationTemplateKey } from "./communication-templates.js";

export const COMMUNICATION_ASSIST_ACTIONS = ["structure", "correct", "simplify"] as const;
export type CommunicationAssistAction = (typeof COMMUNICATION_ASSIST_ACTIONS)[number];

export type CommunicationAssistInput = {
  action: CommunicationAssistAction;
  title: string;
  summary: string;
  bodyMarkdown: string;
  category: string;
  templateKey: CommunicationTemplateKey | null;
};

export type CommunicationAssistOutput = {
  title: string;
  summary: string;
  bodyMarkdown: string;
  structuredFacts: CommunicationStructuredFacts;
  openQuestions: string[];
  reviewNotes: string[];
};

const INPUT_FIELDS = new Set(["action", "title", "summary", "bodyMarkdown", "category", "templateKey"]);
const OUTPUT_FIELDS = new Set([
  "title",
  "summary",
  "bodyMarkdown",
  "structuredFacts",
  "openQuestions",
  "reviewNotes",
]);
const INSTRUCTION_SIGNAL = /\b(?:ignore|oublie|contourne|remplace)\s+(?:toutes?\s+)?(?:les?\s+)?(?:instructions?|r[eè]gles?|consignes?)\b|\b(?:system prompt|prompt syst[eè]me|message d[eé]veloppeur|developer message)\b|\b(?:tu es maintenant|you are now|agis comme)\s+(?:un |une )?(?:administrateur|syst[eè]me|agent sans limite)\b/iu;

function boundedList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length > 8) throw new Error(`${field}_invalid`);
  return value.map((item) => {
    if (typeof item !== "string") throw new Error(`${field}_invalid`);
    const clean = item.trim().replace(/\r\n?/g, "\n");
    if (!clean || clean.length > 300) throw new Error(`${field}_invalid`);
    return clean;
  });
}

export function parseCommunicationAssistInput(value: unknown): CommunicationAssistInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("input_invalid");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !INPUT_FIELDS.has(key))) throw new Error("unknown_field");
  if (!COMMUNICATION_ASSIST_ACTIONS.includes(input.action as CommunicationAssistAction)) {
    throw new Error("action_invalid");
  }
  const draft = parseCommunicationDraftInput({
    sourceType: "direct_text",
    title: input.title,
    summary: input.summary,
    bodyMarkdown: input.bodyMarkdown,
    category: input.category,
    templateKey: input.templateKey,
  });
  if (INSTRUCTION_SIGNAL.test(`${draft.title}\n${draft.summary}\n${draft.bodyMarkdown}`)) {
    throw new Error("instruction_signal");
  }
  return {
    action: input.action as CommunicationAssistAction,
    title: draft.title,
    summary: draft.summary,
    bodyMarkdown: draft.bodyMarkdown,
    category: draft.category,
    templateKey: draft.templateKey,
  };
}

export function parseCommunicationAssistOutput(
  value: unknown,
  input: CommunicationAssistInput
): CommunicationAssistOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("output_invalid");
  const output = value as Record<string, unknown>;
  if (Object.keys(output).some((key) => !OUTPUT_FIELDS.has(key))) throw new Error("output_unknown_field");
  const draft = parseCommunicationDraftInput({
    sourceType: "direct_text",
    title: output.title,
    summary: output.summary,
    bodyMarkdown: output.bodyMarkdown,
    category: input.category,
    templateKey: input.templateKey,
    structuredFacts: output.structuredFacts,
    openQuestions: output.openQuestions,
  });
  return {
    title: draft.title,
    summary: draft.summary,
    bodyMarkdown: draft.bodyMarkdown,
    structuredFacts: parseCommunicationStructuredFacts(output.structuredFacts),
    openQuestions: parseCommunicationOpenQuestions(output.openQuestions),
    reviewNotes: boundedList(output.reviewNotes, "review_notes"),
  };
}
