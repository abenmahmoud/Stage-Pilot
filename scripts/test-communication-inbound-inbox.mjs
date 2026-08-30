import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../api/communications/admin/inbound/index.ts", import.meta.url),
  "utf8"
);
const page = readFileSync(
  new URL("../src/pages/admin/CommunicationsPage.tsx", import.meta.url),
  "utf8"
);

test("keeps the inbound inbox private, scoped and read-only", () => {
  assert.match(route, /req\.method !== "GET"/);
  assert.match(route, /await requireCommunicationEditor\(req\)/);
  assert.match(route, /eq\(communicationInbound\.institutionId, context\.institutionId\)/);
  assert.match(route, /inArray\(communicationInbound\.status, \["received", "review", "error"\]\)/);
  assert.match(route, /\.limit\(100\)/);
  assert.doesNotMatch(route, /insert\(|update\(|delete\(/);
});

test("projects only metadata required for human classification review", () => {
  for (const field of ["id", "communicationId", "status", "classification", "receivedAt", "title"]) {
    assert.match(route, new RegExp(`${field}:`));
  }
  assert.doesNotMatch(
    route,
    /externalMessageHash|storageRef|sender|recipient|emailAddress|phoneNumber|body|subject|attachment|summary/
  );
});

test("shows a responsive human-review queue without automatic actions", () => {
  assert.match(page, /communications\/admin\/inbound/);
  assert.match(page, /Réponses reçues/);
  assert.match(page, /Demande de retrait/);
  assert.match(page, /Coordonnées à corriger/);
  assert.match(page, /Classement manuel requis/);
  assert.match(page, /À vérifier/);
  assert.match(page, /sm:flex-row sm:items-center sm:justify-between/);
  assert.doesNotMatch(page, /confirm_withdrawal|update_contact|processInbound|senderEmail/);
});
