import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/pages/prototype/lycee-connect.css", import.meta.url), "utf8");

test("uses agent-facing French labels for every support status", () => {
  for (const status of ["nouveau", "a_qualifier", "assigne", "en_cours", "attente_demandeur", "attente_interne", "resolu", "clos", "indesirable"]) {
    assert.match(page, new RegExp(`${status}:`));
  }
  assert.match(page, /attente_demandeur: "En attente usager"/);
  assert.match(page, /attente_interne: "À vérifier"/);
});

test("renders status separately from operational warning flags", () => {
  assert.match(page, /<b data-kind="status">\{agentStatusLabels\[request\.status\] \?\? request\.status\}<\/b>/);
  assert.match(page, /data-kind="unassigned">Sans agent/);
  assert.match(page, /data-kind="overdue">En retard/);
  assert.match(css, /b\[data-kind="status"\]/);
});
