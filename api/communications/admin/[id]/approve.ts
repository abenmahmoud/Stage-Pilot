import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  communicationEvents,
  communications,
  communicationVersions,
} from "../../../../db/schema.js";
import { HttpError } from "../../../_shared/auth.js";
import { requireCommunicationManager } from "../../../_shared/communications.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value) throw new HttpError(400, "Communication manquante");
  return value;
}

function requireConfirmation(value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some((key) => key !== "confirmation")
    || (value as Record<string, unknown>).confirmation !== "VALIDER") {
    throw new HttpError(400, "Confirmez la validation de la communication.");
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const context = await requireCommunicationManager(req);
    requireConfirmation(req.body);
    const id = routeId(req);
    return db.transaction(async (tx) => {
      await tx.execute(sql`
        select id from public.communications
        where id = ${id}::uuid and institution_id = ${context.institutionId}::uuid
        for update
      `);
      const [root] = await tx
        .select({
          id: communications.id,
          status: communications.status,
          visibility: communications.visibility,
          currentVersion: communications.currentVersion,
          approvedAt: communications.approvedAt,
          updatedAt: communications.updatedAt,
        })
        .from(communications)
        .where(and(
          eq(communications.id, id),
          eq(communications.institutionId, context.institutionId)
        ))
        .limit(1);
      if (!root) throw new HttpError(404, "Communication introuvable");
      if (root.status === "approved" || root.status === "published") {
        return { communication: root, duplicate: true };
      }
      if (root.status !== "review") {
        throw new HttpError(409, "Cette communication n’attend pas une validation.");
      }
      const [current] = await tx
        .select({
          id: communicationVersions.id,
          status: communicationVersions.status,
          version: communicationVersions.version,
          openQuestions: communicationVersions.openQuestions,
        })
        .from(communicationVersions)
        .where(and(
          eq(communicationVersions.communicationId, id),
          eq(communicationVersions.institutionId, context.institutionId),
          eq(communicationVersions.version, root.currentVersion)
        ))
        .limit(1);
      if (!current || current.status !== "review") {
        throw new HttpError(409, "La version soumise n’est plus disponible.");
      }
      if (Array.isArray(current.openQuestions) && current.openQuestions.length > 0) {
        throw new HttpError(409, "Des informations restent à confirmer.");
      }
      const approvedAt = new Date();
      const [version] = await tx
        .update(communicationVersions)
        .set({
          status: "approved",
          approvedBy: context.user.id,
          approvedAt,
        })
        .where(and(
          eq(communicationVersions.id, current.id),
          eq(communicationVersions.institutionId, context.institutionId),
          eq(communicationVersions.status, "review")
        ))
        .returning({
          id: communicationVersions.id,
          version: communicationVersions.version,
          status: communicationVersions.status,
          approvedAt: communicationVersions.approvedAt,
        });
      if (!version) throw new HttpError(409, "Cette version a déjà changé.");
      const [communication] = await tx
        .update(communications)
        .set({
          status: "approved",
          approvedBy: context.user.id,
          approvedAt,
        })
        .where(and(
          eq(communications.id, id),
          eq(communications.institutionId, context.institutionId),
          eq(communications.status, "review"),
          eq(communications.currentVersion, root.currentVersion)
        ))
        .returning({
          id: communications.id,
          status: communications.status,
          visibility: communications.visibility,
          currentVersion: communications.currentVersion,
          approvedAt: communications.approvedAt,
          updatedAt: communications.updatedAt,
        });
      if (!communication) throw new HttpError(409, "Cette communication a déjà changé.");
      await tx.insert(communicationEvents).values({
        institutionId: context.institutionId,
        communicationId: id,
        resourceType: "version",
        resourceId: current.id,
        eventType: "communication.approved",
        actorUserId: context.user.id,
        actorType: "user",
        summary: { version: root.currentVersion, visibility: root.visibility },
      });
      return { communication, version, duplicate: false };
    });
  });
}
