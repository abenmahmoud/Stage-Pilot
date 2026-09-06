// LOT 5 du plan de connaissance OB1 (2026-09-05) : garanties structurelles
// prouvees par inspection du code source livre (pas par relecture humaine),
// pour deux exigences du plan qui sont des ABSENCES plutot que des
// comportements observables en base :
//
//   - bullet 4 : un brouillon Hebdo n'alimente jamais l'agent ;
//   - bullet 5 : notification et connaissance restent deux decisions
//     distinctes — la route qui cree une proposition de connaissance depuis
//     une actualite publiee ne doit jamais toucher a l'envoi de
//     notifications.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

async function source(relativePath) {
  return readFile(new URL(relativePath, `file://${repoRoot.replaceAll("\\", "/")}`), "utf8");
}

test("weekly-assist.ts never imports the database (a Hebdo draft cannot reach the agent because nothing persists it)", async () => {
  const code = await source("api/content/admin/weekly-assist.ts");
  assert.doesNotMatch(code, /from ["'].*db\/index\.js["']/);
  assert.doesNotMatch(code, /from ["'].*db\/schema\.js["']/);
  assert.doesNotMatch(code, /knowledgeSourceProposals|knowledgeSources|flashInfoVersions/);
});

test("weekly-assist.ts response only returns a suggestion, never an id referencing a persisted row", async () => {
  const code = await source("api/content/admin/weekly-assist.ts");
  assert.doesNotMatch(code, /\.insert\(/);
  assert.doesNotMatch(code, /db\.transaction/);
});

test("the flash-to-knowledge route never touches notification dispatch (two separate decisions)", async () => {
  const code = await source("api/flash/proposals/[id]/knowledge.ts");
  assert.doesNotMatch(code, /flashNotificationDispatches/);
  assert.doesNotMatch(code, /resolveFlashDispatchPlan/);
  assert.doesNotMatch(code, /persistFlashCommunicationBridge/);
});

test("the knowledge proposal decision route never touches notification dispatch either", async () => {
  const code = await source("api/knowledge/admin/proposals/[id]/decision.ts");
  assert.doesNotMatch(code, /flashNotificationDispatches/);
  assert.doesNotMatch(code, /resolveFlashDispatchPlan/);
});

test("publishing a flash info (api/flash/proposals/[id]/publication.ts) never creates or approves a knowledge proposal", async () => {
  const code = await source("api/flash/proposals/[id]/publication.ts");
  assert.doesNotMatch(code, /knowledgeSourceProposals|knowledgeSources/);
});
