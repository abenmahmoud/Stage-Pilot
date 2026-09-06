// LOT 6 du plan de connaissance OB1 (2026-09-05). Preuve que le passage
// planifié du registre de connaissance et les contrôles de fraîcheur
// raisonnent en heure de Paris (2 h le balayage nocturne, 8 h/13 h/18 h la
// fraîcheur), des deux côtés du changement d'heure, et que les routes
// réelles rejouent bien ce module pur plutôt que de réinventer un calcul
// d'heure (même méthode que scripts/test-flash-expiry-cron.mjs).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  scheduledKnowledgeSweepTrigger,
  KNOWLEDGE_EXPIRY_SWEEP_HOUR,
  KNOWLEDGE_FRESHNESS_CHECK_HOURS,
} from "../shared/knowledge-freshness-schedule.ts";

const cronSource = readFileSync(
  new URL("../api/cron/knowledge-expiry.ts", import.meta.url),
  "utf8"
);
const sweepSource = readFileSync(
  new URL("../api/_shared/knowledge-freshness-sweep.ts", import.meta.url),
  "utf8"
);
const sourceActionSource = readFileSync(
  new URL("../api/knowledge/admin/sources/[id]/action.ts", import.meta.url),
  "utf8"
);
const proposalDecisionSource = readFileSync(
  new URL("../api/knowledge/admin/proposals/[id]/decision.ts", import.meta.url),
  "utf8"
);
const versionActionSource = readFileSync(
  new URL("../api/knowledge/admin/versions/[id]/action.ts", import.meta.url),
  "utf8"
);
const vercelConfig = JSON.parse(
  readFileSync(new URL("../vercel.json", import.meta.url), "utf8")
);

test("le balayage nocturne cible bien 2 h et les contrôles de fraîcheur 8 h, 13 h, 18 h", () => {
  assert.equal(KNOWLEDGE_EXPIRY_SWEEP_HOUR, 2);
  assert.deepEqual([...KNOWLEDGE_FRESHNESS_CHECK_HOURS], [8, 13, 18]);
});

test("les heures planifiées restent correctes en hiver (CET, UTC+1)", () => {
  assert.equal(
    scheduledKnowledgeSweepTrigger(new Date("2026-01-15T01:15:00.000Z")),
    "scheduled_nightly_expiry"
  );
  assert.equal(
    scheduledKnowledgeSweepTrigger(new Date("2026-01-15T07:00:00.000Z")),
    "scheduled_freshness_check"
  );
  assert.equal(
    scheduledKnowledgeSweepTrigger(new Date("2026-01-15T12:00:00.000Z")),
    "scheduled_freshness_check"
  );
  assert.equal(
    scheduledKnowledgeSweepTrigger(new Date("2026-01-15T17:00:00.000Z")),
    "scheduled_freshness_check"
  );
});

test("les heures planifiées restent correctes en été (CEST, UTC+2), même décalage qu'en hiver en heure locale", () => {
  assert.equal(
    scheduledKnowledgeSweepTrigger(new Date("2026-07-15T00:15:00.000Z")),
    "scheduled_nightly_expiry"
  );
  assert.equal(
    scheduledKnowledgeSweepTrigger(new Date("2026-07-15T06:00:00.000Z")),
    "scheduled_freshness_check"
  );
});

test("aucun déclenchement en dehors des quatre heures planifiées", () => {
  assert.equal(
    scheduledKnowledgeSweepTrigger(new Date("2026-01-15T10:00:00.000Z")),
    "not_scheduled"
  );
  assert.equal(
    scheduledKnowledgeSweepTrigger(new Date("2026-01-15T20:00:00.000Z")),
    "not_scheduled"
  );
});

test("declares an hourly schedule so the Paris-hour gate can track daylight saving time", () => {
  const cron = vercelConfig.crons.filter(
    (entry) => entry.path === "/api/cron/knowledge-expiry"
  );
  assert.deepEqual(cron, [
    { path: "/api/cron/knowledge-expiry", schedule: "5 * * * *" },
  ]);
});

test("preuve de wiring : le cron rejoue le module pur d'heure, ne réinvente pas de calcul", () => {
  assert.match(cronSource, /scheduledKnowledgeSweepTrigger\(now\)/);
  assert.match(cronSource, /trigger === "not_scheduled"/);
  assert.doesNotMatch(cronSource, /getUTCHours|getHours\(\)/);
});

test("preuve de wiring : hors créneau planifié, aucune transaction n'est ouverte", () => {
  const skip = cronSource.indexOf('trigger === "not_scheduled"');
  const transaction = cronSource.indexOf("db.transaction");
  assert.ok(skip >= 0);
  assert.ok(transaction > skip);
});

test("preuve de wiring : le balayage réel vit dans un seul module, réutilisé par le cron", () => {
  assert.match(cronSource, /runKnowledgeFreshnessSweep\(tx, now, trigger\)/);
  assert.match(sweepSource, /export async function runKnowledgeFreshnessSweep/);
});

test("preuve de wiring : les trois routes de publication déclenchent un contrôle supplémentaire", () => {
  assert.match(sourceActionSource, /runKnowledgeFreshnessSweep\(tx, now, "publication"\)/);
  assert.match(proposalDecisionSource, /runKnowledgeFreshnessSweep\(tx, now, "publication"\)/);
  assert.match(versionActionSource, /runKnowledgeFreshnessSweep\(tx, now, "publication"\)/);
});
