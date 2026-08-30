import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
const queueRoute = readFileSync(new URL("../api/support/agent/requests/index.ts", import.meta.url), "utf8");

test("offers an explicit requester-waiting queue", () => {
  assert.match(page, /queueMode === "waiting"\) params\.set\("status", "attente_demandeur"\)/);
  assert.match(page, />En attente <span>\{stats\.waitingRequester\}<\/span>/);
});

test("uses the existing validated server status and no reminder endpoint", () => {
  assert.match(queueRoute, /"attente_demandeur"/);
  assert.doesNotMatch(page, /support\/agent\/requests[^"`]*remind|support\/agent\/reminders/i);
});
