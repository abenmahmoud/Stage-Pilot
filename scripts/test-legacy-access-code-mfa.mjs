import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const protectedRoutes = [
  ["liste élèves", "../api/admin/codes-acces.ts"],
  ["liste professeurs", "../api/admin/codes-profs.ts"],
  ["import élèves", "../api/import/eleves.ts"],
  ["import professeurs", "../api/import/professeurs.ts"],
];

test("les accès aux identifiants historiques exigent rôle et MFA", () => {
  for (const [label, relativePath] of protectedRoutes) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /requireRole\(req/, `${label} doit vérifier le rôle`);
    assert.match(source, /requireAal2\(req\)/, `${label} doit exiger aal2`);
  }
});

test("la génération massive de comptes reste retirée", () => {
  const source = readFileSync(
    new URL("../api/admin/generate-prof-accounts.ts", import.meta.url),
    "utf8"
  );
  assert.match(source, /new HttpError\(\s*410,/);
  assert.doesNotMatch(source, /auth\.users|encrypted_password/);
});
