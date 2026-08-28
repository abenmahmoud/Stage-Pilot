import type { VercelRequest } from "@vercel/node";
import { HttpError, requireAal2 } from "./auth.js";
import { requireSupportAgent, type SupportAgentContext } from "./support-agent-access.js";

export async function requireSupportOperationsManager(
  req: VercelRequest
): Promise<SupportAgentContext> {
  const context = await requireSupportAgent(req);
  if (!context.access.canViewAll) {
    throw new HttpError(403, "La santé globale des demandes est réservée à la direction");
  }
  await requireAal2(req);
  return context;
}
