import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  communicationInbound,
  communications,
  communicationVersions,
} from "../../../../db/schema.js";
import { requireCommunicationEditor } from "../../../_shared/communications.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  return handleApi(res, async () => {
    const context = await requireCommunicationEditor(req);
    const rows = await db
      .select({
        id: communicationInbound.id,
        communicationId: communicationInbound.communicationId,
        status: communicationInbound.status,
        classification: communicationInbound.classification,
        receivedAt: communicationInbound.receivedAt,
        title: communicationVersions.title,
      })
      .from(communicationInbound)
      .leftJoin(communications, and(
        eq(communicationInbound.communicationId, communications.id),
        eq(communicationInbound.institutionId, communications.institutionId)
      ))
      .leftJoin(communicationVersions, and(
        eq(communicationVersions.communicationId, communications.id),
        eq(communicationVersions.institutionId, communications.institutionId),
        eq(communicationVersions.version, communications.currentVersion)
      ))
      .where(and(
        eq(communicationInbound.institutionId, context.institutionId),
        inArray(communicationInbound.status, ["received", "review", "error"])
      ))
      .orderBy(desc(communicationInbound.receivedAt), desc(communicationInbound.id))
      .limit(100);
    return { inbound: rows };
  });
}
