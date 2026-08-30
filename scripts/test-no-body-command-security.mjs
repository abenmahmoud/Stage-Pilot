import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const noBodyCommands = [
  ["génération historique", "../api/admin/generate-prof-accounts.ts"],
  ["cachet Grand Oral", "../api/grand-oral/[id]/cachet.ts"],
  ["confirmation communication", "../api/communications/admin/documents/[id]/confirm.ts"],
];

test("les commandes sans payload désactivent le parseur HTTP", () => {
  for (const [label, relativePath] of noBodyCommands) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /bodyParser: false/, `${label} doit désactiver le parseur`);
    assert.doesNotMatch(source, /req\.body/, `${label} ne doit pas lire req.body`);
  }
});

test("la génération historique de comptes par code reste neutralisée", () => {
  const route = readFileSync(
    new URL("../api/admin/generate-prof-accounts.ts", import.meta.url),
    "utf8"
  );
  const page = readFileSync(new URL("../src/pages/admin/ImportPage.tsx", import.meta.url), "utf8");

  assert.match(route, /requireRole\(req/);
  assert.match(route, /requireAal2\(req\)/);
  assert.match(route, /new HttpError\(\s*410,/);
  assert.doesNotMatch(route, /auth\.users|crypt\(|prof\.lyceegest\.local/);
  assert.doesNotMatch(page, /generate-prof-accounts|Générer comptes profs/);
});

test("le cachet final du Grand Oral exige une authentification renforcée", () => {
  const source = readFileSync(
    new URL("../api/grand-oral/[id]/cachet.ts", import.meta.url),
    "utf8"
  );
  assert.match(source, /requireRole\(req/);
  assert.match(source, /requireAal2\(req\)/);
});
