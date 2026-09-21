import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { equipmentServiceVisits } from "../../db/schema.js";
import { requireConfiguredInstitution } from "../_shared/institution-context.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  res.setHeader("Cache-Control", "no-store");
  return handleApi(res, async () => {
    const institution = await requireConfiguredInstitution();
    const visits = await db
      .select({
        id: equipmentServiceVisits.id,
        provider: equipmentServiceVisits.provider,
        startsAt: equipmentServiceVisits.startsAt,
        endsAt: equipmentServiceVisits.endsAt,
        location: equipmentServiceVisits.location,
        publicNote: equipmentServiceVisits.publicNote,
      })
      .from(equipmentServiceVisits)
      .where(and(
        eq(equipmentServiceVisits.institutionId, institution.id),
        eq(equipmentServiceVisits.status, "confirmed"),
        gte(equipmentServiceVisits.endsAt, new Date())
      ))
      .orderBy(asc(equipmentServiceVisits.startsAt))
      .limit(12);
    return { visits };
  });
}
