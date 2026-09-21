import type { VercelRequest } from "@vercel/node";
import { HttpError } from "./auth.js";
import { requireSupportAgent } from "./support-agent-access.js";

export async function requireEquipmentCoordinator(req: VercelRequest) {
  const context = await requireSupportAgent(req);
  if (
    !context.access.canViewAll
    && !context.access.serviceCodes.includes("referent_numerique")
  ) {
    throw new HttpError(403, "Cet espace est réservé à la coordination numérique du lycée");
  }
  return context;
}
