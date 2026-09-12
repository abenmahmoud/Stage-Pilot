import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { requireRole, HttpError } from "../../_shared/auth.js";
import { requireSupportAgent } from "../../_shared/support-agent-access.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { AGENT_AI_BUDGET_OPERATIONS, readAgentAiBudgetConfig } from "../../../shared/agent-ai-budget.js";
import { AI_BUDGET_ROLES } from "../../../shared/management-navigation.js";
import { estimateAgentCostMicros } from "../../../shared/agent-runtime-metrics.js";
import { isAiBudgetOverview } from "../../../shared/ai-budget-overview.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  return handleApi(res, async () => {
    await requireRole(req, AI_BUDGET_ROLES);
    const { institutionId, access } = await requireSupportAgent(req);
    if (!access.canViewAll) throw new HttpError(403, "La supervision du budget est réservée au superadministrateur du lycée.");
    if (Object.keys(req.query ?? {}).length) throw new HttpError(400, "La consultation du budget n’accepte aucun filtre externe.");
    const configs = AGENT_AI_BUDGET_OPERATIONS.map(operation => readAgentAiBudgetConfig(operation));
    const guardStatus = configs.every(c => c.status === "enabled") ? "enabled"
      : configs.every(c => c.status === "disabled") ? "disabled" : "invalid";
    const limitMicros = configs[0].status === "enabled" ? configs[0].dailyLimitMicros : null;
    const model = process.env.OPENAI_BUDGET_PRICED_MODEL || process.env.OPENAI_SUPPORT_MODEL || "gpt-5.6-luna";
    const pricingConfigured = estimateAgentCostMicros({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }, {
      inputEurPerMillion: process.env.OPENAI_SUPPORT_INPUT_EUR_PER_MILLION_TOKENS,
      outputEurPerMillion: process.env.OPENAI_SUPPORT_OUTPUT_EUR_PER_MILLION_TOKENS,
    }).pricingConfigured;
    const inputRate = pricingConfigured ? Number(process.env.OPENAI_SUPPORT_INPUT_EUR_PER_MILLION_TOKENS) : 0;
    const outputRate = pricingConfigured ? Number(process.env.OPENAI_SUPPORT_OUTPUT_EUR_PER_MILLION_TOKENS) : 0;
    const rows = await db.execute(sql`
      with measured as (
        select operation, estimated_cost_micros is null as repriced,
          coalesce(estimated_cost_micros, case when ${pricingConfigured} and model=${model}
            and input_tokens is not null and output_tokens is not null
            then round(input_tokens * ${inputRate}::numeric + output_tokens * ${outputRate}::numeric)::bigint end) as cost
        from public.agent_runtime_metrics where institution_id=${institutionId}::uuid
          and ai_attempted and created_at >= clock_timestamp() - interval '30 days'
      ), operation_totals as (select operation, count(*)::int as calls, coalesce(sum(cost),0)::bigint as cost from measured group by operation)
      select jsonb_build_object(
        'today',jsonb_build_object(
          'day',(clock_timestamp() at time zone 'Europe/Paris')::date::text,
          'committedMicros',coalesce((select reserved_micros from public.agent_ai_budget_days where budget_key='openai' and budget_day=(clock_timestamp() at time zone 'Europe/Paris')::date),0),
          'settledMicros',coalesce((select sum(settled_micros) from public.agent_ai_budget_reservations where budget_key='openai' and budget_day=(clock_timestamp() at time zone 'Europe/Paris')::date),0),
          'pending',(select count(*) from public.agent_ai_budget_reservations where budget_key='openai' and budget_day=(clock_timestamp() at time zone 'Europe/Paris')::date and settled_micros is null),
          'overEnvelope',(select count(*) from public.agent_ai_budget_reservations where budget_key='openai' and budget_day=(clock_timestamp() at time zone 'Europe/Paris')::date and settled_micros>reserved_micros),
          'calls',coalesce((select reservation_count from public.agent_ai_budget_days where budget_key='openai' and budget_day=(clock_timestamp() at time zone 'Europe/Paris')::date),0)),
        'period',jsonb_build_object('days',30,'calls',(select count(*) from measured),'measuredCalls',(select count(cost) from measured),
          'unknownCalls',(select count(*) from measured where cost is null),'estimatedCostMicros',(select coalesce(sum(cost),0) from measured),
          'repricedCalls',(select count(*) from measured where repriced and cost is not null)),
        'operations',coalesce((select jsonb_agg(jsonb_build_object('operation',operation,'calls',calls,'estimatedCostMicros',cost) order by operation) from operation_totals),'[]'::jsonb)) as overview`);
    const overview = rows[0].overview as Record<string, unknown>;
    const date = (value: string | undefined) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
    const fx = Number(process.env.OPENAI_PRICING_USD_PER_EUR);
    const result = { ...overview, currency: "EUR", checkedAt: new Date().toISOString(), model,
      pricingDate: date(process.env.OPENAI_PRICING_VERIFIED_AT), fxDate: date(process.env.OPENAI_PRICING_FX_DATE),
      usdPerEur: Number.isFinite(fx) && fx > 0 && fx < 10 ? fx : null, pricingConfigured, guardStatus, limitMicros };
    if (!isAiBudgetOverview(result)) throw new HttpError(503, "Le suivi du budget est momentanément indisponible.");
    return result;
  });
}
