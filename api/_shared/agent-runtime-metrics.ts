import { db } from "../../db/index.js";
import { agentRuntimeMetrics } from "../../db/schema.js";
import {
  normalizeAgentRuntimeMetric,
  type AgentRuntimeMetric,
} from "../../shared/agent-runtime-metrics.js";

export async function recordAgentRuntimeMetric(
  institutionId: string,
  metric: AgentRuntimeMetric
): Promise<void> {
  const normalized = normalizeAgentRuntimeMetric(metric);
  await db.insert(agentRuntimeMetrics).values({
    institutionId,
    operation: normalized.operation,
    outcome: normalized.outcome,
    model: normalized.model,
    aiAttempted: normalized.aiAttempted,
    usedAi: normalized.usedAi,
    latencyMs: normalized.latencyMs,
    inputTokens: normalized.inputTokens,
    outputTokens: normalized.outputTokens,
    totalTokens: normalized.totalTokens,
    estimatedCostMicros: normalized.estimatedCostMicros,
    pricingConfigured: normalized.pricingConfigured,
    sourceCount: normalized.sourceCount,
    turnCount: normalized.turnCount,
  });
}
