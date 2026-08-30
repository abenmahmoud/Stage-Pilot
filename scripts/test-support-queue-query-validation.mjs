import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../api/support/agent/requests/index.ts", import.meta.url), "utf8");

test("rejects an unknown status instead of widening the queue", () => {
  const rejection = route.indexOf("if (status && !VALID_STATUSES.has(status))");
  const filter = route.indexOf("if (VALID_STATUSES.has(status)) filters.push");

  assert.notEqual(rejection, -1);
  assert.notEqual(filter, -1);
  assert.ok(rejection < filter);
  assert.match(route, /throw new HttpError\(400, "Statut invalide"\)/);
});

test("rejects an unknown assignment filter", () => {
  const rejection = route.indexOf('if (assigned && assigned !== "me" && assigned !== "none")');
  const mineFilter = route.indexOf('const mineOnly = assigned === "me"');
  const unassignedFilter = route.indexOf('const unassignedOnly = assigned === "none"');

  assert.notEqual(rejection, -1);
  assert.notEqual(mineFilter, -1);
  assert.notEqual(unassignedFilter, -1);
  assert.ok(rejection < mineFilter);
  assert.ok(rejection < unassignedFilter);
  assert.match(route, /throw new HttpError\(400, "Attribution invalide"\)/);
});

test("keeps the two documented assignment values", () => {
  assert.match(route, /assigned !== "me" && assigned !== "none"/);
  assert.match(route, /if \(mineOnly\) filters\.push\(eq\(supportRequests\.assignedTo, user\.id\)\)/);
  assert.match(route, /if \(unassignedOnly\) filters\.push\(isNull\(supportRequests\.assignedTo\)\)/);
});
