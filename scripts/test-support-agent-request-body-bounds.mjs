import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const routes = [
  ["décision", "../api/support/agent/approvals/[id]/decision.ts", "4kb"],
  ["modèle", "../api/support/agent/templates.ts", "8kb"],
  ["mise à jour dossier", "../api/support/agent/requests/[code].ts", "8kb"],
];

test("borne les trois mutations agent qui acceptent un corps", () => {
  for (const [label, relativePath, limit] of routes) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(
      source,
      new RegExp(`bodyParser: \\{ sizeLimit: "${limit}" \\}`),
      `${label} doit conserver sa limite ${limit}`
    );
  }
});

test("désactive le parseur pour la reprise sans payload", () => {
  const source = readFileSync(
    new URL("../api/support/agent/operations/[id]/retry.ts", import.meta.url),
    "utf8"
  );
  assert.match(source, /bodyParser: false/);
  assert.doesNotMatch(source, /req\.body/);
  assert.match(source, /req\.method !== "POST"/);
});

test("conserve authentification et limites de débit avant mutation", () => {
  const decision = readFileSync(new URL(routes[0][1], import.meta.url), "utf8");
  const templates = readFileSync(new URL(routes[1][1], import.meta.url), "utf8");
  const request = readFileSync(new URL(routes[2][1], import.meta.url), "utf8");
  assert.match(decision, /requireAgentApprovalReviewer\(req\)/);
  assert.match(templates, /requireSupportAgent\(req\)/);
  assert.match(request, /requireSupportAgent\(req\)/);
  assert.match(request, /await enforceAgentWriteRateLimit\(user\.id\)/);
});
