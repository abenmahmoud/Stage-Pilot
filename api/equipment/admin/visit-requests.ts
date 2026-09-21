import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  equipmentServiceVisitEvents,
  equipmentServiceVisitRequests,
  equipmentServiceVisits,
  supportRequests,
} from "../../../db/schema.js";
import { HttpError } from "../../_shared/auth.js";
import { requireEquipmentCoordinator } from "../../_shared/equipment-access.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_CODE = /^BC-\d{4}-\d{6}$/;

function bodyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Le formulaire est invalide");
  return value as Record<string, unknown>;
}

function visitId(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new HttpError(400, "Passage invalide");
  return value.toLowerCase();
}

function publicCodes(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 100) throw new HttpError(400, "La sélection est invalide");
  const codes = [...new Set(value)];
  if (codes.some(code => typeof code !== "string" || !PUBLIC_CODE.test(code))) throw new HttpError(400, "Un numéro de demande est invalide");
  return codes as string[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      const context = await requireEquipmentCoordinator(req);
      const assignments = await db.select({
        visitId: equipmentServiceVisitRequests.visitId,
        publicCode: supportRequests.publicCode,
      }).from(equipmentServiceVisitRequests)
        .innerJoin(supportRequests, eq(supportRequests.id, equipmentServiceVisitRequests.requestId))
        .where(eq(equipmentServiceVisitRequests.institutionId, context.institutionId));
      return { assignments };
    });
  }

  if (req.method === "PUT") {
    return handleApi(res, async () => {
      const context = await requireEquipmentCoordinator(req);
      const input = bodyRecord(req.body);
      const selectedVisitId = visitId(input.visitId);
      const codes = publicCodes(input.publicCodes);
      const [visit] = await db.select({ id: equipmentServiceVisits.id }).from(equipmentServiceVisits).where(and(
        eq(equipmentServiceVisits.id, selectedVisitId),
        eq(equipmentServiceVisits.institutionId, context.institutionId)
      )).limit(1);
      if (!visit) throw new HttpError(404, "Passage introuvable");

      const requests = codes.length === 0 ? [] : await db.select({
        id: supportRequests.id,
        publicCode: supportRequests.publicCode,
      }).from(supportRequests).where(and(
        eq(supportRequests.institutionId, context.institutionId),
        eq(supportRequests.category, "ordinateur"),
        inArray(supportRequests.publicCode, codes)
      ));
      if (requests.length !== codes.length) throw new HttpError(409, "Une demande sélectionnée n’est plus disponible dans la file matériel");

      await db.transaction(async tx => {
        await tx.delete(equipmentServiceVisitRequests).where(and(
          eq(equipmentServiceVisitRequests.institutionId, context.institutionId),
          eq(equipmentServiceVisitRequests.visitId, selectedVisitId)
        ));
        if (requests.length) {
          await tx.insert(equipmentServiceVisitRequests).values(requests.map(request => ({
            institutionId: context.institutionId,
            visitId: selectedVisitId,
            requestId: request.id,
            assignedBy: context.user.id,
          })));
        }
        await tx.insert(equipmentServiceVisitEvents).values({
          institutionId: context.institutionId,
          visitId: selectedVisitId,
          eventType: "visit.requests_updated",
          actorId: context.user.id,
          nextValue: { requestCount: requests.length, publicCodes: requests.map(item => item.publicCode) },
        });
      });
      return { assignments: requests.map(request => ({ visitId: selectedVisitId, publicCode: request.publicCode })) };
    });
  }

  return methodNotAllowed(res, ["GET", "PUT"]);
}

export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };
