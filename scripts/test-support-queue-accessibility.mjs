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
