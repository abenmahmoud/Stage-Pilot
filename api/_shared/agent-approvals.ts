import type { VercelRequest } from "@vercel/node";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { institutionMemberships, institutions } from "../../db/schema.js";
import {
  resolveAgentApprovalRole,
  type AgentApprovalRole,
} from "../../shared/agent-approval-input.js";
import { resolvePersistedSupportAgentAccess } from "../../shared/support-agent-access.js";
import { HttpError, requireAal2 } from "./auth.js";
import {
  requireSupportAgent,
  type SupportAgentContext,
} from "./support-agent-access.js";

const DEFAULT_INSTITUTION_SLUG = "blaise-cendrars-sevran";

export type AgentApprovalReviewerContext = SupportAgentContext & {
  institutionId: string;
  decisionRole: AgentApprovalRole;
};

export async function requireAgentApprovalReviewer(
  req: VercelRequest
): Promise<AgentApprovalReviewerContext> {
  const authenticated = await requireSupportAgent(req);
  await requireAal2(req);
  const slug = process.env.SUPPORT_INSTITUTION_SLUG?.trim() || DEFAULT_INSTITUTION_SLUG;
  const [membership] = await db
    .select({
      institutionId: institutions.id,
      institutionStatus: institutions.status,
      role: institutionMemberships.role,
      serviceCodes: institutionMemberships.serviceCodes,
      status: institutionMemberships.status,
    })
    .from(institutionMemberships)
    .innerJoin(institutions, eq(institutionMemberships.institutionId, institutions.id))
    .where(
      and(
        eq(institutionMemberships.userId, authenticated.user.id),
        eq(institutionMemberships.status, "active"),
        eq(institutions.slug, slug),
        inArray(institutions.status, ["pilot", "active"])
      )
    )
    .limit(1);
  if (!membership) {
    throw new HttpError(403, "Aucune habilitation active ne permet de valider une action.");
  }

  const access = resolvePersistedSupportAgentAccess(
    authenticated.user.role,
    membership
  );
  const decisionRole = resolveAgentApprovalRole(
    authenticated.user.role,
    membership.role
  );
  if (!access || !decisionRole) {
    throw new HttpError(403, "Ce compte ne possède pas de rôle de validation actif.");
  }

  return {
    user: authenticated.user,
    access,
    institutionId: membership.institutionId,
    decisionRole,
  };
}

export function agentApprovalRouteId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new HttpError(400, "Validation invalide.");
  }
  return value;
}
