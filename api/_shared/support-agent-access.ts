import type { VercelRequest } from "@vercel/node";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { institutionMemberships, institutions } from "../../db/schema.js";
import type { AuthUser } from "./auth.js";
import { HttpError, requireRole } from "./auth.js";
import {
  canAccessSupportService,
  canTransferSupportRequest,
  resolvePersistedSupportAgentAccess,
  resolveSupportAgentAccess,
  type SupportAgentAccess,
} from "../../shared/support-agent-access.js";
import { requireConfiguredInstitution } from "./institution-context.js";

const SUPPORT_AGENT_ROLES = ["superadmin", "administration", "agent", "proviseur"] as const;
export type SupportAgentContext = {
  user: AuthUser;
  access: SupportAgentAccess;
  institutionId: string;
};

export async function requireSupportAgent(
  req: VercelRequest
): Promise<SupportAgentContext> {
  const user = await requireRole(req, SUPPORT_AGENT_ROLES);
  const membershipSource = (process.env.SUPPORT_MEMBERSHIP_SOURCE ?? "metadata")
    .trim()
    .toLowerCase();
  const institution = await requireConfiguredInstitution();

  let access: SupportAgentAccess | null;
  if (membershipSource === "metadata") {
    access = resolveSupportAgentAccess(user.role, user.appMetadata);
  } else if (membershipSource === "database") {
    try {
      const [membership] = await db
        .select({
          role: institutionMemberships.role,
          serviceCodes: institutionMemberships.serviceCodes,
          status: institutionMemberships.status,
          institutionStatus: institutions.status,
        })
        .from(institutionMemberships)
        .innerJoin(institutions, eq(institutionMemberships.institutionId, institutions.id))
        .where(
          and(
            eq(institutionMemberships.userId, user.id),
            eq(institutionMemberships.status, "active"),
            eq(institutions.id, institution.id),
            inArray(institutions.status, ["pilot", "active"])
          )
        )
        .limit(1);
      access = resolvePersistedSupportAgentAccess(user.role, membership ?? null);
    } catch {
      throw new HttpError(
        503,
        "La vérification du périmètre agent est momentanément indisponible."
      );
    }
  } else {
    throw new HttpError(503, "La source des périmètres agents est mal configurée.");
  }

  if (!access) {
    throw new HttpError(403, "Aucun service actif n'est associé à ce compte agent");
  }
  return { user, access, institutionId: institution.id };
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
