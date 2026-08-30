import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const boundedRoutes = [
  ["réservation", "../api/schedule/admin/imports/index.ts", "8kb"],
  ["approbation", "../api/schedule/admin/imports/[id]/approve.ts", "4kb"],
  ["activation", "../api/schedule/admin/imports/[id]/activate.ts", "4kb"],
  ["restauration", "../api/schedule/admin/imports/[id]/rollback.ts", "4kb"],
  ["association de page", "../api/schedule/admin/imports/[id]/pages/index.ts", "4kb"],
];

test("borne les commandes d'emploi du temps qui acceptent un corps", () => {
  for (const [label, relativePath, limit] of boundedRoutes) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(
      source,
      new RegExp(`bodyParser: \\{ sizeLimit: "${limit}" \\}`),
      `${label} doit conserver sa limite ${limit}`
    );
    assert.match(source, /requireScheduleManager\(req\)/);
  }
});

test("désactive le parseur pour les deux actions sans payload", () => {
  for (const relativePath of [
    "../api/schedule/admin/imports/[id]/confirm.ts",
    "../api/schedule/admin/imports/[id]/pages/[pageId]/verify.ts",
  ]) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /bodyParser: false/);
    assert.doesNotMatch(source, /req\.body/);
    assert.match(source, /requireScheduleManager\(req\)/);
  }
});

test("le PDF reste envoyé directement au stockage privé", () => {
  const source = readFileSync(
    new URL("../api/schedule/admin/imports/index.ts", import.meta.url),
    "utf8"
  );
  assert.match(source, /createSignedUploadUrl\(storagePath\)/);
  assert.doesNotMatch(source, /Buffer\.from\(/);
});
