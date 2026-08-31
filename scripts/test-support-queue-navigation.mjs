import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveSupportQueueNavigation } from "../shared/support-queue-navigation.ts";

const page = readFileSync(
  new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
  "utf8"
);
const styles = readFileSync(
  new URL("../src/pages/prototype/lycee-connect.css", import.meta.url),
  "utf8"
);

const queue = [
  { publicCode: "BC-2026-000101" },
  { publicCode: "BC-2026-000102" },
  { publicCode: "BC-2026-000103" },
];

test("moves only inside the already validated queue page", () => {
  assert.deepEqual(resolveSupportQueueNavigation(queue, "BC-2026-000102"), {
    previousCode: "BC-2026-000101",
    nextCode: "BC-2026-000103",
    position: 2,
    total: 3,
  });
});

test("stops at page boundaries without inventing another request", () => {
  assert.equal(resolveSupportQueueNavigation(queue, "BC-2026-000101").previousCode, null);
  assert.equal(resolveSupportQueueNavigation(queue, "BC-2026-000103").nextCode, null);
});

test("disables navigation when the selection is absent or stale", () => {
  assert.deepEqual(resolveSupportQueueNavigation(queue, "BC-2026-999999"), {
    previousCode: null,
    nextCode: null,
    position: 0,
    total: 3,
  });
  assert.deepEqual(resolveSupportQueueNavigation([], null), {
    previousCode: null,
    nextCode: null,
    position: 0,
    total: 0,
  });
});

test("keeps commands accessible and blocks them during mutable work", () => {
  assert.match(page, /aria-label="Dossier précédent dans la page"/);
  assert.match(page, /aria-label="Dossier suivant dans la page"/);
  assert.match(page, /title="Dossier précédent"/);
  assert.match(page, /title="Dossier suivant"/);
  assert.match(page, /saving \|\| detailLoading \|\| agentUploading \|\| translating/);
  assert.match(page, /queueNavigation\.position\} sur \{queueNavigation\.total\}/);
  assert.match(page, /setSelectedCode\(queueNavigation\.previousCode\)/);
  assert.match(page, /setSelectedCode\(queueNavigation\.nextCode\)/);
  assert.match(styles, /grid-template-columns: 40px minmax\(74px,auto\) 40px/);
  assert.match(styles, /\.lycee-agent-record-navigation button \{ width: 40px; height: 40px/);
});

test("keeps queue navigation coupled to per-request drafts", () => {
  assert.match(page, /resolveSupportQueueNavigation\(requests, selectedCode\)/);
  assert.match(page, /readSupportAgentWorkDraft\(agentWorkDraftsRef\.current, code\)/);
  assert.match(page, /writeSupportAgentWorkDraft\(agentWorkDraftsRef\.current, code, patch\)/);
});
