import type { SupportReplyTemplate } from "./support-reply-templates.js";

const TEMPLATE_FIELDS = new Set(["id", "category", "name", "bodyText", "allowedVariables", "builtIn"]);
const LIST_FIELDS = new Set(["templates"]);
const CREATE_FIELDS = new Set(["template"]);
const ALLOWED_VARIABLES = new Set(["prenom", "numero", "objet"]);
export const SUPPORT_TEMPLATE_LIST_LIMIT = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactFields(value: Record<string, unknown>, fields: Set<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === fields.size && keys.every((key) => fields.has(key));
}

export function isSupportReplyTemplatePayload(value: unknown): value is SupportReplyTemplate {
  if (!isRecord(value)
    || !hasExactFields(value, TEMPLATE_FIELDS)
    || typeof value.id !== "string" || value.id.length < 1 || value.id.length > 200
    || typeof value.category !== "string" || value.category.length < 1 || value.category.length > 60
    || typeof value.name !== "string" || value.name.length < 1 || value.name.length > 80
    || typeof value.bodyText !== "string" || value.bodyText.length < 1 || value.bodyText.length > 5_000
    || !Array.isArray(value.allowedVariables)
    || value.allowedVariables.length > ALLOWED_VARIABLES.size
    || value.allowedVariables.some((item) => typeof item !== "string" || !ALLOWED_VARIABLES.has(item))
    || new Set(value.allowedVariables).size !== value.allowedVariables.length
    || typeof value.builtIn !== "boolean") {
    return false;
  }
  return true;
}

export function projectSupportReplyTemplatePayload(
  value: unknown,
  builtIn: boolean
): SupportReplyTemplate | null {
  if (!isRecord(value)) return null;
  const projected = {
    id: value.id,
    category: value.category,
    name: value.name,
    bodyText: value.bodyText,
    allowedVariables: value.allowedVariables,
    builtIn,
  };
  return isSupportReplyTemplatePayload(projected) ? projected : null;
}

export function isSupportTemplateListPayload(value: unknown): value is { templates: SupportReplyTemplate[] } {
  return isRecord(value)
    && hasExactFields(value, LIST_FIELDS)
    && Array.isArray(value.templates)
    && value.templates.length <= SUPPORT_TEMPLATE_LIST_LIMIT
    && value.templates.every(isSupportReplyTemplatePayload)
    && new Set(value.templates.map((template) => template.id)).size === value.templates.length;
}

export function isSupportTemplateCreatePayload(value: unknown): value is { template: SupportReplyTemplate } {
  return isRecord(value)
    && hasExactFields(value, CREATE_FIELDS)
    && isSupportReplyTemplatePayload(value.template);
}
