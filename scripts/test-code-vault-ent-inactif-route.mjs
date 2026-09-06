import assert from "node:assert/strict";
import test from "node:test";

import { parseEntInactifRequestInput } from "../api/_shared/code-vault-ent-inactif-route.ts";

test("accepte une entrée valide et ne renvoie que les trois champs attendus", () => {
  const parsed = parseEntInactifRequestInput({
    phase: "verified",
    proofChannel: "email",
    schoolYear: "2026-2027",
  });
  assert.deepEqual(parsed, {
    phase: "verified",
    proofChannel: "email",
    schoolYear: "2026-2027",
  });
});

test("rejette une valeur qui n'est pas un objet simple", () => {
  for (const value of [null, undefined, "verified", 42, ["verified"]]) {
    assert.throws(() => parseEntInactifRequestInput(value), /ent_inactif_input_invalid/);
  }
});

test("rejette un champ inconnu ou un champ manquant", () => {
  assert.throws(
    () =>
      parseEntInactifRequestInput({
        phase: "verified",
        proofChannel: "email",
        schoolYear: "2026-2027",
        extra: "non-attendu",
      }),
    /ent_inactif_input_invalid/
  );
  assert.throws(
    () => parseEntInactifRequestInput({ phase: "verified", proofChannel: "email" }),
    /ent_inactif_input_invalid/
  );
});

test("rejette une phase inconnue du parcours ENT inactif", () => {
  assert.throws(
    () =>
      parseEntInactifRequestInput({
        phase: "revealed_forever",
        proofChannel: "email",
        schoolYear: "2026-2027",
      }),
    /ent_inactif_phase_invalid/
  );
});

test("rejette un canal de preuve hors email/phone", () => {
  assert.throws(
    () =>
      parseEntInactifRequestInput({
        phase: "verified",
        proofChannel: "sms",
        schoolYear: "2026-2027",
      }),
    /ent_inactif_proof_channel_invalid/
  );
});

test("rejette une année scolaire qui ne respecte pas AAAA-AAAA", () => {
  for (const schoolYear of ["2026", "2026/2027", "26-27", "2026-2027 "]) {
    assert.throws(
      () => parseEntInactifRequestInput({ phase: "verified", proofChannel: "email", schoolYear }),
      /ent_inactif_school_year_invalid/
    );
  }
});
