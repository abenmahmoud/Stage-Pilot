import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { supportEvents, supportRequests } from "../../../db/schema.js";
import { HttpError } from "../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { requireSupportAgent, assertSupportRequestAccess } from "../../_shared/support-agent-access.js";
import { enforceAgentWriteRateLimit } from "../../_shared/support-rate-limits.js";
import { isOfficeArchiveInput } from "../../../shared/support-office-archive.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const { user, access, institutionId } = await requireSupportAgent(req);
    if (!isOfficeArchiveInput(req.body)) throw new HttpError(400, "Archivage invalide");
    await enforceAgentWriteRateLimit(user.id);
    const { publicCode, archived, expectedUpdatedAt } = req.body;
    return db.transaction(async (tx) => {
      const [request] = await tx.select().from(supportRequests).where(and(
        eq(supportRequests.institutionId, institutionId), eq(supportRequests.publicCode, publicCode)
      )).for("update").limit(1);
      if (!request) throw new HttpError(404, "Demande introuvable");
      assertSupportRequestAccess(access, request.assignedTeam, request.category);
      if (request.updatedAt.getTime() !== Date.parse(expectedUpdatedAt)) {
        throw new HttpError(409, "Ce dossier a été modifié. Actualisez-le avant de continuer.");
      }
      const now = new Date();
      const context = { ...(request.subjectContext as Record<string, unknown>) };
      const previousArchive = context.officeArchive ?? null;
      if (archived) context.officeArchive = now.toISOString();
      else delete context.officeArchive;
      // Preserve the existing payload bound rather than making archived details unreadable.
      if (Object.keys(context).length > 20) throw new HttpError(409, "Ce dossier nécessite un archivage accompagné.");
      const [updated] = await tx.update(supportRequests).set({ subjectContext: context, updatedAt: now })
        .where(and(eq(supportRequests.id, request.id), eq(supportRequests.institutionId, institutionId))).returning();
      const [event] = await tx.insert(supportEvents).values({
        requestId: request.id, eventType: archived ? "request.archived" : "request.restored",
        actorType: "agent", actorId: user.id, correlationId: randomUUID(), createdAt: now,
        fromValue: { officeArchive: previousArchive, status: request.status },
        toValue: { officeArchive: context.officeArchive ?? null, status: request.status },
      }).returning({ id: supportEvents.id });
      return { publicCode, archived, updatedAt: updated.updatedAt.toISOString(), eventId: event.id };
    });
  });
}
