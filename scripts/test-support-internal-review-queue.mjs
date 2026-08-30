import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
const queueRoute = readFileSync(new URL("../api/support/agent/requests/index.ts", import.meta.url), "utf8");

test("offers a dedicated internal-review queue", () => {
  assert.match(page, /queueMode === "internal"\) params\.set\("status", "attente_interne"\)/);
  assert.match(page, />À vérifier <span>\{stats\.waitingInternal\}<\/span>/);
});

test("counts internal reviews inside the authorized server perimeter", () => {
  assert.match(queueRoute, /waitingInternal: sql<number>`count\(\*\) filter \(where \$\{supportRequests\.status\} = 'attente_interne'\)::int`/);
  assert.match(queueRoute, /const statsWhere = \[/);
  assert.match(queueRoute, /accessFilter,/);
  assert.match(queueRoute, /serviceFilter,/);
});

test("does not create an internal reminder action", () => {
  assert.doesNotMatch(page, /support\/agent\/requests[^"`]*internal-remind|support\/agent\/internal-reminders/i);
});
