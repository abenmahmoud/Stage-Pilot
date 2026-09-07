import assert from "node:assert/strict";
import test from "node:test";

import { parseEntActifRequestInput } from "../api/_shared/code-vault-ent-actif-route.ts";

test("accepte une entrée valide et ne renvoie que le champ attendu", () => {
  const parsed = parseEntActifRequestInput({ outcome: "start" });
  assert.deepEqual(parsed, { outcome: "start" });
});

test("accepte les quatre issues connues du parcours", () => {
  for (const outcome of ["start", "succeeded", "failed", "coordinate_incorrect"]) {
    assert.deepEqual(parseEntActifRequestInput({ outcome }), { outcome });
  }
});

test("rejette une valeur qui n'est pas un objet simple", () => {
  for (const value of [null, undefined, "start", 42, ["start"]]) {
    assert.throws(() => parseEntActifRequestInput(value), /ent_actif_input_invalid/);
  }
});

test("rejette un champ inconnu ou un champ manquant", () => {
  assert.throws(
    () => parseEntActifRequestInput({ outcome: "start", extra: "non-attendu" }),
    /ent_actif_input_invalid/
  );
  assert.throws(() => parseEntActifRequestInput({}), /ent_actif_input_invalid/);
});

test("rejette une issue hors du contrat pur", () => {
  assert.throws(
    () => parseEntActifRequestInput({ outcome: "abandoned" }),
    /ent_actif_outcome_invalid/
  );
});
