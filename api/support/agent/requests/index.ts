import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import { supportCallbackTasks, supportEvents, supportRequests } from "../../../../db/schema.js";
import { HttpError } from "../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";
import { requireSupportAgent } from "../../../_shared/support-agent-access.js";
import {
  SUPPORT_SERVICES,
  type SupportService,
} from "../../../../shared/support-agent-access.js";

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
const VALID_SERVICES = new Set<string>(SUPPORT_SERVICES);
const UNASSIGNED_SERVICE_FILTER = "unassigned";

function hasPendingCallback(): SQL<boolean> {
  return sql<boolean>`exists (
    select 1 from ${supportCallbackTasks}
    where ${supportCallbackTasks.requestId} = ${supportRequests.id}
      and ${supportCallbackTasks.status} in ('todo', 'in_progress')
  )`;
}

function hasPendingDuplicateReview(): SQL<boolean> {
  return sql<boolean>`(
    select ${supportEvents.eventType}
    from ${supportEvents}
    where ${supportEvents.requestId} = ${supportRequests.id}
      and ${supportEvents.eventType} in (
        'request.duplicate_suspected',
        'request.duplicate_confirmed',
        'request.duplicate_dismissed'
      )
    order by ${supportEvents.createdAt} desc, ${supportEvents.id} desc
    limit 1
  ) = 'request.duplicate_suspected'`;
}

function queryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  return handleApi(res, async () => {
    const { user, access, institutionId } = await requireSupportAgent(req);
    const page = Math.max(1, Number.parseInt(queryValue(req.query.page), 10) || 1);
    const pageSize = Math.min(50, Math.max(10, Number.parseInt(queryValue(req.query.pageSize), 10) || 30));
    const search = queryValue(req.query.q).trim().slice(0, 80);
    const status = queryValue(req.query.status);
    const urgentOnly = queryValue(req.query.urgent) === "true";
    const mineOnly = queryValue(req.query.assigned) === "me";
    const callbackOnly = queryValue(req.query.callback) === "pending";
    const duplicateOnly = queryValue(req.query.duplicate) === "pending";
    const overdueOnly = queryValue(req.query.overdue) === "true";
    const service = queryValue(req.query.service);
    const filters: SQL[] = [eq(supportRequests.institutionId, institutionId)];
    const accessFilter = access.canViewAll
      ? undefined
      : inArray(supportRequests.assignedTeam, access.serviceCodes);
    if (accessFilter) filters.push(accessFilter);
    if (service && !VALID_SERVICES.has(service) && service !== UNASSIGNED_SERVICE_FILTER) {
      throw new HttpError(400, "Service invalide");
    }
    if (
      service &&
      !access.canViewAll &&
      (service === UNASSIGNED_SERVICE_FILTER || !access.serviceCodes.includes(service as SupportService))
    ) {
      throw new HttpError(403, "Ce service n'appartient pas à votre périmètre");
    }
    const serviceFilter = service === UNASSIGNED_SERVICE_FILTER
      ? isNull(supportRequests.assignedTeam)
      : VALID_SERVICES.has(service)
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
    if (callbackOnly) filters.push(hasPendingCallback());
    if (duplicateOnly) filters.push(hasPendingDuplicateReview());
    if (overdueOnly) {
      filters.push(sql`${supportRequests.slaDueAt} < now() and ${supportRequests.status} not in ('resolu', 'clos', 'indesirable')`);
    }
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
        callbackPending: hasPendingCallback(),
        duplicatePending: hasPendingDuplicateReview(),
      })
      .from(supportRequests)
      .where(where)
      .orderBy(
        sql`case ${supportRequests.priority} when 'p1' then 1 when 'p2' then 2 when 'p3' then 3 else 4 end`,
        asc(supportRequests.slaDueAt),
        asc(supportRequests.createdAt)
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const totalQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(supportRequests)
      .where(where);

    const statsWhere = [
      eq(supportRequests.institutionId, institutionId),
      accessFilter,
      serviceFilter,
    ].filter((value): value is SQL => Boolean(value));
    const statsQuery = db.select({
      total: sql<number>`count(*)::int`,
      new: sql<number>`count(*) filter (where ${supportRequests.status} in ('nouveau', 'a_qualifier'))::int`,
      qualify: sql<number>`count(*) filter (where ${supportRequests.status} = 'a_qualifier')::int`,
      urgent: sql<number>`count(*) filter (where ${supportRequests.priority} in ('p1', 'p2') and ${supportRequests.status} not in ('resolu', 'clos', 'indesirable'))::int`,
      active: sql<number>`count(*) filter (where ${supportRequests.status} in ('assigne', 'en_cours', 'attente_interne'))::int`,
      waitingRequester: sql<number>`count(*) filter (where ${supportRequests.status} = 'attente_demandeur')::int`,
      unassigned: sql<number>`count(*) filter (where ${supportRequests.assignedTo} is null and ${supportRequests.status} not in ('resolu', 'clos', 'indesirable'))::int`,
      overdue: sql<number>`count(*) filter (where ${supportRequests.slaDueAt} < now() and ${supportRequests.status} not in ('resolu', 'clos', 'indesirable'))::int`,
      callbacks: sql<number>`count(*) filter (where ${hasPendingCallback()})::int`,
      duplicates: sql<number>`count(*) filter (where ${hasPendingDuplicateReview()})::int`,
    }).from(supportRequests).where(statsWhere.length ? and(...statsWhere) : undefined);

    const serviceStatsQuery = db
      .select({
        service: supportRequests.assignedTeam,
        open: sql<number>`count(*) filter (where ${supportRequests.status} not in ('resolu', 'clos', 'indesirable'))::int`,
        urgent: sql<number>`count(*) filter (where ${supportRequests.priority} in ('p1', 'p2') and ${supportRequests.status} not in ('resolu', 'clos', 'indesirable'))::int`,
        overdue: sql<number>`count(*) filter (where ${supportRequests.slaDueAt} < now() and ${supportRequests.status} not in ('resolu', 'clos', 'indesirable'))::int`,
        unassigned: sql<number>`count(*) filter (where ${supportRequests.assignedTo} is null and ${supportRequests.status} not in ('resolu', 'clos', 'indesirable'))::int`,
      })
      .from(supportRequests)
      .where(and(eq(supportRequests.institutionId, institutionId), accessFilter))
      .groupBy(supportRequests.assignedTeam);

    // The serverless database client intentionally owns one connection. Running
    // four statements concurrently can leave the queue waiting for that single
    // connection until the Vercel function times out, so execute them in order.
    const requests = await requestQuery;
    const [totalRow] = await totalQuery;
    const [statsRow] = await statsQuery;
    const serviceStats = await serviceStatsQuery;
    const total = totalRow?.count ?? 0;

    return {
      requests,
      access,
      serviceStats,
      stats: statsRow ?? { total: 0, new: 0, qualify: 0, urgent: 0, active: 0, waitingRequester: 0, unassigned: 0, overdue: 0, callbacks: 0, duplicates: 0 },
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  });
}
