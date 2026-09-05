import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeSupportConversation } from "../api/_shared/support-agent.ts";
import {
  parseCanonicalEuroMicros,
  readAgentAiBudgetConfig,
} from "../shared/agent-ai-budget.ts";

function messages() {
  return [
    { role: "assistant", content: "Bonjour" },
    { role: "requester", content: "Mon accès ENT reste bloqué depuis hier et je souhaite ouvrir une demande." },
  ];
}

test("lit uniquement des montants canoniques positifs bornés", () => {
  assert.equal(parseCanonicalEuroMicros("12.345678"), 12_345_678);
  assert.equal(parseCanonicalEuroMicros("0.10"), 100_000);
  for (const value of [undefined, "", "0", "01", "1,50", "1e2", "-1", "1.1234567"]) {
    assert.equal(parseCanonicalEuroMicros(value), null, String(value));
  }
});

test("reste désactivé par défaut et échoue fermé si la configuration est incomplète", () => {
  assert.deepEqual(readAgentAiBudgetConfig("support_assistant", {}), { status: "disabled" });
  assert.deepEqual(readAgentAiBudgetConfig("support_assistant", {
    OPENAI_BUDGET_GUARD_ENABLED: "true",
  }), { status: "invalid", reason: "daily_budget" });
  assert.deepEqual(readAgentAiBudgetConfig("support_assistant", {
    OPENAI_BUDGET_GUARD_ENABLED: "true",
    OPENAI_DAILY_BUDGET_EUR: "10",
    OPENAI_SUPPORT_MAX_CALL_EUR: "11",
  }), { status: "invalid", reason: "operation_reserve" });
  assert.deepEqual(readAgentAiBudgetConfig("support_assistant", {
    OPENAI_BUDGET_GUARD_ENABLED: "true",
    OPENAI_DAILY_BUDGET_EUR: "10",
    OPENAI_SUPPORT_MAX_CALL_EUR: "0.05",
  }), {
    status: "enabled",
    dailyLimitMicros: 10_000_000,
    reservationMicros: 50_000,
  });
});

test("l’assistant ne joint pas le fournisseur quand le budget est indisponible ou épuisé", async () => {
  const originalFlag = process.env.OPENAI_BUDGET_GUARD_ENABLED;
  const originalKey = process.env.OPENAI_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.OPENAI_BUDGET_GUARD_ENABLED = "true";
  process.env.OPENAI_API_KEY = "test-key";
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("provider_must_not_be_called");
  };
  try {
    for (const expected of ["budget_unavailable", "budget_exhausted"]) {
      const metrics = [];
      const result = await analyzeSupportConversation({
        messages: messages(),
        attachments: [],
        safetyIdentifier: `budget-${expected}`,
        knowledgeContextLoader: async () => "",
        aiBudgetGuard: async () => ({
          status: expected === "budget_exhausted" ? "exhausted" : "unavailable",
        }),
        runtimeMetricsRecorder: async (metric) => metrics.push(metric),
      });
      assert.equal(result.usedAi, false);
      assert.equal(metrics.length, 1);
      assert.equal(metrics[0].outcome, expected);
      assert.equal(metrics[0].aiAttempted, false);
    }
    assert.equal(fetchCalls, 0);
  } finally {
    process.env.OPENAI_BUDGET_GUARD_ENABLED = originalFlag;
    process.env.OPENAI_API_KEY = originalKey;
    globalThis.fetch = originalFetch;
  }
});

test("utilise un compteur quotidien privé et atomique partagé par les quatre routes IA", async () => {
  const [migration, store, assistant, content, communications, weekly] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260901225812_create_agent_ai_budget_days.sql", import.meta.url), "utf8"),
    readFile(new URL("../api/_shared/agent-ai-budget.ts", import.meta.url), "utf8"),
    readFile(new URL("../api/support/assistant.ts", import.meta.url), "utf8"),
    readFile(new URL("../api/content/admin/assist.ts", import.meta.url), "utf8"),
    readFile(new URL("../api/communications/admin/assist.ts", import.meta.url), "utf8"),
    readFile(new URL("../api/content/admin/weekly-assist.ts", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /primary key \(budget_key, budget_day\)/i);
  assert.match(migration, /reserved_micros >= 0 and reserved_micros <= limit_micros/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /force row level security/i);
  assert.match(migration, /revoke all on table public\.agent_ai_budget_days from public, anon, authenticated/i);
  assert.match(migration, /grant select, insert, update on table public\.agent_ai_budget_days to service_role/i);
  assert.doesNotMatch(migration, /message|conversation|email|phone|attachment|user_id/i);
  assert.match(store, /const BUDGET_KEY = "openai"/);
  assert.match(store, /onConflictDoUpdate/);
  assert.match(store, /setWhere:/);
  assert.match(store, /reservedMicros[^\n]+reservationMicros[^\n]+dailyLimitMicros/);
  assert.match(assistant, /reserveAgentAiDailyBudget\("support_assistant"\)/);
  assert.match(content, /reserveAgentAiDailyBudget\("content_assist"\)/);
  assert.match(communications, /reserveAgentAiDailyBudget\("communication_assist"\)/);
  assert.match(weekly, /reserveAgentAiDailyBudget\("content_assist"\)/);
  for (const source of [content, communications, weekly]) {
    assert.ok(source.indexOf("reserveAgentAiDailyBudget") < source.indexOf('fetch("https://api.openai.com/v1/responses"'));
  }
});
