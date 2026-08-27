import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import { supportRequests } from "../../../../db/schema.js";
import { requireRole } from "../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

const AGENT_ROLES = ["superadmin", "administration", "proviseur"];
const VALID_STATUSES = new Set([
  "nouveau",
  "a_qualifier",
  "assigne",
  "en_cours",
  "attente_demandeur",
  "attente_interne",
  "resolu",
  "clos",
  "indesirable",
]);
const VALID_SERVICES = new Set([
  "referent_numerique",
  "secretariat",
  "vie_scolaire",
  "intendance",
  "direction",
  "administration",
]);

function queryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  return handleApi(res, async () => {
    const user = await requireRole(req, AGENT_ROLES);
    const page = Math.max(1, Number.parseInt(queryValue(req.query.page), 10) || 1);
    const pageSize = Math.min(50, Math.max(10, Number.parseInt(queryValue(req.query.pageSize), 10) || 30));
    const search = queryValue(req.query.q).trim().slice(0, 80);
    const status = queryValue(req.query.status);
    const urgentOnly = queryValue(req.query.urgent) === "true";
    const mineOnly = queryValue(req.query.assigned) === "me";
    const service = queryValue(req.query.service);
    const filters: SQL[] = [];
    const serviceFilter = VALID_SERVICES.has(service)
      ? eq(supportRequests.assignedTeam, service)
      : undefined;

    if (search) {
      const pattern = `%${search.replace(/[%_]/g, "\\$&")}%`;
      const searchFilter = or(
        ilike(supportRequests.publicCode, pattern),
        ilike(supportRequests.requesterFirstName, pattern),
        ilike(supportRequests.requesterLastName, pattern),
        ilike(supportRequests.subject, pattern)
      );
      if (searchFilter) filters.push(searchFilter);
    }
    if (VALID_STATUSES.has(status)) filters.push(eq(supportRequests.status, status));
    if (urgentOnly) filters.push(sql`${supportRequests.priority} in ('p1', 'p2')`);
    if (mineOnly) filters.push(eq(supportRequests.assignedTo, user.id));
    if (serviceFilter) filters.push(serviceFilter);

    const where = filters.length > 0 ? and(...filters) : undefined;
    const requestQuery = db
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
        assignedTeam: supportRequests.assignedTeam,
        slaDueAt: supportRequests.slaDueAt,
        createdAt: supportRequests.createdAt,
        updatedAt: supportRequests.updatedAt,
      })
      .from(supportRequests)
      .where(where)
      .orderBy(
        sql`case ${supportRequests.priority} when 'p1' then 1 when 'p2' then 2 when 'p3' then 3 else 4 end`,
        desc(supportRequests.createdAt)
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const totalQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(supportRequests)
      .where(where);

    const statsQuery = db.select({
      total: sql<number>`count(*)::int`,
      new: sql<number>`count(*) filter (where ${supportRequests.status} in ('nouveau', 'a_qualifier'))::int`,
      urgent: sql<number>`count(*) filter (where ${supportRequests.priority} in ('p1', 'p2') and ${supportRequests.status} <> 'clos')::int`,
      active: sql<number>`count(*) filter (where ${supportRequests.status} in ('assigne', 'en_cours', 'attente_interne'))::int`,
      waitingRequester: sql<number>`count(*) filter (where ${supportRequests.status} = 'attente_demandeur')::int`,
    }).from(supportRequests).where(serviceFilter);

    const [requests, [totalRow], [statsRow]] = await Promise.all([requestQuery, totalQuery, statsQuery]);
    const total = totalRow?.count ?? 0;

    return {
      requests,
      stats: statsRow ?? { total: 0, new: 0, urgent: 0, active: 0, waitingRequester: 0 },
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  });
}
