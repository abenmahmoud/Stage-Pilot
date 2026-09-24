import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
const queueRoute = readFileSync(new URL("../api/support/agent/requests/index.ts", import.meta.url), "utf8");

test("offers a direct queue for requests without an agent", () => {
  assert.match(page, /queueMode === "unassigned"\) params\.set\("assigned", "none"\)/);
  assert.match(page, /<option value="unassigned">Sans agent \(\{stats\.unassigned\}\)<\/option>/);
});

test("filters unassigned requests after the server access perimeter", () => {
  assert.match(queueRoute, /const assigned = queryValue\(req\.query\.assigned\)/);
  assert.match(queueRoute, /const unassignedOnly = assigned === "none"/);
  assert.match(queueRoute, /if \(accessFilter\) filters\.push\(accessFilter\)/);
  assert.match(queueRoute, /if \(unassignedOnly\) filters\.push\(sql`\$\{supportRequests\.assignedTo\} is null/);
});

test("keeps service orientation distinct from agent assignment", () => {
  assert.match(queueRoute, /service === UNASSIGNED_SERVICE_FILTER/);
  assert.match(queueRoute, /isNull\(supportRequests\.assignedTeam\)/);
  assert.match(queueRoute, /supportRequests\.assignedTo\} is null/);
});
