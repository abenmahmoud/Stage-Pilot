import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
const assistantRoute = readFileSync(new URL("../api/support/assistant.ts", import.meta.url), "utf8");
const creationRoute = readFileSync(new URL("../api/support/requests/index.ts", import.meta.url), "utf8");
const publicDetailRoute = readFileSync(new URL("../api/support/requests/[code].ts", import.meta.url), "utf8");
const publicMessagesRoute = readFileSync(new URL("../api/support/requests/[code]/messages.ts", import.meta.url), "utf8");
const agentQueueRoute = readFileSync(new URL("../api/support/agent/requests/index.ts", import.meta.url), "utf8");
const agentDetailRoute = readFileSync(new URL("../api/support/agent/requests/[code].ts", import.meta.url), "utf8");
const dataModel = readFileSync(new URL("../specs/002-agent-etablissement-adaptatif/data-model.md", import.meta.url), "utf8");

test("converges chat and classic form into the same idempotent creation route", () => {
  assert.match(page, /const description = \(classicForm \? classicDescription : conversationDescription\)\.trim\(\)/);
  assert.match(page, /fetch\("\/api\/support\/requests", \{[\s\S]{0,180}method: "POST"/);
  assert.match(page, /"Idempotency-Key": requestKey/);
  assert.match(creationRoute, /\.insert\(supportRequests\)/);
  assert.match(creationRoute, /target: \[supportRequests\.institutionId, supportRequests\.idempotencyKeyHash\]/);
});

test("keeps the assistant stateless with respect to case tracking", () => {
  assert.match(page, /apiFetch<AssistantApiResult>\("support\/assistant"/);
  assert.match(assistantRoute, /createSupportAssistantRoutingReceipt/);
  assert.doesNotMatch(assistantRoute, /\.insert\(supportRequests\)|supportMessages|supportAttachments/);
});

test("reads requester follow-up and agent work from the same support entities", () => {
  for (const source of [publicDetailRoute, publicMessagesRoute, agentQueueRoute, agentDetailRoute]) {
    assert.match(source, /supportRequests/);
  }
  assert.match(publicDetailRoute, /supportMessages/);
  assert.match(agentDetailRoute, /supportMessages/);
  assert.match(agentDetailRoute, /supportAttachments/);
  assert.match(dataModel, /réutilise les entités de suivi de `001-guichet-numerique`/);
});
