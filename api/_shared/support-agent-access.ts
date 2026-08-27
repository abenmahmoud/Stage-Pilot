import type { VercelRequest } from "@vercel/node";
import type { AuthUser } from "./auth.js";
import { HttpError, requireRole } from "./auth.js";
import {
  canAccessSupportService,
  canTransferSupportRequest,
  resolveSupportAgentAccess,
  type SupportAgentAccess,
} from "../../shared/support-agent-access.js";

const SUPPORT_AGENT_ROLES = ["superadmin", "administration", "agent", "proviseur"] as const;

export type SupportAgentContext = {
  user: AuthUser;
  access: SupportAgentAccess;
};

export async function requireSupportAgent(
  req: VercelRequest
): Promise<SupportAgentContext> {
  const user = await requireRole(req, SUPPORT_AGENT_ROLES);
  const access = resolveSupportAgentAccess(user.role, user.appMetadata);
  if (!access) {
    throw new HttpError(403, "Aucun service actif n'est associé à ce compte agent");
  }
  return { user, access };
}

export function assertSupportRequestAccess(
  access: SupportAgentAccess,
  assignedTeam: string | null
): void {
  if (!canAccessSupportService(access, assignedTeam)) {
    throw new HttpError(403, "Cette demande appartient à un autre service");
  }
}

export function assertSupportTransferAccess(
  access: SupportAgentAccess,
  currentTeam: string | null,
  nextTeam: string | null
): void {
  if (!canTransferSupportRequest(access, currentTeam, nextTeam)) {
    throw new HttpError(403, "Seule la direction peut transférer une demande entre services");
  }
}
