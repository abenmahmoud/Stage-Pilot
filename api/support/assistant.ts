import { createHash } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { HttpError } from "../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import {
  analyzeSupportConversation,
  type SupportAgentMessage,
  type SupportAttachmentHint,
} from "../_shared/support-agent.js";

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 20;
const requestWindows = new Map<string, { count: number; resetAt: number }>();

function cleanMessages(value: unknown): SupportAgentMessage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 10) {
    throw new HttpError(400, "La conversation est invalide");
  }
  let totalLength = 0;
  const messages = value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new HttpError(400, "La conversation est invalide");
    const record = item as Record<string, unknown>;
    if (record.role !== "assistant" && record.role !== "requester") throw new HttpError(400, "La conversation est invalide");
    const role: SupportAgentMessage["role"] = record.role;
    if (typeof record.content !== "string") throw new HttpError(400, "Le message est invalide");
    const content = record.content.replace(/[\u0000-\u001F]/g, " ").trim();
    if (!content || content.length > 1500) throw new HttpError(400, "Le message est trop long");
    totalLength += content.length;
    return { role, content };
  });
  if (totalLength > 8000) throw new HttpError(400, "La conversation est trop longue");
  return messages;
}

function cleanAttachments(value: unknown): SupportAttachmentHint[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 5) throw new HttpError(400, "Les pièces jointes sont invalides");
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new HttpError(400, "Une pièce jointe est invalide");
    const record = item as Record<string, unknown>;
    if (typeof record.name !== "string" || typeof record.type !== "string" || typeof record.size !== "number") {
      throw new HttpError(400, "Une pièce jointe est invalide");
    }
    return {
      name: record.name.slice(0, 160),
      type: record.type.slice(0, 100),
      size: Math.max(0, Math.min(record.size, 10 * 1024 * 1024)),
    };
  });
}

function clientKey(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0])?.trim() || "unknown";
  const salt = process.env.SUPPORT_HASH_SECRET || process.env.OPENAI_API_KEY || "lycee-preview";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

function enforceRateLimit(key: string) {
  const now = Date.now();
  const current = requestWindows.get(key);
  if (!current || current.resetAt <= now) {
    requestWindows.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return;
  }
  if (current.count >= RATE_LIMIT) throw new HttpError(429, "Trop de messages envoyés. Réessayez dans quelques minutes.");
  current.count += 1;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) throw new HttpError(400, "La demande est invalide");
    const input = req.body as Record<string, unknown>;
    const key = clientKey(req);
    enforceRateLimit(key);
    return analyzeSupportConversation({
      messages: cleanMessages(input.messages),
      attachments: cleanAttachments(input.attachments),
      safetyIdentifier: key,
    });
  });
}
