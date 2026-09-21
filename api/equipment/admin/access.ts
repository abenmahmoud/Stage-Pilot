import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireEquipmentCoordinator } from "../../_shared/equipment-access.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  return handleApi(res, async () => {
    const context = await requireEquipmentCoordinator(req);
    return {
      allowed: true,
      canManageVisits: true,
      canViewAllRequests: context.access.canViewAll,
    };
  });
}
