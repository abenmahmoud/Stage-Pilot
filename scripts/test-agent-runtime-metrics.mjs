import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeSupportConversation } from "../api/_shared/support-agent.ts";
import {
  estimateAgentCostMicros,
  normalizeAgentRuntimeMetric,
  parseOpenAiTokenUsage,
} from "../shared/agent-runtime-metrics.ts";

const root = new URL("../", import.meta.url);

function messages(content) {
  return [
    { role: "assistant", content: "Bonjour" },
    { role: "requester", content },
  ];
}

test("reads bounded token usage and ignores malformed provider data", () => {
  assert.deepEqual(parseOpenAiTokenUsage({
    usage: { input_tokens: 321, output_tokens: 45, total_tokens: 366 },
  }), {
    inputTokens: 321,
    outputTokens: 45,
    totalTokens: 366,
  });
  assert.deepEqual(parseOpenAiTokenUsage({ usage: { input_tokens: -2 } }), {
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
  });
});

test("estimates cost only from explicit bounded rates", () => {
  const usage = { inputTokens: 1_000_000, outputTokens: 500_000, totalTokens: 1_500_000 };
  assert.deepEqual(estimateAgentCostMicros(usage, {
    inputEurPerMillion: "2",
    outputEurPerMillion: "8",
  }), {
    estimatedCostMicros: 6_000_000,
    pricingConfigured: true,
  });
  assert.deepEqual(estimateAgentCostMicros(usage, {
    inputEurPerMillion: "2",
  }), {
    estimatedCostMicros: null,
    pricingConfigured: false,
  });
});

test("normalizes metrics without accepting arbitrary outcomes or dimensions", () => {
  const metric = normalizeAgentRuntimeMetric({
    operation: "support_assistant",
    outcome: "unknown_outcome",
    model: " model-name ",
    aiAttempted: true,
    usedAi: false,
    latencyMs: 999_999,
    inputTokens: 12,
    outputTokens: 4,
    totalTokens: 16,
    estimatedCostMicros: null,
    pricingConfigured: false,
    sourceCount: 200,
    turnCount: 200,
  });
  assert.equal(metric.outcome, "provider_error");
  assert.equal(metric.model, "model-name");
  assert.equal(metric.latencyMs, 120_000);
  assert.equal(metric.sourceCount, 20);
  assert.equal(metric.turnCount, 21);
});

