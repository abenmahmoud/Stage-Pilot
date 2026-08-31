import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, eq, isNotNull, isNull, ne, or } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  supportAttachments,
  supportContacts,
  supportMessages,
  supportRequests,
} from "../../../db/schema.js";
import { HttpError } from "../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { requireSupportAccess } from "../../_shared/support.js";
import { SUPPORT_PUBLIC_DETAIL_LIMITS } from "../../../shared/support-public-detail-limits.js";
import { selectSupportPublicSubjectContext } from "../../../shared/support-public-detail-payload-policy.js";
import { singleSupportQueryValue } from "../../../shared/support-public-mutation-input-policy.js";

function assertCompletePublicDetailCollection(
  rowCount: number,
  limit: number,
  label: string
): void {
  if (rowCount > limit) {
    throw new HttpError(
      409,
      `Ce dossier contient trop de ${label} pour être affiché complètement. Aucune conversation partielle n’a été affichée.`
    );
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  return handleApi(res, async () => {
    const code = singleSupportQueryValue(req.query.code);
    if (!code || !/^BC-\d{4}-\d{6}$/.test(code)) {
      throw new HttpError(400, "Numéro de demande invalide");
    }

    const access = await requireSupportAccess(req, code);
    const [request] = await db
      .select({
        publicCode: supportRequests.publicCode,
        requesterType: supportRequests.requesterType,
        beneficiaryType: supportRequests.beneficiaryType,
        subjectContext: supportRequests.subjectContext,
        category: supportRequests.category,
        subject: supportRequests.subject,
        status: supportRequests.status,
        priority: supportRequests.priority,
        preferredChannel: supportRequests.preferredChannel,
        createdAt: supportRequests.createdAt,
        updatedAt: supportRequests.updatedAt,
        resolvedAt: supportRequests.resolvedAt,
      })
      .from(supportRequests)
      .where(and(
        eq(supportRequests.institutionId, access.institutionId),
        eq(supportRequests.id, access.requestId)
      ))
      .limit(1);
    if (!request) throw new HttpError(404, "Demande introuvable");

    const [messages, attachments, verifiedContacts] = await Promise.all([
      db.select({
        id: supportMessages.id,
        direction: supportMessages.direction,
        channel: supportMessages.channel,
        authorLabel: supportMessages.authorLabel,
        bodyText: supportMessages.bodyText,
        deliveryStatus: supportMessages.deliveryStatus,
        createdAt: supportMessages.createdAt,
      })
      .from(supportMessages)
      .where(
        and(
          eq(supportMessages.requestId, access.requestId),
          ne(supportMessages.direction, "internal")
        )
      )
      .orderBy(asc(supportMessages.createdAt))
      .limit(SUPPORT_PUBLIC_DETAIL_LIMITS.messages + 1),
      db.select({
        id: supportAttachments.id,
        messageId: supportAttachments.messageId,
        direction: supportAttachments.direction,
        documentType: supportAttachments.documentType,
        originalName: supportAttachments.originalName,
        detectedMime: supportAttachments.detectedMime,
        sizeBytes: supportAttachments.sizeBytes,
        scanStatus: supportAttachments.scanStatus,
        uploadedBySession: supportAttachments.uploadedBySession,
        createdAt: supportAttachments.createdAt,
      })
      .from(supportAttachments)
      .where(and(
        eq(supportAttachments.requestId, access.requestId),
        or(
          eq(supportAttachments.direction, "requester"),
          and(
            eq(supportAttachments.direction, "agent"),
            isNotNull(supportAttachments.messageId),
            isNotNull(supportAttachments.releasedAt)
          )
        )
      ))
      .orderBy(asc(supportAttachments.createdAt))
      .limit(SUPPORT_PUBLIC_DETAIL_LIMITS.attachments + 1),
      db.select({ id: supportContacts.id })
        .from(supportContacts)
        .where(
          and(
            eq(supportContacts.requestId, access.requestId),
            eq(supportContacts.isVerified, true),
            isNull(supportContacts.disabledAt)
          )
        )
        .limit(1),
    ]);

    assertCompletePublicDetailCollection(
      messages.length,
      SUPPORT_PUBLIC_DETAIL_LIMITS.messages,
      "messages"
    );
    assertCompletePublicDetailCollection(
      attachments.length,
      SUPPORT_PUBLIC_DETAIL_LIMITS.attachments,
      "pièces jointes"
    );

    const identityContext = (request.subjectContext ?? {}) as Record<string, unknown>;
    const contextIdentityStatus = identityContext.identityStatus;
    const identityStatus = contextIdentityStatus === "identite_confirmee" || contextIdentityStatus === "contact_verifie"
      ? contextIdentityStatus
      : verifiedContacts.length > 0 ? "contact_verifie" : "non_verifiee";

    return {
      request: {
        ...request,
        subjectContext: selectSupportPublicSubjectContext(request.subjectContext),
        identityStatus,
        identityMethod: typeof identityContext.identityMethod === "string" ? identityContext.identityMethod : verifiedContacts.length > 0 ? "email_magic_link" : null,
        identityVerifiedAt: typeof identityContext.identityVerifiedAt === "string" ? identityContext.identityVerifiedAt : null,
      },
      messages,
      attachments: attachments.map(({ uploadedBySession, ...attachment }) => ({
        ...attachment,
        canRemoveDraft:
          attachment.direction === "requester"
          && uploadedBySession === access.sessionId
          && ["awaiting_upload", "blocked", "scan_error", "removal_pending"].includes(attachment.scanStatus),
      })),
    };
  });
}
