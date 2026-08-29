import type { VercelRequest, VercelResponse } from "@vercel/node";
import { HttpError } from "../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import {
  assertNoForbiddenSupportSecret,
  enforceSupportRateLimit,
  personalHash,
  requestIpHash,
} from "../_shared/support.js";
import {
  analyzeSupportConversation,
  type SupportAgentMessage,
  type SupportAttachmentHint,
} from "../_shared/support-agent.js";
import { resolveKnowledgeActorFromRequest } from "../_shared/knowledge-actor.js";

const SESSION_WINDOW_SECONDS = 24 * 60 * 60;
const NETWORK_WINDOW_SECONDS = 60 * 60;
const SESSION_RATE_LIMIT = 24;
const NETWORK_RATE_LIMIT = 800;

function cleanMessages(value: unknown): SupportAgentMessage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 21) {
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
    assertNoForbiddenSupportSecret(content);
    totalLength += content.length;
    return { role, content };
  });
  if (totalLength > 12000) throw new HttpError(400, "La conversation est trop longue");
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
    const name = record.name.slice(0, 160);
    assertNoForbiddenSupportSecret(name);
    return {
      name,
      type: record.type.slice(0, 100),
      size: Math.max(0, Math.min(record.size, 10 * 1024 * 1024)),
    };
  });
}

function clientKeys(req: VercelRequest, sessionId: string): { session: string; network: string } {
  const network = requestIpHash(req) ?? personalHash("network:unknown");
  return {
    session: personalHash(`assistant:${network}:${sessionId}`),
    network,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) throw new HttpError(400, "La demande est invalide");
    const input = req.body as Record<string, unknown>;
    if (typeof input.sessionId !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(input.sessionId)) {
      throw new HttpError(400, "La session est invalide");
    }
    const keys = clientKeys(req, input.sessionId);
    await enforceSupportRateLimit({
      scope: "assistant_network",
      keyHash: keys.network,
      limit: NETWORK_RATE_LIMIT,
      windowSeconds: NETWORK_WINDOW_SECONDS,
    });
    await enforceSupportRateLimit({
      scope: "assistant_session",
      keyHash: keys.session,
      limit: SESSION_RATE_LIMIT,
      windowSeconds: SESSION_WINDOW_SECONDS,
    });
    const knowledgeActor = await resolveKnowledgeActorFromRequest(req);
    return analyzeSupportConversation({
      messages: cleanMessages(input.messages),
      attachments: cleanAttachments(input.attachments),
      safetyIdentifier: keys.session,
      knowledgeActor,
    });
  });
}
