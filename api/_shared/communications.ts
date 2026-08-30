import type { VercelRequest } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { communicationSettings } from "../../db/schema.js";
import { readCommunicationFeatureFlags } from "./communication-flags.js";
import { HttpError, requireAal2 } from "./auth.js";
import { requireSupportAgent } from "./support-agent-access.js";

const COMMUNICATION_EDITOR_ROLES = new Set(["superadmin", "administration", "proviseur"]);
const COMMUNICATION_TEMPLATE_MANAGER_ROLES = new Set(["superadmin", "proviseur"]);

export async function requireCommunicationEditor(req: VercelRequest) {
  const context = await requireSupportAgent(req);
  await requireAal2(req);
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

export async function requireCommunicationTemplateManager(req: VercelRequest) {
  return requireCommunicationManager(req);
}

export async function requireCommunicationDirection(req: VercelRequest) {
  const context = await requireSupportAgent(req);
  await requireAal2(req);
  if (!COMMUNICATION_TEMPLATE_MANAGER_ROLES.has(context.user.role)) {
    throw new HttpError(403, "Seule la direction peut gérer les communications.");
  }
  return context;
}

export async function requireCommunicationManager(req: VercelRequest) {
  const context = await requireCommunicationEditor(req);
  if (!COMMUNICATION_TEMPLATE_MANAGER_ROLES.has(context.user.role)) {
    throw new HttpError(403, "Seule la direction peut gérer les communications.");
  }
  return context;
}

export async function requireCommunicationSender(req: VercelRequest) {
  const context = await requireCommunicationManager(req);
  if (!readCommunicationFeatureFlags().sendingEnabled) {
    throw new HttpError(503, "L’envoi des communications n’est pas activé.");
  }
  const [settings] = await db
    .select({ sendingEnabled: communicationSettings.sendingEnabled })
    .from(communicationSettings)
    .where(eq(communicationSettings.institutionId, context.institutionId))
    .limit(1);
  if (!settings?.sendingEnabled) {
    throw new HttpError(503, "L’envoi des communications n’est pas activé.");
  }
  return context;
}
