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
    const rows = await db
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
    return rows.length === 1 ? { status: "allowed" } : { status: "exhausted" };
  } catch {
    return { status: "unavailable" };
  }
}
