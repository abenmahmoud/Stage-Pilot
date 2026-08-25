import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  supportAttachments,
  supportMessages,
  supportRequests,
} from "../../../db/schema.js";
import { HttpError } from "../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { requireSupportAccess } from "../../_shared/support.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  return handleApi(res, async () => {
    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
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
      .where(eq(supportRequests.id, access.requestId))
      .limit(1);

    const messages = await db
      .select({
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
      .orderBy(asc(supportMessages.createdAt));

    const attachments = await db
      .select({
        id: supportAttachments.id,
        messageId: supportAttachments.messageId,
        documentType: supportAttachments.documentType,
        originalName: supportAttachments.originalName,
        detectedMime: supportAttachments.detectedMime,
        sizeBytes: supportAttachments.sizeBytes,
        scanStatus: supportAttachments.scanStatus,
        createdAt: supportAttachments.createdAt,
      })
      .from(supportAttachments)
      .where(eq(supportAttachments.requestId, access.requestId));

    return { request, messages, attachments };
  });
}
