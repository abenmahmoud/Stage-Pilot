export const AGENT_AI_BUDGET_OPERATIONS = [
  "support_assistant",
  "content_assist",
  "communication_assist",
] as const;

export type AgentAiBudgetOperation = (typeof AGENT_AI_BUDGET_OPERATIONS)[number];

export type AgentAiBudgetConfig =
  | { status: "disabled" }
  | { status: "invalid"; reason: "daily_budget" | "operation_reserve" }
  | { status: "enabled"; dailyLimitMicros: number; reservationMicros: number };

export type AgentAiBudgetReservationResult =
  | { status: "disabled" | "allowed" }
  | { status: "exhausted" | "unavailable" };

const OPERATION_RESERVE_ENV: Record<AgentAiBudgetOperation, string> = {
  support_assistant: "OPENAI_SUPPORT_MAX_CALL_EUR",
  content_assist: "OPENAI_CONTENT_MAX_CALL_EUR",
  communication_assist: "OPENAI_COMMUNICATION_MAX_CALL_EUR",
};

const MAX_EUR_MICROS = 1_000_000_000_000;

export function parseCanonicalEuroMicros(value: string | undefined): number | null {
  const normalized = value?.trim() ?? "";
  if (!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,6})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const micros = Number(whole) * 1_000_000 + Number(fraction.padEnd(6, "0"));
  return Number.isSafeInteger(micros) && micros > 0 && micros <= MAX_EUR_MICROS
    ? micros
    : null;
}
export function readAgentAiBudgetConfig(
  operation: AgentAiBudgetOperation,
  env: NodeJS.ProcessEnv = process.env
): AgentAiBudgetConfig {
  if (env.OPENAI_BUDGET_GUARD_ENABLED !== "true") return { status: "disabled" };
  const dailyLimitMicros = parseCanonicalEuroMicros(env.OPENAI_DAILY_BUDGET_EUR);
  if (dailyLimitMicros === null) return { status: "invalid", reason: "daily_budget" };
  const reservationMicros = parseCanonicalEuroMicros(env[OPERATION_RESERVE_ENV[operation]]);
  if (reservationMicros === null || reservationMicros > dailyLimitMicros) {
    return { status: "invalid", reason: "operation_reserve" };
  }
  return { status: "enabled", dailyLimitMicros, reservationMicros };
}
