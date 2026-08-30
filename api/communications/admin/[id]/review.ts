import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  communicationEvents,
  communications,
  communicationVersions,
} from "../../../../db/schema.js";
import { parseCommunicationReviewRequest } from "../../../../shared/communication-publication.js";
import { HttpError } from "../../../_shared/auth.js";
import {
  canManageCommunicationPublication,
  requireCommunicationEditor,
} from "../../../_shared/communications.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value) throw new HttpError(400, "Communication manquante");
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const context = await requireCommunicationEditor(req);
    let reviewRequest;
    try {
      reviewRequest = parseCommunicationReviewRequest(req.body);
    } catch {
      throw new HttpError(400, "Confirmez la demande de vérification.");
    }
    if (reviewRequest.visibility === "public"
      && !canManageCommunicationPublication(context.user.role)) {
      throw new HttpError(403, "Seule la direction peut préparer une publication publique.");
    }
    const id = routeId(req);
    const result = await db.transaction(async (tx) => {
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
          updatedAt: communications.updatedAt,
        })
        .from(communications)
        .where(and(
          eq(communications.id, id),
          eq(communications.institutionId, context.institutionId)
        ))
        .limit(1);
      if (!root) throw new HttpError(404, "Communication introuvable");
      if (root.status === "review") {
        if (root.visibility !== reviewRequest.visibility) {
          throw new HttpError(409, "La visibilité a déjà été soumise à la direction.");
        }
        return { communication: root, duplicate: true };
      }
      if (root.status !== "draft") {
        throw new HttpError(409, "Cette communication ne peut pas être envoyée en vérification.");
      }
      const [current] = await tx
        .select({
          id: communicationVersions.id,
          version: communicationVersions.version,
          status: communicationVersions.status,
          openQuestions: communicationVersions.openQuestions,
        })
        .from(communicationVersions)
        .where(and(
          eq(communicationVersions.communicationId, id),
          eq(communicationVersions.institutionId, context.institutionId),
          eq(communicationVersions.version, root.currentVersion)
        ))
        .limit(1);
      if (!current) throw new Error("La version courante est introuvable");
      const questions = Array.isArray(current.openQuestions) ? current.openQuestions : [];
      if (questions.length > 0) {
        throw new HttpError(409, "Répondez aux informations à confirmer avant de demander la vérification.");
      }
      const [version] = await tx
        .update(communicationVersions)
        .set({ status: "review" })
        .where(and(
          eq(communicationVersions.id, current.id),
          eq(communicationVersions.institutionId, context.institutionId),
          eq(communicationVersions.status, "draft")
        ))
        .returning({
          id: communicationVersions.id,
          version: communicationVersions.version,
          status: communicationVersions.status,
          createdAt: communicationVersions.createdAt,
          updatedAt: communicationVersions.updatedAt,
        });
      if (!version) throw new HttpError(409, "Cette version a déjà changé.");
      const [updated] = await tx
        .update(communications)
        .set({ status: "review", visibility: reviewRequest.visibility })
        .where(and(
          eq(communications.id, id),
          eq(communications.institutionId, context.institutionId),
          eq(communications.status, "draft"),
          eq(communications.currentVersion, root.currentVersion)
        ))
        .returning({
          id: communications.id,
          status: communications.status,
          visibility: communications.visibility,
          currentVersion: communications.currentVersion,
          updatedAt: communications.updatedAt,
        });
      if (!updated) throw new HttpError(409, "Cette communication a déjà changé.");
      await tx.insert(communicationEvents).values({
        institutionId: context.institutionId,
        communicationId: id,
        resourceType: "version",
        resourceId: current.id,
        eventType: "communication.review_requested",
        actorUserId: context.user.id,
        actorType: "user",
        summary: { version: root.currentVersion, visibility: reviewRequest.visibility },
      });
      return { communication: updated, version, duplicate: false };
    });
    return result;
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