test("records one local outcome when the model is unavailable", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "";
  const metrics = [];
  try {
    const result = await analyzeSupportConversation({
      messages: messages("Mon ENT ne fonctionne plus depuis ce matin et je dois consulter mon emploi du temps."),
      attachments: [],
      safetyIdentifier: "runtime-test-session",
      runtimeMetricsRecorder: async (metric) => metrics.push(metric),
    });
    assert.equal(result.usedAi, false);
    assert.equal(metrics.length, 1);
    assert.equal(metrics[0].outcome, "model_unavailable");
    assert.equal(metrics[0].aiAttempted, false);
    assert.equal(metrics[0].model, null);
  } finally {
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("records provider usage and ignores a failing metrics sink", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalInputRate = process.env.OPENAI_SUPPORT_INPUT_EUR_PER_MILLION_TOKENS;
  const originalOutputRate = process.env.OPENAI_SUPPORT_OUTPUT_EUR_PER_MILLION_TOKENS;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_SUPPORT_INPUT_EUR_PER_MILLION_TOKENS = "2";
  process.env.OPENAI_SUPPORT_OUTPUT_EUR_PER_MILLION_TOKENS = "8";
  const metrics = [];
  globalThis.fetch = async () => new Response(JSON.stringify({
    output: [{
      type: "message",
      content: [{
        type: "output_text",
        text: JSON.stringify({
          reply: "Votre demande est assez claire pour ouvrir un dossier ENT.",
          category: "ent",
          requesterType: "eleve",
          urgency: "normale",
          confidence: "high",
          missingInformation: [],
          suggestedDocuments: [],
          readyToCreate: true,
          safetyNotice: null,
          detectedLanguage: "français",
          internalSummaryFr: "Un élève rencontre un blocage durable de son accès ENT.",
        }),
      }],
    }],
    usage: { input_tokens: 1_000, output_tokens: 100, total_tokens: 1_100 },
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const result = await analyzeSupportConversation({
      messages: messages("Je suis élève, mon ENT est bloqué depuis hier malgré plusieurs essais et je dois consulter mon emploi du temps."),
      attachments: [],
      safetyIdentifier: "runtime-test-session",
      knowledgeContextLoader: async () => "",
      runtimeMetricsRecorder: async (metric) => metrics.push(metric),
    });
    assert.equal(result.usedAi, true);
    assert.equal(metrics.length, 1);
    assert.equal(metrics[0].outcome, "model_success");
    assert.equal(metrics[0].inputTokens, 1_000);
    assert.equal(metrics[0].outputTokens, 100);
    assert.equal(metrics[0].estimatedCostMicros, 2_800);

    const resilient = await analyzeSupportConversation({
      messages: messages("Je suis élève, mon ENT est bloqué depuis hier malgré plusieurs essais et je dois consulter mon emploi du temps."),
      attachments: [],
      safetyIdentifier: "runtime-test-session-2",
      knowledgeContextLoader: async () => "",
      runtimeMetricsRecorder: async () => { throw new Error("metrics unavailable"); },
    });
    assert.equal(resilient.usedAi, true);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalApiKey;
    process.env.OPENAI_SUPPORT_INPUT_EUR_PER_MILLION_TOKENS = originalInputRate;
    process.env.OPENAI_SUPPORT_OUTPUT_EUR_PER_MILLION_TOKENS = originalOutputRate;
  }
});

test("keeps the runtime table server-only, append-only and free of user content", async () => {
  const [migration, privilegeMigration, api, recorder] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260830013502_create_agent_runtime_metrics.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260830014140_restrict_agent_runtime_metric_privileges.sql", import.meta.url), "utf8"),
    readFile(new URL("../api/support/agent/metrics.ts", import.meta.url), "utf8"),
    readFile(new URL("../api/_shared/agent-runtime-metrics.ts", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /force row level security/i);
  assert.match(migration, /revoke all on table public\.agent_runtime_metrics from public, anon, authenticated/i);
  assert.match(migration, /grant select, insert on table public\.agent_runtime_metrics to service_role/i);
  assert.doesNotMatch(migration, /grant[^;]*(update|delete)/i);
  assert.match(privilegeMigration, /revoke all on table public\.agent_runtime_metrics from service_role/i);
  assert.match(privilegeMigration, /grant select, insert on table public\.agent_runtime_metrics to service_role/i);
  assert.doesNotMatch(privilegeMigration, /grant[^;]*(update|delete)/i);
  assert.match(migration, /before update or delete/i);
  assert.doesNotMatch(migration, /message|conversation|email|phone|telephone|attachment|filename|session_hash|user_id/i);
  assert.match(api, /requireAgentApprovalReviewer\(req\)/);
  assert.match(api, /decisionRole !== "direction"/);
  assert.match(api, /decisionRole !== "superadmin"/);
  assert.match(api, /context\.institutionId/);
  assert.match(api, /innerJoin\(supportRequests, eq\(supportRequests\.id, supportEvents\.requestId\)\)/);
  assert.match(api, /eq\(supportRequests\.institutionId, context\.institutionId\)/);
  assert.match(api, /supportEvents\.eventType/);
  assert.match(api, /fromValue[\s\S]+assignedTeam/);
  assert.match(api, /toValue[\s\S]+assignedTeam/);
  assert.match(api, /routingCorrections/);
  assert.match(api, /actorType[\s\S]+agent/);
  assert.doesNotMatch(api, /select\([\s\S]*message|supportMessages|supportContacts/i);
  assert.doesNotMatch(recorder, /message|conversation|email|phone|attachment|session/i);
});

test("shows only aggregate measures in the protected operations view", async () => {
  const page = await readFile(new URL("../src/pages/admin/SupportOperationsPage.tsx", import.meta.url), "utf8");
  assert.match(page, /support\/agent\/metrics\?days=/);
  assert.match(page, /Statistiques techniques sans conversation, identité ni coordonnées/);
  assert.match(page, /7, 30/);
  assert.match(page, /Réorientations humaines/);
  assert.match(page, /déplace un dossier d’un service déjà assigné vers un autre/);
  assert.doesNotMatch(page, /requesterName|requesterEmail|bodyText|attachmentName/);
});
