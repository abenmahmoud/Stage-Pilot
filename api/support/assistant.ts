import type { VercelRequest, VercelResponse } from "@vercel/node";
import { HttpError } from "../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import {
  assertNoForbiddenSupportSecret,
} from "../_shared/support.js";
import { enforceAssistantRateLimits } from "../_shared/support-rate-limits.js";
import {
  analyzeSupportConversation,
} from "../_shared/support-agent.js";
import { resolveKnowledgeActorFromRequest } from "../_shared/knowledge-actor.js";
import { recordAgentRuntimeMetric } from "../_shared/agent-runtime-metrics.js";
import { readNextCourseForVerifiedIdentity } from "../_shared/schedule-identity-reader.js";
import { routeSupportRequest } from "../../shared/support-routing.js";
import {
  createSupportAssistantRoutingReceipt,
  supportAgentCreateRequestActionEnabled,
  supportAssistantRoutingReviewEnabled,
  type SupportAssistantActionGrant,
} from "../../shared/support-assistant-routing-receipt.js";
import { isValidSupportAssistantPayload } from "../../shared/support-assistant-payload-policy.js";
import { parseSupportAssistantInput } from "../../shared/support-assistant-input-policy.js";
import { loadPublicKnowledgeContext } from "../_shared/public-knowledge-context.js";
import { createSupportNormalizationReceipt } from "../_shared/support-normalization.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const input = parseSupportAssistantInput(req.body);
    if (!input) throw new HttpError(400, "La demande est invalide");
    input.messages.forEach((message) => assertNoForbiddenSupportSecret(message.content));
    input.attachments.forEach((attachment) => assertNoForbiddenSupportSecret(attachment.name));
    const deviceKey = await enforceAssistantRateLimits(req, input.sessionId, res);
    const messages = input.messages;
    const attachments = input.attachments;
    const knowledgeActor = await resolveKnowledgeActorFromRequest(req);
    const result = await analyzeSupportConversation({
      messages,
      attachments,
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
            return { ok: false, reason: "identity_i3_required" } as const;
          }
          throw error;
        }
      },
    });
    const requesterQuery = messages
      .filter((message) => message.role === "requester")
      .map((message) => message.content)
      .join("\n");
    const route = routeSupportRequest({
      category: result.category,
      description: requesterQuery,
    });
    let actionGrant: SupportAssistantActionGrant | null = null;
    if (
      knowledgeActor
      && supportAgentCreateRequestActionEnabled()
      && (result.readyToCreate || result.action === "human_transfer")
    ) {
      try {
        const context = await loadPublicKnowledgeContext({
          query: requesterQuery,
          actor: knowledgeActor,
        });
        const grantedVersion = context.versions.find((version) =>
          version.allowedTools?.includes("support.create_request")
        );
        if (grantedVersion) {
          actionGrant = {
            toolKey: "support.create_request" as const,
            skillVersionId: grantedVersion.versionId,
            requesterRefHash: deviceKey,
          };
        }
      } catch {
        actionGrant = null;
      }
    }
    const signedNormalization = knowledgeActor && result.usedAi ? createSupportNormalizationReceipt({
      institutionId: knowledgeActor.institutionId,
      category: result.category,
      usedAi: result.usedAi,
      messages,
      reply: result.reply,
      detectedLanguage: result.detectedLanguage,
      internalSummaryFr: result.internalSummaryFr,
      requesterRefHash: deviceKey,
      secret: process.env.SUPPORT_HASH_SECRET,
    }) : null;
    const signedRouting = knowledgeActor
      && (supportAssistantRoutingReviewEnabled() || actionGrant)
      ? createSupportAssistantRoutingReceipt({
          institutionId: knowledgeActor.institutionId,
          category: result.category,
          service: route.service,
          usedAi: result.usedAi,
          model: result.usedAi
            ? process.env.OPENAI_SUPPORT_MODEL || "gpt-5.6-luna"
            : null,
          actionGrant,
          secret: process.env.SUPPORT_HASH_SECRET,
        })
      : null;
    const payload = {
      reply: result.reply,
      category: result.category,
      requesterType: result.requesterType,
      urgency: result.urgency,
      confidence: result.confidence,
      missingInformation: result.missingInformation,
      suggestedDocuments: result.suggestedDocuments,
      readyToCreate: result.readyToCreate,
      safetyNotice: result.safetyNotice,
      detectedLanguage: result.detectedLanguage,
      internalSummaryFr: result.internalSummaryFr,
      usedAi: result.usedAi,
      scope: result.scope,
      action: result.action,
      turnCount: result.turnCount,
      remainingTurns: result.remainingTurns,
      limitReached: result.limitReached,
      sourceReferences: result.sourceReferences.map(({ title, updatedAt }) => ({ title, updatedAt })),
      routingReceipt: signedRouting?.receipt ?? null,
      routingReceiptExpiresAt: signedRouting?.expiresAt ?? null,
      normalizationReceipt: signedNormalization?.receipt ?? null,
      normalizationReceiptExpiresAt: signedNormalization?.expiresAt ?? null,
      requestActionAuthorized: actionGrant !== null && signedRouting !== null,
    };
    if (!isValidSupportAssistantPayload(payload)) {
      throw new HttpError(503, "La réponse de l’assistant est invalide. Réessayez.");
    }
    return payload;
  });
}

export const config = { api: { bodyParser: { sizeLimit: "32kb" } } };
