import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  equipmentExternalUpdates,
  equipmentServiceVisitRequests,
  equipmentServiceVisits,
  supportRequests,
} from "../../../db/schema.js";
import { HttpError } from "../../_shared/auth.js";
import { requireEquipmentExternalGrant } from "../../_shared/equipment-external-session.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function grantId(value: string | string[] | undefined): string {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id || !UUID.test(id)) throw new HttpError(400, "Lien d’accès invalide");
  return id.toLowerCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  return handleApi(res, async () => {
    const { grant } = await requireEquipmentExternalGrant(req, grantId(req.query.grantId));
    const [visit] = await db.select({
      id: equipmentServiceVisits.id,
      provider: equipmentServiceVisits.provider,
      startsAt: equipmentServiceVisits.startsAt,
      endsAt: equipmentServiceVisits.endsAt,
      status: equipmentServiceVisits.status,
      location: equipmentServiceVisits.location,
      publicNote: equipmentServiceVisits.publicNote,
    }).from(equipmentServiceVisits).where(and(
      eq(equipmentServiceVisits.id, grant.visitId),
      eq(equipmentServiceVisits.institutionId, grant.institutionId)
    )).limit(1);
    if (!visit) throw new HttpError(410, "Ce passage n’est plus disponible");

    const requests = await db.select({
      id: supportRequests.id,
      publicCode: supportRequests.publicCode,
      status: supportRequests.status,
      priority: supportRequests.priority,
      subjectContext: supportRequests.subjectContext,
    }).from(equipmentServiceVisitRequests)
      .innerJoin(supportRequests, eq(supportRequests.id, equipmentServiceVisitRequests.requestId))
      .where(and(
        eq(equipmentServiceVisitRequests.institutionId, grant.institutionId),
        eq(equipmentServiceVisitRequests.visitId, grant.visitId),
        eq(supportRequests.category, "ordinateur")
      ));
    const ids = requests.map(request => request.id);
    const updates = ids.length ? await db.select({
      requestId: equipmentExternalUpdates.requestId,
      outcome: equipmentExternalUpdates.outcome,
      note: equipmentExternalUpdates.note,
      createdAt: equipmentExternalUpdates.createdAt,
    }).from(equipmentExternalUpdates).where(and(
      eq(equipmentExternalUpdates.grantId, grant.id),
      inArray(equipmentExternalUpdates.requestId, ids)
    )).orderBy(desc(equipmentExternalUpdates.createdAt)) : [];
    const latest = new Map<string, typeof updates[number]>();
    for (const update of updates) if (!latest.has(update.requestId)) latest.set(update.requestId, update);
    return {
      access: { label: grant.label, expiresAt: grant.expiresAt },
      visit,
      requests: requests.map(request => {
        const context = request.subjectContext && typeof request.subjectContext === "object" && !Array.isArray(request.subjectContext)
          ? request.subjectContext as Record<string, unknown> : {};
        return {
          publicCode: request.publicCode,
          status: request.status,
          priority: request.priority,
          equipment: {
            equipmentType: context.equipmentType ?? null,
            roomCode: context.roomCode ?? null,
            inventoryNumber: context.inventoryNumber ?? null,
            symptomSummary: context.symptomSummary ?? null,
            impact: context.impact ?? null,
            safetyRisk: context.safetyRisk ?? null,
            availability: context.availability ?? null,
          },
          latestUpdate: latest.get(request.id) ?? null,
        };
      }),
    };
  });
}
