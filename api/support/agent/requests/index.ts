import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, sql } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import { supportRequests } from "../../../../db/schema.js";
import { requireRole } from "../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

const AGENT_ROLES = ["superadmin", "administration", "proviseur"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  return handleApi(res, async () => {
    await requireRole(req, AGENT_ROLES);
    const requests = await db
      .select({
        publicCode: supportRequests.publicCode,
        requesterType: supportRequests.requesterType,
        requesterFirstName: supportRequests.requesterFirstName,
        requesterLastName: supportRequests.requesterLastName,
        beneficiaryType: supportRequests.beneficiaryType,
        beneficiaryFirstName: supportRequests.beneficiaryFirstName,
        beneficiaryLastName: supportRequests.beneficiaryLastName,
        subjectContext: supportRequests.subjectContext,
        category: supportRequests.category,
        subject: supportRequests.subject,
        status: supportRequests.status,
        priority: supportRequests.priority,
        assignedTo: supportRequests.assignedTo,
        slaDueAt: supportRequests.slaDueAt,
        createdAt: supportRequests.createdAt,
        updatedAt: supportRequests.updatedAt,
      })
      .from(supportRequests)
      .orderBy(
        sql`case ${supportRequests.priority} when 'p1' then 1 when 'p2' then 2 when 'p3' then 3 else 4 end`,
        desc(supportRequests.createdAt)
      )
      .limit(200);

    const stats = {
      new: requests.filter((request) => ["nouveau", "a_qualifier"].includes(request.status)).length,
      urgent: requests.filter((request) => ["p1", "p2"].includes(request.priority) && request.status !== "clos").length,
      active: requests.filter((request) => ["assigne", "en_cours", "attente_interne"].includes(request.status)).length,
      waitingRequester: requests.filter((request) => request.status === "attente_demandeur").length,
    };

    return { requests, stats };
  });
}
