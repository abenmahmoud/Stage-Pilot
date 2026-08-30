import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  communicationEvents,
  communications,
  communicationVersions,
} from "../../../../db/schema.js";
import { HttpError } from "../../../_shared/auth.js";
import { requireCommunicationEditor } from "../../../_shared/communications.js";
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
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)
      || Object.keys(req.body).some((key) => key !== "confirmation")
      || req.body.confirmation !== "VERIFIER") {
      throw new HttpError(400, "Confirmez la demande de vérification.");
    }
    const id = routeId(req);
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`
        select id from public.communications
        where id = ${id}::uuid and institution_id = ${context.institutionId}::uuid
        for update
      `);
      const [root] = await tx
        .select()
        .from(communications)
        .where(and(
          eq(communications.id, id),
          eq(communications.institutionId, context.institutionId)
        ))
        .limit(1);
      if (!root) throw new HttpError(404, "Communication introuvable");
      if (root.status === "review") return { communication: root, duplicate: true };
      if (root.status !== "draft") {
        throw new HttpError(409, "Cette communication ne peut pas être envoyée en vérification.");
      }
      const [current] = await tx
        .select()
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
        .returning();
      if (!version) throw new HttpError(409, "Cette version a déjà changé.");
      const [updated] = await tx
        .update(communications)
        .set({ status: "review" })
        .where(and(
          eq(communications.id, id),
          eq(communications.institutionId, context.institutionId),
          eq(communications.status, "draft"),
          eq(communications.currentVersion, root.currentVersion)
        ))
        .returning();
      if (!updated) throw new HttpError(409, "Cette communication a déjà changé.");
      await tx.insert(communicationEvents).values({
        institutionId: context.institutionId,
        communicationId: id,
        resourceType: "version",
        resourceId: current.id,
        eventType: "communication.review_requested",
        actorUserId: context.user.id,
        actorType: "user",
        summary: { version: root.currentVersion },
      });
      return { communication: updated, version, duplicate: false };
    });
    return result;
  });
}
