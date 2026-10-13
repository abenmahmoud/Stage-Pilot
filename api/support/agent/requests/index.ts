import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, eq, ilike, inArray, isNull, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import { supportCallbackTasks, supportEvents, supportRequests } from "../../../../db/schema.js";
import { HttpError } from "../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";
import { requireSupportAgent } from "../../../_shared/support-agent-access.js";
import { officeArchiveFilter, officeRequestScopeFilter } from "../../../_shared/support-office-archive.js";
import { boardExcerpt, suggestedTeamAction, TEAM_INSTRUCTION_PREFIX } from "../../../../shared/support-action-board.js";
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
const VALID_CATEGORIES = new Set([
  "inscription", "affectation_classe", "documents_scolarite", "ent",
  "email_academique", "ordinateur", "logiciel", "restauration_bourse",
  "orientation_formation", "vie_scolaire", "autre",
]);
const UNASSIGNED_SERVICE_FILTER = "unassigned";
const CLOSED_STATUSES = ["resolu", "clos", "indesirable"];
const ACTIVE_STATUSES = ["assigne", "en_cours", "attente_interne"];
const VALID_QUEUE_STATES = new Set(["open", "active", "completed"]);
const VALID_REQUEST_SCOPES = new Set(["equipment", "digital"]);

function queueStateFilter(state: string): SQL | undefined {
  if (state === "open") return notInArray(supportRequests.status, CLOSED_STATUSES);
  if (state === "active") return inArray(supportRequests.status, ACTIVE_STATUSES);
  if (state === "completed") return inArray(supportRequests.status, CLOSED_STATUSES);
  return undefined;
}

function requestScopeFilter(scope: string): SQL | undefined {
  if (scope === "equipment") {
    return and(
      eq(supportRequests.category, "ordinateur"),
      eq(supportRequests.subcategory, "materiel_lycee")
    );
  }
  if (scope === "digital") {
    return and(
      eq(supportRequests.category, "ordinateur"),
      or(
        isNull(supportRequests.subcategory),
        ne(supportRequests.subcategory, "materiel_lycee")
      )
    );
  }
  return undefined;
}

// Les sous-requetes correlees ci-dessous alias(ent) explicitement leur table et
// qualifient la reference vers la demande englobante. Sans cela, la colonne
// "id" non qualifiee est resolue par PostgreSQL sur la table interne :
// la correlation devient fausse pour les rappels (comparaison uuid = uuid
// silencieusement incorrecte) et provoque une erreur "operator does not exist:
// uuid = bigint" pour les evenements, dont l'identifiant est un bigint.
function hasPendingCallback(): SQL<boolean> {
  return sql<boolean>`exists (
    select 1 from ${supportCallbackTasks} as cbt
    where cbt."request_id" = "support_requests"."id"
      and cbt."status" in ('todo', 'in_progress')
  )`;
}

function hasPendingDuplicateReview(): SQL<boolean> {
  // coalesce : sans evenement de doublon la sous-requete ne renvoie aucune ligne,
  // la comparaison vaut alors NULL et le contrat navigateur, qui exige un
  // booleen strict, rejette toute la file.
  return sql<boolean>`coalesce((
    select evt."event_type"
    from ${supportEvents} as evt
    where evt."request_id" = "support_requests"."id"
      and evt."event_type" in (
        'request.duplicate_suspected',
        'request.duplicate_confirmed',
        'request.duplicate_dismissed'
      )
    order by evt."created_at" desc, evt."id" desc
    limit 1
  ) = 'request.duplicate_suspected', false)`;
}

function queryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    if (value.length !== 1) throw new HttpError(400, "Paramètre répété");
    return value[0] ?? "";
  }
  return value ?? "";
}

