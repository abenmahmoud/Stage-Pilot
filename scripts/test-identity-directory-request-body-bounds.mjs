import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const boundedRoutes = [
  ["réservation", "../api/identity/admin/imports/index.ts", "8kb"],
  ["approbation", "../api/identity/admin/imports/[id]/approve.ts", "4kb"],
  ["activation", "../api/identity/admin/imports/[id]/activate.ts", "4kb"],
  ["retrait", "../api/identity/admin/imports/[id]/retire.ts", "4kb"],
  ["consultation", "../api/identity/admin/lookups/index.ts", "4kb"],
];

test("borne les commandes du répertoire des identités", () => {
  for (const [label, relativePath, limit] of boundedRoutes) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(
      source,
      new RegExp(`bodyParser: \\{ sizeLimit: "${limit}" \\}`),
      `${label} doit conserver sa limite ${limit}`
    );
    assert.match(source, /requireIdentityDirectoryManager\(req\)/);
  }
});

test("la confirmation sans payload ne lit aucun corps", () => {
  const source = readFileSync(
    new URL("../api/identity/admin/imports/[id]/confirm.ts", import.meta.url),
    "utf8"
  );
  assert.match(source, /bodyParser: false/);
  assert.doesNotMatch(source, /req\.body/);
  assert.match(source, /requireIdentityDirectoryManager\(req\)/);
});

test("le fichier d'identités reste envoyé directement au stockage privé", () => {
  const reservation = readFileSync(
    new URL("../api/identity/admin/imports/index.ts", import.meta.url),
    "utf8"
  );
  assert.match(reservation, /createSignedUploadUrl\(storagePath\)/);
  assert.doesNotMatch(reservation, /Buffer\.from\(/);
});
