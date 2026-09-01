export const AGENT_RUNTIME_OUTCOMES = [
  "deterministic",
  "pretriage",
  "model_unavailable",
  "budget_unavailable",
  "budget_exhausted",
  "provider_error",
  "invalid_output",
  "policy_fallback",
  "low_confidence",
  "category_conflict",
  "model_success",
  "timeout",
] as const;

export type AgentRuntimeOutcome = (typeof AGENT_RUNTIME_OUTCOMES)[number];

export type AgentTokenUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type AgentRuntimeMetric = AgentTokenUsage & {
  operation: "support_assistant";
  outcome: AgentRuntimeOutcome;
  model: string | null;
  aiAttempted: boolean;
  usedAi: boolean;
  latencyMs: number;
  estimatedCostMicros: number | null;
  pricingConfigured: boolean;
  sourceCount: number;
  turnCount: number;
};

function boundedInteger(value: unknown, maximum: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.min(Math.round(value), maximum);
}

export function parseOpenAiTokenUsage(payload: unknown): AgentTokenUsage {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { inputTokens: null, outputTokens: null, totalTokens: null };
  }
  const usage = (payload as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
    return { inputTokens: null, outputTokens: null, totalTokens: null };
  }
  const record = usage as Record<string, unknown>;
  return {
    inputTokens: boundedInteger(record.input_tokens, 10_000_000),
    outputTokens: boundedInteger(record.output_tokens, 10_000_000),
    totalTokens: boundedInteger(record.total_tokens, 20_000_000),
  };
}

function configuredRate(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 10_000 ? parsed : null;
}

export function estimateAgentCostMicros(
  usage: AgentTokenUsage,
  rates: { inputEurPerMillion?: string; outputEurPerMillion?: string }
): { estimatedCostMicros: number | null; pricingConfigured: boolean } {
  const inputRate = configuredRate(rates.inputEurPerMillion);
  const outputRate = configuredRate(rates.outputEurPerMillion);
  const pricingConfigured = inputRate !== null && outputRate !== null;
  if (
    !pricingConfigured ||
    usage.inputTokens === null ||
    usage.outputTokens === null
  ) {
    return { estimatedCostMicros: null, pricingConfigured };
  }
  const estimatedCostMicros = Math.round(
    usage.inputTokens * inputRate + usage.outputTokens * outputRate
  );
  return {
    estimatedCostMicros: Number.isSafeInteger(estimatedCostMicros)
      ? Math.min(estimatedCostMicros, 1_000_000_000_000)
      : null,
    pricingConfigured,
  };
}

export function normalizeAgentRuntimeMetric(
  input: AgentRuntimeMetric
): AgentRuntimeMetric {
  const usage = {
    inputTokens: boundedInteger(input.inputTokens, 10_000_000),
    outputTokens: boundedInteger(input.outputTokens, 10_000_000),
    totalTokens: boundedInteger(input.totalTokens, 20_000_000),
  };
  const model = input.model?.trim().slice(0, 80) || null;
  const aiAttempted = Boolean(input.aiAttempted || input.usedAi);
  const pricingConfigured = Boolean(input.pricingConfigured);
  return {
    operation: "support_assistant",
    outcome: AGENT_RUNTIME_OUTCOMES.includes(input.outcome)
      ? input.outcome
      : "provider_error",
    model,
    aiAttempted,
    usedAi: Boolean(input.usedAi),
    latencyMs: boundedInteger(input.latencyMs, 120_000) ?? 0,
    ...usage,
    estimatedCostMicros: pricingConfigured
      ? boundedInteger(input.estimatedCostMicros, 1_000_000_000_000)
      : null,
    pricingConfigured,
    sourceCount: boundedInteger(input.sourceCount, 20) ?? 0,
    turnCount: boundedInteger(input.turnCount, 21) ?? 0,
  };
}
