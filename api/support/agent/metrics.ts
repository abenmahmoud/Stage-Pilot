import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { agentRuntimeMetrics, institutions, supportEvents } from "../../../db/schema.js";
import { HttpError } from "../../_shared/auth.js";
import { requireAgentApprovalReviewer } from "../../_shared/agent-approvals.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

function requestedDays(req: VercelRequest): 7 | 30 {
  const value = Array.isArray(req.query.days) ? req.query.days[0] : req.query.days;
  if (value === undefined || value === "7") return 7;
  if (value === "30") return 30;
  throw new HttpError(400, "Période de mesure invalide.");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  return handleApi(res, async () => {
    const context = await requireAgentApprovalReviewer(req);
    if (
      !context.access.canViewAll ||
      (context.decisionRole !== "direction" && context.decisionRole !== "superadmin")
    ) {
      throw new HttpError(403, "Les mesures globales de l’agent sont réservées à la direction.");
    }
    const days = requestedDays(req);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [supportScope] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(institutions)
      .where(inArray(institutions.status, ["pilot", "active"]));
    if ((supportScope?.count ?? 0) !== 1) {
      throw new HttpError(
        503,
        "Les mesures de routage attendent le cloisonnement des demandes par établissement."
      );
    }
    const scope = and(
      eq(agentRuntimeMetrics.institutionId, context.institutionId),
      gte(agentRuntimeMetrics.createdAt, since)
    );

    const [summary] = await db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        aiAttempts: sql<number>`count(*) filter (where ${agentRuntimeMetrics.aiAttempted})`.mapWith(Number),
        aiSuccesses: sql<number>`count(*) filter (where ${agentRuntimeMetrics.usedAi})`.mapWith(Number),
        averageLatencyMs: sql<number>`coalesce(round(avg(${agentRuntimeMetrics.latencyMs})), 0)`.mapWith(Number),
        p95LatencyMs: sql<number>`coalesce(round(percentile_cont(0.95) within group (order by ${agentRuntimeMetrics.latencyMs})), 0)`.mapWith(Number),
        inputTokens: sql<number>`coalesce(sum(${agentRuntimeMetrics.inputTokens}), 0)`.mapWith(Number),
        outputTokens: sql<number>`coalesce(sum(${agentRuntimeMetrics.outputTokens}), 0)`.mapWith(Number),
        totalTokens: sql<number>`coalesce(sum(${agentRuntimeMetrics.totalTokens}), 0)`.mapWith(Number),
        estimatedCostMicros: sql<number>`coalesce(sum(${agentRuntimeMetrics.estimatedCostMicros}), 0)`.mapWith(Number),
        pricedRuns: sql<number>`count(*) filter (where ${agentRuntimeMetrics.estimatedCostMicros} is not null)`.mapWith(Number),
        pricingConfiguredRuns: sql<number>`count(*) filter (where ${agentRuntimeMetrics.pricingConfigured})`.mapWith(Number),
      })
      .from(agentRuntimeMetrics)
      .where(scope);

    const outcomes = await db
      .select({
        outcome: agentRuntimeMetrics.outcome,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(agentRuntimeMetrics)
      .where(scope)
      .groupBy(agentRuntimeMetrics.outcome)
      .orderBy(asc(agentRuntimeMetrics.outcome));

    const [routing] = await db
      .select({
        serviceChanges: sql<number>`count(*) filter (
          where ${supportEvents.eventType} = 'request.updated'
            and ${supportEvents.actorType} = 'agent'
            and coalesce(${supportEvents.fromValue} ->> 'assignedTeam', '')
              is distinct from coalesce(${supportEvents.toValue} ->> 'assignedTeam', '')
        )`.mapWith(Number),
        routingCorrections: sql<number>`count(*) filter (
          where ${supportEvents.eventType} = 'request.updated'
            and ${supportEvents.actorType} = 'agent'
            and nullif(${supportEvents.fromValue} ->> 'assignedTeam', '') is not null
            and nullif(${supportEvents.toValue} ->> 'assignedTeam', '') is not null
            and (${supportEvents.fromValue} ->> 'assignedTeam')
              is distinct from (${supportEvents.toValue} ->> 'assignedTeam')
        )`.mapWith(Number),
      })
      .from(supportEvents)
      .where(gte(supportEvents.createdAt, since));

    const daily = await db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${agentRuntimeMetrics.createdAt} at time zone 'Europe/Paris'), 'YYYY-MM-DD')`,
        total: sql<number>`count(*)`.mapWith(Number),
        aiSuccesses: sql<number>`count(*) filter (where ${agentRuntimeMetrics.usedAi})`.mapWith(Number),
        averageLatencyMs: sql<number>`coalesce(round(avg(${agentRuntimeMetrics.latencyMs})), 0)`.mapWith(Number),
      })
      .from(agentRuntimeMetrics)
      .where(scope)
      .groupBy(sql`date_trunc('day', ${agentRuntimeMetrics.createdAt} at time zone 'Europe/Paris')`)
      .orderBy(sql`date_trunc('day', ${agentRuntimeMetrics.createdAt} at time zone 'Europe/Paris')`);

    return {
      generatedAt: new Date(),
      days,
      summary: {
        total: summary?.total ?? 0,
        aiAttempts: summary?.aiAttempts ?? 0,
        aiSuccesses: summary?.aiSuccesses ?? 0,
        localOrFallback: Math.max(0, (summary?.total ?? 0) - (summary?.aiSuccesses ?? 0)),
        averageLatencyMs: summary?.averageLatencyMs ?? 0,
        p95LatencyMs: summary?.p95LatencyMs ?? 0,
        inputTokens: summary?.inputTokens ?? 0,
        outputTokens: summary?.outputTokens ?? 0,
        totalTokens: summary?.totalTokens ?? 0,
        estimatedCostMicros: summary?.estimatedCostMicros ?? 0,
        pricedRuns: summary?.pricedRuns ?? 0,
        pricingConfigured: (summary?.pricingConfiguredRuns ?? 0) > 0,
        pricingComplete:
          (summary?.aiSuccesses ?? 0) > 0 &&
          (summary?.pricedRuns ?? 0) === (summary?.aiSuccesses ?? 0),
        serviceChanges: routing?.serviceChanges ?? 0,
        routingCorrections: routing?.routingCorrections ?? 0,
        routingCorrectionRate:
          (routing?.serviceChanges ?? 0) > 0
            ? Math.round(
                ((routing?.routingCorrections ?? 0) / (routing?.serviceChanges ?? 1)) * 1000
              ) / 10
            : 0,
      },
      outcomes,
      daily,
    };
  });
}
