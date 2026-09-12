import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { agentAiBudgetDays } from "../../db/schema.js";
import {
  readAgentAiBudgetConfig,
  type AgentAiBudgetOperation,
  type AgentAiBudgetReservationResult,
} from "../../shared/agent-ai-budget.js";

const BUDGET_KEY = "openai";

export async function reserveAgentAiDailyBudget(
  operation: AgentAiBudgetOperation
): Promise<AgentAiBudgetReservationResult> {
  const config = readAgentAiBudgetConfig(operation);
  if (config.status === "disabled") return { status: "disabled" };
  if (config.status === "invalid") return { status: "unavailable" };

  try {
    return await db.transaction(async (tx) => {
    const rows = await tx
      .insert(agentAiBudgetDays)
      .values({
        budgetKey: BUDGET_KEY,
        budgetDay: sql<string>`(clock_timestamp() at time zone 'Europe/Paris')::date`,
        limitMicros: config.dailyLimitMicros,
        reservedMicros: config.reservationMicros,
        reservationCount: 1,
      })
      .onConflictDoUpdate({
        target: [agentAiBudgetDays.budgetKey, agentAiBudgetDays.budgetDay],
        set: {
          limitMicros: config.dailyLimitMicros,
          reservedMicros: sql`${agentAiBudgetDays.reservedMicros} + ${config.reservationMicros}`,
          reservationCount: sql`${agentAiBudgetDays.reservationCount} + 1`,
          updatedAt: sql`clock_timestamp()`,
        },
        setWhere: sql`${agentAiBudgetDays.reservedMicros} + ${config.reservationMicros} <= ${config.dailyLimitMicros}`,
      })
      .returning({ budgetDay: agentAiBudgetDays.budgetDay });
    if (rows.length !== 1) return { status: "exhausted" };
    // The daily row is now locked. Suspend further calls after an anomalous settlement.
    const overEnvelope = await tx.execute(sql`select id from public.agent_ai_budget_reservations
      where budget_key=${BUDGET_KEY} and budget_day=${rows[0].budgetDay}::date
        and settled_micros > reserved_micros limit 1`);
    if (overEnvelope.length) throw new Error("ai_budget_usage_above_reservation");
    const reservation = await tx.execute(sql`
      insert into public.agent_ai_budget_reservations (budget_key, budget_day, operation, reserved_micros)
      values (${BUDGET_KEY}, ${rows[0].budgetDay}::date, ${operation}, ${config.reservationMicros})
      returning id`);
    return { status: "allowed", reservationId: String(reservation[0].id) };
    });
  } catch {
    return { status: "unavailable" };
  }
}

/** An unknown provider result keeps its full reservation; a known result settles once. */
export async function settleAgentAiBudget(reservationId: string | undefined, costMicros: number | null): Promise<void> {
  if (!reservationId || costMicros === null || !Number.isSafeInteger(costMicros) || costMicros < 0) return;
  try {
    await db.transaction(async tx => {
      const rows = await tx.execute(sql`select budget_key, budget_day::text, reserved_micros, settled_micros
        from public.agent_ai_budget_reservations where id=${reservationId}::uuid for update`);
      const row = rows[0];
      if (!row || row.settled_micros !== null) return;
      const reserved = Number(row.reserved_micros);
      // Do not release money when reported usage exceeds the expected envelope.
      const release = Math.max(0, reserved - costMicros);
      await tx.execute(sql`update public.agent_ai_budget_days set reserved_micros=reserved_micros-${release}, updated_at=clock_timestamp()
        where budget_key=${String(row.budget_key)} and budget_day=${String(row.budget_day)}::date`);
      await tx.execute(sql`update public.agent_ai_budget_reservations set settled_micros=${costMicros}, settled_at=clock_timestamp()
        where id=${reservationId}::uuid`);
    });
  } catch {
    // Fail closed financially. The response must still reach its requester.
  }
}
