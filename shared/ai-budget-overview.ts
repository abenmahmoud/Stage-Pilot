export type AiBudgetOverview = {
  currency: "EUR";
  checkedAt: string;
  model: string;
  pricingDate: string | null;
  fxDate: string | null;
  usdPerEur: number | null;
  pricingConfigured: boolean;
  guardStatus: "enabled" | "disabled" | "invalid";
  limitMicros: number | null;
  today: { day: string; committedMicros: number; settledMicros: number; pending: number; overEnvelope: number; calls: number };
  period: { days: number; calls: number; measuredCalls: number; unknownCalls: number; estimatedCostMicros: number; repricedCalls: number };
  operations: Array<{ operation: string; calls: number; estimatedCostMicros: number }>;
};

export function isAiBudgetOverview(value: unknown): value is AiBudgetOverview {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as AiBudgetOverview;
  const amount = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000_000_000;
  return Object.keys(v).sort().join() === "checkedAt,currency,fxDate,guardStatus,limitMicros,model,operations,period,pricingConfigured,pricingDate,today,usdPerEur"
    && v.currency === "EUR" && typeof v.checkedAt === "string" && Number.isFinite(Date.parse(v.checkedAt))
    && typeof v.model === "string" && v.model.length <= 80
    && [v.pricingDate, v.fxDate].every(d => d === null || (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)))
    && (v.usdPerEur === null || (typeof v.usdPerEur === "number" && v.usdPerEur > 0 && v.usdPerEur < 10))
    && typeof v.pricingConfigured === "boolean" && ["enabled", "disabled", "invalid"].includes(v.guardStatus)
    && (v.limitMicros === null || amount(v.limitMicros))
    && !!v.today && Object.keys(v.today).sort().join() === "calls,committedMicros,day,overEnvelope,pending,settledMicros"
    && typeof v.today.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.today.day)
    && [v.today.committedMicros, v.today.settledMicros, v.today.pending, v.today.overEnvelope, v.today.calls].every(amount)
    && !!v.period && Object.keys(v.period).sort().join() === "calls,days,estimatedCostMicros,measuredCalls,repricedCalls,unknownCalls"
    && [v.period.calls, v.period.estimatedCostMicros, v.period.measuredCalls, v.period.unknownCalls, v.period.repricedCalls].every(amount)
    && v.period.days === 30 && Array.isArray(v.operations) && v.operations.length <= 4
    && v.operations.every(o => !!o && Object.keys(o).sort().join() === "calls,estimatedCostMicros,operation"
      && ["support_assistant", "content_assist", "communication_assist", "support_translation"].includes(o.operation)
      && amount(o.calls) && amount(o.estimatedCostMicros));
}
