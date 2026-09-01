import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  communicationDeliveries,
  communicationEvents,
  communicationInbound,
} from "../../db/schema.js";
import type { CommunicationBrevoInboundReceipt } from "../../shared/communication-brevo-inbound.js";
import { matchCommunicationInboundToDelivery } from "../../shared/communication-inbound-matching.js";

type CommunicationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type CommunicationInboundPersistenceResult = {
  accepted: true;
  received: number;
  duplicates: number;
  matched: number;
  unmatched: number;
};

export async function persistCommunicationInboundReceipts(input: {
  tx: CommunicationTransaction;
  institutionId: string;
  receipts: readonly CommunicationBrevoInboundReceipt[];
}): Promise<CommunicationInboundPersistenceResult> {
  let received = 0;
  let duplicates = 0;
  let matched = 0;
  let unmatched = 0;

  for (const receipt of input.receipts) {
    const candidates = receipt.inReplyToHash === null
      ? []
      : await input.tx
        .select({
          institutionId: communicationDeliveries.institutionId,
          deliveryId: communicationDeliveries.id,
          communicationId: communicationDeliveries.communicationId,
          providerMessageRef: communicationDeliveries.providerMessageRef,
        })
        .from(communicationDeliveries)
        .where(and(
          eq(communicationDeliveries.institutionId, input.institutionId),
          eq(communicationDeliveries.providerMessageRef, receipt.inReplyToHash)
        ))
        .limit(2);
    const match = matchCommunicationInboundToDelivery(receipt, candidates, input.institutionId);
    const [created] = await input.tx
      .insert(communicationInbound)
      .values({
        institutionId: input.institutionId,
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
    await input.tx.insert(communicationEvents).values({
      institutionId: input.institutionId,
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
}
