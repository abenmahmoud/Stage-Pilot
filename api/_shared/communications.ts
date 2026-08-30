import type { VercelRequest } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { communicationSettings } from "../../db/schema.js";
import { readCommunicationFeatureFlags } from "./communication-flags.js";
import { HttpError } from "./auth.js";
import { requireSupportAgent } from "./support-agent-access.js";

const COMMUNICATION_EDITOR_ROLES = new Set(["superadmin", "administration", "proviseur"]);

export async function requireCommunicationEditor(req: VercelRequest) {
  const context = await requireSupportAgent(req);
  if (!COMMUNICATION_EDITOR_ROLES.has(context.user.role)) {
    throw new HttpError(403, "Ce compte ne peut pas préparer une communication.");
  }
  if (!readCommunicationFeatureFlags().moduleEnabled) {
    throw new HttpError(503, "Le centre de communications n’est pas activé.");
  }
  const [settings] = await db
    .select({ moduleEnabled: communicationSettings.moduleEnabled })
    .from(communicationSettings)
    .where(eq(communicationSettings.institutionId, context.institutionId))
    .limit(1);
  if (!settings?.moduleEnabled) {
    throw new HttpError(503, "Le centre de communications n’est pas activé.");
  }
  return context;
}
