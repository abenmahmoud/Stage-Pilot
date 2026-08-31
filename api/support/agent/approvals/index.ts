import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  agentActions,
  agentApprovals,
  agentSkills,
  agentSkillVersions,
} from "../../../../db/schema.js";
import {
  approvalIsExpired,
  canDecideAgentApproval,
  presentAgentActionInput,
} from "../../../../shared/agent-approval-input.js";
import {
  supportServiceLabel,
  type SupportService,
} from "../../../../shared/support-agent-access.js";
import { singleSupportAgentRouteValue } from "../../../../shared/support-agent-mutation-input-policy.js";
import { HttpError } from "../../../_shared/auth.js";
import { requireAgentApprovalReviewer } from "../../../_shared/agent-approvals.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

type ApprovalView = "pending" | "history" | "all";

function requestedView(req: VercelRequest): ApprovalView {
  const value = req.query.view === undefined
    ? undefined
    : singleSupportAgentRouteValue(req.query.view);
  if (value === undefined) return "pending";
  if (value === "pending" || value === "history" || value === "all") return value;
  throw new HttpError(400, "Vue de validation invalide.");
}

function roleLabel(role: string): string {
  if (role === "superadmin") return "Superadministration";
  if (role === "direction") return "Direction";
  if (role === "service_manager") return "Responsable de service";
  return "Agent habilité";
}

function toolLabel(toolKey: string): string {
  const labels: Record<string, string> = {
    "support.create_request": "Créer une demande",
    "support.send_reply": "Envoyer une réponse",
    "support.close_request": "Clôturer une demande",
    "support.transfer_request": "Transférer une demande",
    "content.publish": "Publier une information",
    "identity.confirm": "Confirmer une identité",
    "schedule.activate": "Activer un emploi du temps",
  };
  return labels[toolKey] ?? "Action préparée par l’agent";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  return handleApi(res, async () => {
    const context = await requireAgentApprovalReviewer(req);
    const view = requestedView(req);
    const now = new Date();
    await db.execute(sql`
      select public.agent_expire_approvals(
        ${context.institutionId}::uuid,
        ${context.access.serviceCodes}::text[],
        ${context.access.canViewAll}::boolean
      )
    `);
    const scope = context.access.canViewAll
      ? eq(agentActions.institutionId, context.institutionId)
      : and(
          eq(agentActions.institutionId, context.institutionId),
          inArray(agentActions.serviceCode, context.access.serviceCodes)
        );

    const rows = await db
      .select({
        approvalId: agentApprovals.id,
        serviceCode: agentActions.serviceCode,
        toolKey: agentActions.toolKey,
        inputRedacted: agentActions.inputRedacted,
        requestedByUserId: agentApprovals.requestedByUserId,
        requestedFromRole: agentApprovals.requestedFromRole,
        approvalStatus: agentApprovals.status,
        decisionReason: agentApprovals.decisionReason,
        requestedAt: agentApprovals.requestedAt,
        decidedAt: agentApprovals.decidedAt,
        expiresAt: agentApprovals.expiresAt,
        skillName: agentSkills.name,
        skillVersion: agentSkillVersions.version,
      })
      .from(agentApprovals)
      .innerJoin(agentActions, eq(agentApprovals.actionId, agentActions.id))
      .innerJoin(agentSkillVersions, eq(agentActions.skillVersionId, agentSkillVersions.id))
      .innerJoin(agentSkills, eq(agentSkillVersions.skillId, agentSkills.id))
      .where(scope)
      .orderBy(desc(agentApprovals.requestedAt))
      .limit(200);

    const allItems = rows.map((row) => {
      const serviceCode = row.serviceCode as SupportService;
      const effectiveStatus = approvalIsExpired(row.approvalStatus, row.expiresAt, now)
        ? "expired"
        : row.approvalStatus;
      return {
        id: row.approvalId,
        serviceCode,
        serviceLabel: supportServiceLabel(serviceCode),
        toolLabel: toolLabel(row.toolKey),
        skillName: row.skillName,
        skillVersion: row.skillVersion,
        status: effectiveStatus,
        requestedFromRole: roleLabel(row.requestedFromRole),
        requestedAt: row.requestedAt,
        decidedAt: row.decidedAt,
        expiresAt: row.expiresAt,
        decisionReason: row.decisionReason,
        requestedByMe: row.requestedByUserId === context.user.id,
        canDecide: canDecideAgentApproval({
          approvalStatus: row.approvalStatus,
          expiresAt: row.expiresAt,
          requestedFromRole: row.requestedFromRole,
          reviewerRole: context.decisionRole,
          requestedByUserId: row.requestedByUserId,
          reviewerUserId: context.user.id,
          serviceCode,
          allowedServices: context.access.serviceCodes,
          canViewAll: context.access.canViewAll,
          now,
        }),
        details: presentAgentActionInput(row.inputRedacted),
      };
    });
    const items = allItems.filter((item) => {
      if (view === "all") return true;
      if (view === "pending") return item.status === "pending";
      return item.status !== "pending";
    });

    return {
      generatedAt: now,
      reviewer: {
        role: roleLabel(context.decisionRole),
        services: context.access.serviceCodes.map((service) => ({
          code: service,
          label: supportServiceLabel(service),
        })),
        canViewAll: context.access.canViewAll,
      },
      summary: {
        pending: allItems.filter((item) => item.status === "pending").length,
        actionable: allItems.filter((item) => item.canDecide).length,
        decided: allItems.filter((item) =>
          ["approved", "rejected"].includes(item.status)
        ).length,
        expired: allItems.filter((item) => item.status === "expired").length,
      },
      items,
      truncated: rows.length === 200,
    };
  });
}
