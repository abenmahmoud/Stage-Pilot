import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const boundedRoutes = [
  ["registre", "../api/knowledge/admin/index.ts", "64kb"],
  ["version", "../api/knowledge/admin/versions/[id].ts", "64kb"],
  ["document", "../api/knowledge/admin/documents/index.ts", "16kb"],
  ["évaluation", "../api/knowledge/admin/versions/[id]/evaluations.ts", "32kb"],
  ["action de version", "../api/knowledge/admin/versions/[id]/action.ts", "4kb"],
  ["action de source", "../api/knowledge/admin/sources/[id]/action.ts", "4kb"],
  ["revue documentaire", "../api/knowledge/admin/documents/[id]/review.ts", "4kb"],
];

test("borne les mutations du registre de connaissances", () => {
  for (const [label, relativePath, limit] of boundedRoutes) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(
      source,
      new RegExp(`bodyParser: \\{ sizeLimit: "${limit}" \\}`),
      `${label} doit conserver sa limite ${limit}`
    );
    assert.match(source, /requireKnowledgeManager\(req/);
  }
});

test("la confirmation documentaire sans payload ne lit aucun corps", () => {
  const source = readFileSync(
    new URL("../api/knowledge/admin/documents/[id]/confirm.ts", import.meta.url),
    "utf8"
  );
  assert.match(source, /bodyParser: false/);
  assert.doesNotMatch(source, /req\.body/);
  assert.match(source, /requireKnowledgeManager\(req/);
});

test("le document de connaissance reste envoyé directement au stockage privé", () => {
  const source = readFileSync(
    new URL("../api/knowledge/admin/documents/index.ts", import.meta.url),
    "utf8"
  );
  assert.match(source, /createSignedUploadUrl\(storagePath\)/);
  assert.doesNotMatch(source, /Buffer\.from\(/);
});

test("conserve les limites métier des instructions et preuves", () => {
  const registry = readFileSync(
    new URL("../shared/knowledge-registry-input.ts", import.meta.url),
    "utf8"
  );
  assert.match(registry, /instructions: text\(input\.instructions, "Instructions", 20, 12_000\)/);
  assert.match(registry, /observed: text\(evidenceInput\.observed, "Résultat observé", 10, 2_500\)/);
});
