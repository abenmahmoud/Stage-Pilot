export type SupportAssistantInputMessage = {
  role: "assistant" | "requester";
  content: string;
};

export type SupportAssistantInputAttachment = {
  name: string;
  type: string;
  size: number;
};

export type SupportAssistantInput = {
  sessionId: string;
  messages: SupportAssistantInputMessage[];
  attachments: SupportAssistantInputAttachment[];
};

export const SUPPORT_ASSISTANT_INPUT_LIMITS = Object.freeze({
  messages: 21,
  requesterTurns: 10,
  message: 1_500,
  conversation: 12_000,
  attachments: 5,
  attachmentName: 160,
  attachmentType: 100,
  attachmentBytes: 10 * 1024 * 1024,
});

const SESSION_PATTERN = /^[a-zA-Z0-9-]{16,80}$/;
const ROOT_FIELDS = new Set(["sessionId", "messages", "attachments"]);
const MESSAGE_FIELDS = new Set(["role", "content"]);
const ATTACHMENT_FIELDS = new Set(["name", "type", "size"]);
const SAFE_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const UNSAFE_CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const FILENAME_CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKnownKeys(
  value: Record<string, unknown>,
  allowed: Set<string>,
  requiredCount: number
): boolean {
  const keys = Object.keys(value);
  return keys.length === requiredCount && keys.every((key) => allowed.has(key));
}

function parseMessages(value: unknown): SupportAssistantInputMessage[] | null {
  if (!Array.isArray(value)
    || value.length === 0
    || value.length > SUPPORT_ASSISTANT_INPUT_LIMITS.messages) {
    return null;
  }
  let totalLength = 0;
  let requesterTurns = 0;
  const parsed: SupportAssistantInputMessage[] = [];
  for (const item of value) {
    if (!isRecord(item)
      || !hasOnlyKnownKeys(item, MESSAGE_FIELDS, MESSAGE_FIELDS.size)
      || (item.role !== "assistant" && item.role !== "requester")
      || typeof item.content !== "string"
      || item.content.length > SUPPORT_ASSISTANT_INPUT_LIMITS.message) {
      return null;
    }
    const content = item.content.replace(UNSAFE_CONTROL_CHARACTERS, " ").trim();
    if (!content) return null;
    if (parsed.at(-1)?.role === item.role) return null;
    if (item.role === "requester") requesterTurns += 1;
    totalLength += content.length;
    parsed.push({ role: item.role, content });
  }
  if (parsed.at(-1)?.role !== "requester"
    || requesterTurns < 1
    || requesterTurns > SUPPORT_ASSISTANT_INPUT_LIMITS.requesterTurns
    || totalLength > SUPPORT_ASSISTANT_INPUT_LIMITS.conversation) {
    return null;
  }
  return parsed;
}

function parseAttachments(value: unknown): SupportAssistantInputAttachment[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > SUPPORT_ASSISTANT_INPUT_LIMITS.attachments) return null;
  const parsed: SupportAssistantInputAttachment[] = [];
  for (const item of value) {
    if (!isRecord(item)
      || !hasOnlyKnownKeys(item, ATTACHMENT_FIELDS, ATTACHMENT_FIELDS.size)
      || typeof item.name !== "string"
      || item.name.length > SUPPORT_ASSISTANT_INPUT_LIMITS.attachmentName
      || typeof item.type !== "string"
      || item.type.length > SUPPORT_ASSISTANT_INPUT_LIMITS.attachmentType
      || !SAFE_ATTACHMENT_MIME_TYPES.has(item.type)
      || !Number.isSafeInteger(item.size)
      || Number(item.size) < 1
      || Number(item.size) > SUPPORT_ASSISTANT_INPUT_LIMITS.attachmentBytes) {
      return null;
    }
    const name = item.name.replace(FILENAME_CONTROL_CHARACTERS, " ").trim();
    if (!name) return null;
    parsed.push({ name, type: item.type, size: Number(item.size) });
  }
  return parsed;
}

export function parseSupportAssistantInput(value: unknown): SupportAssistantInput | null {
  if (!isRecord(value)) return null;
  const expectedFieldCount = value.attachments === undefined ? 2 : ROOT_FIELDS.size;
  if (!hasOnlyKnownKeys(value, ROOT_FIELDS, expectedFieldCount)
    || typeof value.sessionId !== "string"
    || !SESSION_PATTERN.test(value.sessionId)) {
    return null;
  }
  const messages = parseMessages(value.messages);
  const attachments = parseAttachments(value.attachments);
  if (!messages || !attachments) return null;
  return { sessionId: value.sessionId, messages, attachments };
}
