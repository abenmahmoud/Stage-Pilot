import { createCommunicationWebmailDeliveryToken } from "./communication-webmail-delivery.js";
import type { NominativeMergedMessage } from "./nominative-merge.js";

/** One already-validated personal message, one opaque delivery command. */
export function createNominativeWebmailCommand(input: {
  institutionId: string; communicationId: string; versionId: string; version: number;
  deliveryId: string; contactRef: string; idempotencyKeyHash: string; resolutionHash: string;
  message: Pick<NominativeMergedMessage, "subject" | "preheader" | "bodyText">;
  secret: string; now?: Date;
}) {
  const now = input.now ?? new Date();
  return createCommunicationWebmailDeliveryToken({
    institutionId: input.institutionId, secret: input.secret, now,
    command: {
      v: 1, institutionId: input.institutionId, communicationId: input.communicationId,
      versionId: input.versionId, version: input.version, deliveryId: input.deliveryId,
      contactRef: input.contactRef, idempotencyKeyHash: input.idempotencyKeyHash,
      resolutionHash: input.resolutionHash, visibility: "targeted", linkMode: "authenticated",
      canonicalPath: `/informations/${input.communicationId}`, replyRef: `reply:${input.deliveryId}`,
      subject: input.message.subject, preheader: input.message.preheader, bodyText: input.message.bodyText,
      issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
    },
  });
}
