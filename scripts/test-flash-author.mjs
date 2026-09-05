// LOT 3 du plan de publication flash — preuve de la partie pure de
// `api/_shared/flash-author.ts` (`formatFlashAuthorName`). La résolution par
// base (`resolveFlashAuthorNames`) n'est pas testable ici sans pile
// PostgreSQL (voir les nuits précédentes, Docker Desktop indisponible) ; elle
// est vérifiée par lecture dans les tests de wiring des routes qui l'appellent.
import assert from "node:assert/strict";
import test from "node:test";

// Même motif que scripts/test-flash-access.mjs : `flash-author.ts` importe
// `db/index.ts` au niveau module (pour `resolveFlashAuthorNames`), qui exige
// `DATABASE_URL` même si ce test ne touche que la fonction pure
// `formatFlashAuthorName`. Fixture, jamais une vraie base.
process.env.DATABASE_URL ??= "postgres://fixture:fixture@127.0.0.1:1/fixture";

const { formatFlashAuthorName } = await import("../api/_shared/flash-author.ts");

test("compose 'Prénom Nom' pour une fiche complète", () => {
  assert.equal(formatFlashAuthorName({ nom: "Martin", prenom: "Claire" }), "Claire Martin");
});

test("renvoie null pour une fiche absente", () => {
  assert.equal(formatFlashAuthorName(null), null);
  assert.equal(formatFlashAuthorName(undefined), null);
});

test("renvoie null plutôt qu'une chaîne vide si nom et prénom sont vides", () => {
  assert.equal(formatFlashAuthorName({ nom: "", prenom: "" }), null);
});

test("retire les espaces superflus sans inventer de séparateur", () => {
  assert.equal(formatFlashAuthorName({ nom: "Dupont", prenom: "" }), "Dupont");
  assert.equal(formatFlashAuthorName({ nom: "", prenom: "Alex" }), "Alex");
});
