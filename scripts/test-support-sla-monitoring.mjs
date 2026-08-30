import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const creationRoute = readFileSync(new URL("../api/support/requests/index.ts", import.meta.url), "utf8");
const queueRoute = readFileSync(new URL("../api/support/agent/requests/index.ts", import.meta.url), "utf8");
const agentUi = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");

test("does not invent a 24-hour SLA when a request is created", () => {
  assert.match(creationRoute, /slaDueAt:\s*null/);
  assert.doesNotMatch(creationRoute, /slaDueAt:\s*new Date\(Date\.now\(\) \+ 24 \* 60 \* 60 \* 1000\)/);
});

test("filters only open requests whose recorded deadline has passed", () => {
  assert.match(queueRoute, /queryValue\(req\.query\.overdue\) === "true"/);
  assert.match(queueRoute, /slaDueAt\} < now\(\).*status\} not in \('resolu', 'clos', 'indesirable'\)/s);
});

test("exposes the overdue queue as an explicit agent filter", () => {
  assert.match(agentUi, /queueMode === "overdue"\) params\.set\("overdue", "true"\)/);
  assert.match(agentUi, />En retard <span>\{stats\.overdue\}<\/span>/);
});
