export type CommunicationEmailPreview = {
  senderName: "Lycée Blaise Cendrars";
  recipientState: "not_selected";
  subject: string;
  preheader: string;
  bodyMarkdown: string;
  canonicalLinkState: "pending_publication";
  canSend: false;
};

const FIELDS = new Set(["title", "summary", "bodyMarkdown"]);

function boundedText(value: unknown, field: string, maximum: number): string {
  if (typeof value !== "string") throw new Error(`${field}_invalid`);
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (normalized.length > maximum) throw new Error(`${field}_invalid`);
  return normalized;
}

function plainPreview(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<https?:\/\/[^>]+>/gi, "")
    .replace(/[`*_>#~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function safeCommunicationPreviewHref(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 1 || value.length > 2048) return null;
  if (value !== value.trim() || /[\u0000-\u001f\\]/.test(value)) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function buildCommunicationEmailPreview(value: unknown): CommunicationEmailPreview {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("input_invalid");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !FIELDS.has(key))) throw new Error("unknown_field");

  const title = boundedText(input.title ?? "", "title", 180);
  const summary = boundedText(input.summary ?? "", "summary", 1000);
  const bodyMarkdown = boundedText(input.bodyMarkdown ?? "", "body", 100000);
  const preheaderSource = plainPreview(summary || bodyMarkdown);

  return {
    senderName: "Lycée Blaise Cendrars",
    recipientState: "not_selected",
    subject: title || "Titre du message",
    preheader: preheaderSource.slice(0, 160) || "Communication de l’établissement",
    bodyMarkdown: bodyMarkdown || "Le contenu du message apparaîtra ici.",
    canonicalLinkState: "pending_publication",
    canSend: false,
  };
}
