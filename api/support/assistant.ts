import type { VercelRequest, VercelResponse } from "@vercel/node";
import { HttpError } from "../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import {
  assertNoForbiddenSupportSecret,
} from "../_shared/support.js";
import { enforceAssistantRateLimits } from "../_shared/support-rate-limits.js";
import {
  analyzeSupportConversation,
  type SupportAgentMessage,
  type SupportAttachmentHint,
} from "../_shared/support-agent.js";
import { resolveKnowledgeActorFromRequest } from "../_shared/knowledge-actor.js";
import { recordAgentRuntimeMetric } from "../_shared/agent-runtime-metrics.js";
import { readNextCourseForVerifiedIdentity } from "../_shared/schedule-identity-reader.js";
import { routeSupportRequest } from "../../shared/support-routing.js";
import {
  createSupportAssistantRoutingReceipt,
  supportAssistantRoutingReviewEnabled,
} from "../../shared/support-assistant-routing-receipt.js";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) throw new HttpError(400, "La demande est invalide");
    const input = req.body as Record<string, unknown>;
    if (typeof input.sessionId !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(input.sessionId)) {
      throw new HttpError(400, "La session est invalide");
    }
    const deviceKey = await enforceAssistantRateLimits(req, input.sessionId);
    const knowledgeActor = await resolveKnowledgeActorFromRequest(req);
    const messages = cleanMessages(input.messages);
    const result = await analyzeSupportConversation({
      messages,
      attachments: cleanAttachments(input.attachments),
      safetyIdentifier: deviceKey,
      knowledgeActor,
      runtimeMetricsRecorder: knowledgeActor
        ? (metric) => recordAgentRuntimeMetric(knowledgeActor.institutionId, metric)
        : undefined,
      scheduleReader: async ({ requestedAt }) => {
        try {
          return await readNextCourseForVerifiedIdentity({
            req,
            now: new Date(),
            requestedAt,
          });
        } catch (error) {
          if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
            return { ok: false, reason: "school_identity_required" } as const;
          }
          throw error;
        }
      },
    });
    const route = routeSupportRequest({
      category: result.category,
      description: messages
        .filter((message) => message.role === "requester")
        .map((message) => message.content)
        .join("\n"),
    });
    const signedRouting = knowledgeActor && supportAssistantRoutingReviewEnabled()
      ? createSupportAssistantRoutingReceipt({
          institutionId: knowledgeActor.institutionId,
          category: result.category,
          service: route.service,
          usedAi: result.usedAi,
          model: result.usedAi
            ? process.env.OPENAI_SUPPORT_MODEL || "gpt-5.6-luna"
            : null,
          secret: process.env.SUPPORT_HASH_SECRET,
        })
      : null;
    return {
      ...result,
      routingReceipt: signedRouting?.receipt ?? null,
      routingReceiptExpiresAt: signedRouting?.expiresAt ?? null,
    };
  });
}