function boundedIntegerQuery(
  value: string,
  fallback: number,
  minimum: number,
  maximum: number,
  errorMessage: string
): number {
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) throw new HttpError(400, errorMessage);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new HttpError(400, errorMessage);
  }
  return parsed;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  return handleApi(res, async () => {
    const { user, access, institutionId } = await requireSupportAgent(req);
    const page = boundedIntegerQuery(queryValue(req.query.page), 1, 1, 10_000, "Page invalide");
    const pageSize = boundedIntegerQuery(queryValue(req.query.pageSize), 30, 10, 50, "Taille de page invalide");
    const searchValue = queryValue(req.query.q).trim();
    if (searchValue.length > 80) throw new HttpError(400, "Recherche trop longue");
    const search = searchValue;
    const status = queryValue(req.query.status);
    const urgent = queryValue(req.query.urgent);
    const assigned = queryValue(req.query.assigned);
    if (status && !VALID_STATUSES.has(status)) {
      throw new HttpError(400, "Statut invalide");
    }
    if (assigned && assigned !== "me" && assigned !== "none") {
      throw new HttpError(400, "Attribution invalide");
    }
    if (urgent && urgent !== "true") {
      throw new HttpError(400, "Filtre d'urgence invalide");
    }
    const callback = queryValue(req.query.callback);
    const duplicate = queryValue(req.query.duplicate);
    const overdue = queryValue(req.query.overdue);
    if (callback && callback !== "pending") {
      throw new HttpError(400, "Filtre de rappel invalide");
    }
    if (duplicate && duplicate !== "pending") {
      throw new HttpError(400, "Filtre de doublon invalide");
    }
    if (overdue && overdue !== "true") {
      throw new HttpError(400, "Filtre d'échéance invalide");
    }
    const urgentOnly = urgent === "true";
    const mineOnly = assigned === "me";
    const unassignedOnly = assigned === "none";
    const callbackOnly = callback === "pending";
    const duplicateOnly = duplicate === "pending";
    const overdueOnly = overdue === "true";
    const service = queryValue(req.query.service);
    const category = queryValue(req.query.category);
    const state = queryValue(req.query.state);
    const scope = queryValue(req.query.scope);
    const archive = queryValue(req.query.archived);
    const view = queryValue(req.query.view);
    if (view && view !== "actions") throw new HttpError(400, "Vue de demandes invalide");
    if (archive && !["only", "include"].includes(archive)) throw new HttpError(400, "Filtre d’archives invalide");
    const archiveFilter = officeArchiveFilter(archive);
    const officeScopeFilter = officeRequestScopeFilter(scope, category);
    if (state && !VALID_QUEUE_STATES.has(state)) {
      throw new HttpError(400, "État de file invalide");
    }
    if (scope && !VALID_REQUEST_SCOPES.has(scope)) {
      throw new HttpError(400, "Périmètre de demande invalide");
    }
    if (scope && category) {
      throw new HttpError(400, "Les filtres de type de demande sont incompatibles");
    }
    if (category && !VALID_CATEGORIES.has(category)) {
      throw new HttpError(400, "Catégorie invalide");
    }
    const ddfptEquipmentCollaboration = (category === "ordinateur" || scope === "equipment")
      && access.serviceCodes.includes("ddfpt");
    const filters: SQL[] = [eq(supportRequests.institutionId, institutionId)];
    if (archiveFilter) filters.push(archiveFilter);
    if (officeScopeFilter) filters.push(officeScopeFilter);
    const accessFilter = access.canViewAll
      ? undefined
      : ddfptEquipmentCollaboration
        ? or(
            inArray(supportRequests.assignedTeam, access.serviceCodes),
            and(
              eq(supportRequests.category, "ordinateur"),
              eq(supportRequests.assignedTeam, "referent_numerique")
            )
          )
        : inArray(supportRequests.assignedTeam, access.serviceCodes);
    if (accessFilter) filters.push(accessFilter);
    if (service && !VALID_SERVICES.has(service) && service !== UNASSIGNED_SERVICE_FILTER) {
      throw new HttpError(400, "Service invalide");
    }
    if (
      service &&
      !access.canViewAll &&
      (
        service === UNASSIGNED_SERVICE_FILTER
        || (
          !access.serviceCodes.includes(service as SupportService)
          && !(ddfptEquipmentCollaboration && service === "referent_numerique")
        )
      )
    ) {
      throw new HttpError(403, "Ce service n'appartient pas à votre périmètre");
    }
    const serviceFilter = service === UNASSIGNED_SERVICE_FILTER
      ? isNull(supportRequests.assignedTeam)
      : VALID_SERVICES.has(service)
        ? eq(supportRequests.assignedTeam, service)
        : undefined;
    const stateFilter = view === "actions" && state === "active"
      ? or(queueStateFilter(state), and(notInArray(supportRequests.status, CLOSED_STATUSES), hasPendingCallback()))
      : queueStateFilter(state);
    const scopeFilter = requestScopeFilter(scope);

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
    if (stateFilter) filters.push(stateFilter);
    if (urgentOnly) filters.push(sql`${supportRequests.priority} in ('p1', 'p2') and ${supportRequests.status} not in ('resolu', 'clos', 'indesirable')`);
    if (mineOnly) filters.push(eq(supportRequests.assignedTo, user.id));
    if (unassignedOnly) filters.push(sql`${supportRequests.assignedTo} is null and ${supportRequests.status} not in ('resolu', 'clos', 'indesirable')`);
    if (callbackOnly) filters.push(hasPendingCallback());
    if (duplicateOnly) filters.push(hasPendingDuplicateReview());
    if (overdueOnly) {
      filters.push(sql`${supportRequests.slaDueAt} < now() and ${supportRequests.status} not in ('resolu', 'clos', 'indesirable')`);
    }
    if (serviceFilter) filters.push(serviceFilter);
    if (category) filters.push(eq(supportRequests.category, category));
    if (scopeFilter) filters.push(scopeFilter);

    const where = filters.length > 0 ? and(...filters) : undefined;
    // Same institution, service, archive and SPIE restrictions as the full queue.
    // The team view deliberately excludes contacts, attachments, secrets and full history.
    if (view === "actions") {
      const rows = await db.select({
        publicCode: supportRequests.publicCode,
        personFirst: supportRequests.requesterFirstName, personLast: supportRequests.requesterLastName,
        subject: supportRequests.subject, description: supportRequests.description,
        category: supportRequests.category, subcategory: supportRequests.subcategory,
        status: supportRequests.status, priority: supportRequests.priority,
        service: supportRequests.assignedTeam,
        createdAt: supportRequests.createdAt, updatedAt: supportRequests.updatedAt,
        callbackPending: hasPendingCallback(),
        latestInbound: sql<string | null>`(select m.body_text from support_messages m where m.request_id = "support_requests"."id" and m.direction = 'inbound' order by m.created_at desc, m.id desc limit 1)`,
        instruction: sql<string | null>`(select m.body_text from support_messages m where m.request_id = "support_requests"."id" and m.direction = 'internal' and m.body_text like ${TEAM_INSTRUCTION_PREFIX + '%'} order by m.created_at desc, m.id desc limit 1)`,
        instructionAt: sql<string | null>`(select m.created_at::text from support_messages m where m.request_id = "support_requests"."id" and m.direction = 'internal' and m.body_text like ${TEAM_INSTRUCTION_PREFIX + '%'} order by m.created_at desc, m.id desc limit 1)`,
      }).from(supportRequests).where(where)
        .orderBy(sql`case ${supportRequests.priority} when 'p1' then 1 when 'p2' then 2 else 3 end`, asc(supportRequests.createdAt))
        .limit(pageSize).offset((page - 1) * pageSize);
      const [totalRow] = await db.select({ count: sql<number>`count(*)::int` }).from(supportRequests).where(where);
      const total = totalRow?.count ?? 0;
      return {
        rows: rows.map(row => {
          const instruction = row.instruction ? boardExcerpt(row.instruction.slice(TEAM_INSTRUCTION_PREFIX.length), 1000) || null : null;
          return {
            publicCode: row.publicCode, person: boardExcerpt(`${row.personFirst} ${row.personLast}`, 220),
            subject: boardExcerpt(row.subject, 180), problem: boardExcerpt(row.latestInbound || row.description),
            service: row.service, status: row.status, urgent: ['p1', 'p2'].includes(row.priority),
            createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
            callbackPending: row.callbackPending, instruction, instructionAt: instruction && row.instructionAt ? new Date(row.instructionAt).toISOString() : null,
            action: CLOSED_STATUSES.includes(row.status)
              ? suggestedTeamAction({ ...row, problem: row.latestInbound || row.description })
              : instruction || suggestedTeamAction({ ...row, problem: row.latestInbound || row.description }),
          };
        }), access, generatedAt: new Date().toISOString(),
        pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      };
    }
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
      archiveFilter,
      officeScopeFilter,
      accessFilter,
      serviceFilter,
      category ? eq(supportRequests.category, category) : undefined,
      scopeFilter,
    ].filter((value): value is SQL => Boolean(value));
    const statsQuery = db.select({
      total: sql<number>`count(*)::int`,
      open: sql<number>`count(*) filter (where ${supportRequests.status} not in ('resolu', 'clos', 'indesirable'))::int`,
      completed: sql<number>`count(*) filter (where ${supportRequests.status} in ('resolu', 'clos', 'indesirable'))::int`,
      new: sql<number>`count(*) filter (where ${supportRequests.status} in ('nouveau', 'a_qualifier'))::int`,
      qualify: sql<number>`count(*) filter (where ${supportRequests.status} = 'a_qualifier')::int`,
      urgent: sql<number>`count(*) filter (where ${supportRequests.priority} in ('p1', 'p2') and ${supportRequests.status} not in ('resolu', 'clos', 'indesirable'))::int`,
      active: sql<number>`count(*) filter (where ${supportRequests.status} in ('assigne', 'en_cours', 'attente_interne'))::int`,
      waitingRequester: sql<number>`count(*) filter (where ${supportRequests.status} = 'attente_demandeur')::int`,
      waitingInternal: sql<number>`count(*) filter (where ${supportRequests.status} = 'attente_interne')::int`,
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
      .where(and(eq(supportRequests.institutionId, institutionId), accessFilter, archiveFilter, officeScopeFilter, scopeFilter))
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
      stats: statsRow ?? { total: 0, open: 0, completed: 0, new: 0, qualify: 0, urgent: 0, active: 0, waitingRequester: 0, waitingInternal: 0, unassigned: 0, overdue: 0, callbacks: 0, duplicates: 0 },
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  });
}
