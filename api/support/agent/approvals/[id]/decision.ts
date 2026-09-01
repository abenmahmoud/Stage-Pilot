import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import { parseAgentApprovalDecision } from "../../../../../shared/agent-approval-input.js";
import { isAgentApprovalDecisionPayload } from "../../../../../shared/agent-approval-payload-policy.js";
import {
  agentApprovalRouteId,
  requireAgentApprovalReviewer,
} from "../../../../_shared/agent-approvals.js";
import { HttpError } from "../../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

type DecisionRow = {
  result_approval_id: string;
  result_action_id: string;
  result_status: "approved" | "rejected" | "expired";
  result_decided_at: Date | string;
};

function decisionInput(body: unknown) {
  try {
    return parseAgentApprovalDecision(body);
  } catch (error) {
    throw new HttpError(
      400,
      error instanceof Error ? error.message : "La décision est invalide."
    );
  }
}

function isPolicyConflict(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P0001"
  );
}

function decisionPayload(
  value: unknown,
  expected: { approvalId: string; status: "approved" | "rejected" }
) {
  if (!isAgentApprovalDecisionPayload(value, expected)) {
    throw new HttpError(503, "Confirmation de validation invalide.");
  }
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  return handleApi(res, async () => {
    const context = await requireAgentApprovalReviewer(req);
    const approvalId = agentApprovalRouteId(req);
    const input = decisionInput(req.body);
    let result: DecisionRow[];
    try {
      const rows = await db.execute(sql<DecisionRow>`
        select *
        from public.agent_decide_approval(
          ${approvalId}::uuid,
          ${context.institutionId}::uuid,
          ${context.user.id}::uuid,
          ${context.decisionRole}::text,
          ${context.access.serviceCodes}::text[],
          ${context.access.canViewAll}::boolean,
          ${input.decision}::text,
          ${input.reason}::text
        )
      `);
      result = Array.from(rows as unknown as DecisionRow[]);
    } catch (error) {
      if (isPolicyConflict(error)) {
        throw new HttpError(
          409,
          "Cette validation a expiré, a déjà été traitée ou ne relève pas de votre périmètre."
        );
      }
      throw error;
    }
    const decision = result[0];
    if (!decision) throw new HttpError(409, "La décision n’a pas été enregistrée.");
    if (decision.result_status === "expired") {
      throw new HttpError(409, "Cette validation vient d’expirer et a été fermée.");
    }
    return decisionPayload({
      approvalId: decision.result_approval_id,
      status: decision.result_status,
      decidedAt: new Date(decision.result_decided_at).toISOString(),
    }, { approvalId, status: input.decision });
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
