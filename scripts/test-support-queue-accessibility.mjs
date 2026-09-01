import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");

test("names the support queue filter group", () => {
  assert.match(page, /className="lycee-agent-tabs" aria-label="Filtrer les demandes"/);
});

test("announces the selected state of every queue filter", () => {
  for (const mode of ["all", "qualify", "urgent", "overdue", "waiting", "internal", "unassigned", "callbacks", "duplicates"]) {
    assert.match(page, new RegExp(`aria-pressed=\\{queueMode === "${mode}"\\}`));
  }
});

test("keeps every filter as a native keyboard-operable button", () => {
  const group = page.match(/<div className="lycee-agent-tabs"[\s\S]*?<\/div>/)?.[0] ?? "";
  assert.equal((group.match(/<button /g) ?? []).length, 9);
  assert.equal((group.match(/type="button"/g) ?? []).length, 9);
});

test("names the search and announces the current service and dossier", () => {
  assert.match(page, /className="lycee-agent-queue" aria-label="File des demandes"/);
  assert.match(page, /<input aria-label="Rechercher une demande"/);
  assert.match(page, /<nav aria-label="Filtrer par charge de service">/);
  assert.match(page, /aria-pressed=\{serviceFilter === value\}/);
  assert.match(page, /<button aria-pressed=\{isSelected\}/);
});

test("exposes the queue as a semantic list and marks the current request", () => {
  assert.match(page, /<ul aria-label="Demandes affichées">/);
  assert.match(page, /<li key=\{request\.publicCode\}><button/);
  assert.match(page, /aria-pressed=\{isSelected\}/);
  assert.match(page, /aria-current=\{isSelected \? "true" : undefined\}/);
  assert.match(page, /<article className="lycee-agent-detail" aria-label="Détail de la demande"/);
});

test("exposes one keyboard-operable next action without changing a dossier", () => {
  assert.match(page, /\{access && !queueLoadError \? <section className="lycee-agent-next-action"/);
  assert.match(
    page,
    /className="lycee-agent-next-action"[\s\S]*?aria-labelledby="agent-next-action-title"/
  );
  assert.match(page, /<strong id="agent-next-action-title">\{nextQueueAction\.headline\}<\/strong>/);
  assert.match(page, /setQueueMode\(nextQueueAction\.mode \?\? "all"\)/);
  assert.match(page, /setSelectedCode\(null\)/);
  assert.match(page, /<button type="button" onClick=/);
});
