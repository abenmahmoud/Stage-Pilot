import { estimateAgentCostMicros, parseOpenAiTokenUsage } from "../../shared/agent-runtime-metrics.js";
import type { AgentAiBudgetOperation } from "../../shared/agent-ai-budget.js";
import { requireConfiguredInstitution } from "./institution-context.js";
import { recordAgentRuntimeMetric } from "./agent-runtime-metrics.js";
import { settleAgentAiBudget } from "./agent-ai-budget.js";

/** Token counts only. Neither source text nor output text belongs in accounting. */
export async function recordSupplementaryAiUsage(input: {
  operation: Exclude<AgentAiBudgetOperation, "support_assistant">;
  model: string;
  reservationId?: string;
  payload: unknown;
  startedAt: number;
}) {
  const usage = parseOpenAiTokenUsage(input.payload);
  const cost = estimateAgentCostMicros(usage, {
    inputEurPerMillion: process.env.OPENAI_SUPPORT_INPUT_EUR_PER_MILLION_TOKENS,
    outputEurPerMillion: process.env.OPENAI_SUPPORT_OUTPUT_EUR_PER_MILLION_TOKENS,
  });
  await settleAgentAiBudget(input.reservationId, cost.estimatedCostMicros);
  try {
    const institution = await requireConfiguredInstitution();
    await recordAgentRuntimeMetric(institution.id, {
      operation: input.operation, outcome: "model_success", model: input.model,
      aiAttempted: true, usedAi: true, latencyMs: Date.now() - input.startedAt,
      ...usage, ...cost, sourceCount: 0, turnCount: 0,
    });
  } catch { /* Accounting failures must not erase a generated draft. */ }
}
