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
};

const FIELDS = new Set(["sourceType", "title", "summary", "bodyMarkdown", "category", "templateKey"]);

function boundedText(value: unknown, field: string, minimum: number, maximum: number): string {
  if (typeof value !== "string") throw new Error(`${field}_invalid`);
  const cleaned = value.trim().replace(/\r\n?/g, "\n");
  if (cleaned.length < minimum || cleaned.length > maximum) {
    throw new Error(`${field}_invalid`);
  }
  return cleaned;
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
  };
  if (!/^[a-z][a-z0-9_-]{1,39}$/.test(parsed.category)) throw new Error("category_invalid");
  if (parsed.templateKey && !COMMUNICATION_TEMPLATE_KEYS.includes(parsed.templateKey)) {
    throw new Error("template_key_invalid");
  }

  const combined = `${parsed.title}\n${parsed.summary}\n${parsed.bodyMarkdown}`;
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
  }, "source");
}

export function communicationDraftContentHash(input: CommunicationDraftInput): string {
  return hashCommunicationDraft(input, "version");
}
