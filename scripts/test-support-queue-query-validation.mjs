import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../api/support/agent/requests/index.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");

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

test("rejects unknown operational flag values", () => {
  assert.match(route, /if \(urgent && urgent !== "true"\)/);
  assert.match(route, /if \(callback && callback !== "pending"\)/);
  assert.match(route, /if \(duplicate && duplicate !== "pending"\)/);
  assert.match(route, /if \(overdue && overdue !== "true"\)/);
  assert.match(route, /throw new HttpError\(400, "Filtre d'urgence invalide"\)/);
  assert.match(route, /throw new HttpError\(400, "Filtre de rappel invalide"\)/);
  assert.match(route, /throw new HttpError\(400, "Filtre de doublon invalide"\)/);
  assert.match(route, /throw new HttpError\(400, "Filtre d'échéance invalide"\)/);
});

test("rejects repeated query parameters instead of choosing one", () => {
  assert.match(route, /if \(value\.length !== 1\) throw new HttpError\(400, "Paramètre répété"\)/);
  assert.doesNotMatch(route, /Array\.isArray\(value\) \? value\[0\]/);
});

test("bounds pagination and rejects malformed numbers", () => {
  assert.match(route, /function boundedIntegerQuery\(/);
  assert.match(route, /if \(!\/\^\\d\+\$\/\.test\(value\)\) throw new HttpError\(400, errorMessage\)/);
  assert.match(route, /boundedIntegerQuery\(queryValue\(req\.query\.page\), 1, 1, 10_000, "Page invalide"\)/);
  assert.match(route, /boundedIntegerQuery\(queryValue\(req\.query\.pageSize\), 30, 10, 50, "Taille de page invalide"\)/);
});

test("rejects an oversized search and mirrors the limit in the interface", () => {
  assert.match(route, /if \(searchValue\.length > 80\) throw new HttpError\(400, "Recherche trop longue"\)/);
  assert.doesNotMatch(route, /\.trim\(\)\.slice\(0, 80\)/);
  assert.match(page, /aria-label="Rechercher une demande" maxLength=\{80\}/);
});
