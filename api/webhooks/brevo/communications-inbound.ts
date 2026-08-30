import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  communicationDeliveries,
  communicationEvents,
  communicationInbound,
} from "../../../db/schema.js";
import {
  communicationInboundWebhookEnabled,
  parseCommunicationBrevoInboundEnvelope,
  verifyCommunicationInboundBearerHeader,
} from "../../../shared/communication-brevo-inbound.js";
import { matchCommunicationInboundToDelivery } from "../../../shared/communication-inbound-matching.js";
import { HttpError } from "../../_shared/auth.js";
import { requireConfiguredInstitution } from "../../_shared/institution-context.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

function authorize(req: VercelRequest): void {
  if (!communicationInboundWebhookEnabled()) throw new HttpError(404, "Webhook indisponible");
  if (!verifyCommunicationInboundBearerHeader(
    req.headers.authorization,
    process.env.COMMUNICATION_INBOUND_WEBHOOK_TOKEN
  )) {
    throw new HttpError(401, "Webhook refusé");
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    authorize(req);
    const institution = await requireConfiguredInstitution();
    let receipts;
    try {
      receipts = parseCommunicationBrevoInboundEnvelope(
        req.body,
        process.env.COMMUNICATION_PROVIDER_MESSAGE_HMAC_SECRET ?? ""
      );
    } catch {
      throw new HttpError(400, "Lot entrant invalide");
    }

    return db.transaction(async (tx) => {
      let received = 0;
      let duplicates = 0;
      let matched = 0;
      let unmatched = 0;
      for (const receipt of receipts) {
        const candidates = receipt.inReplyToHash === null
          ? []
          : await tx
            .select({
              institutionId: communicationDeliveries.institutionId,
              deliveryId: communicationDeliveries.id,
              communicationId: communicationDeliveries.communicationId,
              providerMessageRef: communicationDeliveries.providerMessageRef,
            })
            .from(communicationDeliveries)
            .where(and(
              eq(communicationDeliveries.institutionId, institution.id),
              eq(communicationDeliveries.providerMessageRef, receipt.inReplyToHash)
            ))
            .limit(2);
        const match = matchCommunicationInboundToDelivery(receipt, candidates, institution.id);
        const [created] = await tx
          .insert(communicationInbound)
          .values({
            institutionId: institution.id,
            communicationId: match.status === "matched" ? match.communicationId : null,
            provider: receipt.provider,
            externalMessageHash: receipt.externalMessageHash,
            status: receipt.classification === null ? "received" : "review",
            classification: receipt.classification?.classification ?? null,
          })
          .onConflictDoNothing()
          .returning({ id: communicationInbound.id });
        if (!created) {
          duplicates += 1;
          continue;
        }
        received += 1;
        if (match.status !== "matched") {
          unmatched += 1;
          continue;
        }
        matched += 1;
        await tx.insert(communicationEvents).values({
          institutionId: institution.id,
          communicationId: match.communicationId,
          resourceType: "inbound",
          resourceId: created.id,
          eventType: "inbound.received",
          actorType: "provider",
          externalEventHash: receipt.externalMessageHash,
          summary: {
            matchReason: match.reason,
            attachmentCount: receipt.attachmentCount,
            attachmentBytes: receipt.attachmentBytes,
            hasExtractedMessage: receipt.hasExtractedMessage,
            spamReviewRequired: receipt.spamScore !== null && receipt.spamScore >= 5,
            classification: receipt.classification?.classification ?? null,
            classificationConfidence: receipt.classification?.confidence ?? null,
            proposedAction: receipt.classification?.proposedAction ?? null,
            sensitiveContentDetected: receipt.classification?.sensitive ?? false,
            requiresHumanReview: true,
          },
        });
      }
      return { accepted: true, received, duplicates, matched, unmatched };
    });
  });
}

export const config = { api: { bodyParser: { sizeLimit: "3mb" } } };
