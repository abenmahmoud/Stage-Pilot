// Test sans base du LOT 4 (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`),
// même forme que `test-code-vault-ent-inactif-route.mjs` (LOT 3) :
// `parseServiceDeliveryRequestInput` pour les parcours cantine et koxo.
import assert from "node:assert/strict";
import test from "node:test";

import { parseServiceDeliveryRequestInput } from "../api/_shared/code-vault-service-delivery-route.ts";

for (const journeyType of ["cantine", "koxo"]) {
  test(`${journeyType} : accepte une entrée valide et ne renvoie que les trois champs attendus`, () => {
    const parsed = parseServiceDeliveryRequestInput(journeyType, {
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

  test(`${journeyType} : accepte la phase lookup_failed, propre à ces deux parcours`, () => {
    const parsed = parseServiceDeliveryRequestInput(journeyType, {
      phase: "lookup_failed",
      proofChannel: "phone",
      schoolYear: "2026-2027",
    });
    assert.equal(parsed.phase, "lookup_failed");
  });

  test(`${journeyType} : rejette une valeur qui n'est pas un objet simple`, () => {
    for (const value of [null, undefined, "verified", 42, ["verified"]]) {
      assert.throws(
        () => parseServiceDeliveryRequestInput(journeyType, value),
        new RegExp(`${journeyType}_input_invalid`)
      );
    }
  });

  test(`${journeyType} : rejette un champ inconnu ou un champ manquant`, () => {
    assert.throws(
      () =>
        parseServiceDeliveryRequestInput(journeyType, {
          phase: "verified",
          proofChannel: "email",
          schoolYear: "2026-2027",
          extra: "non-attendu",
        }),
      new RegExp(`${journeyType}_input_invalid`)
    );
    assert.throws(
      () => parseServiceDeliveryRequestInput(journeyType, { phase: "verified", proofChannel: "email" }),
      new RegExp(`${journeyType}_input_invalid`)
    );
  });

  test(`${journeyType} : rejette une phase inconnue du parcours`, () => {
    assert.throws(
      () =>
        parseServiceDeliveryRequestInput(journeyType, {
          phase: "revealed",
          proofChannel: "email",
          schoolYear: "2026-2027",
        }),
      new RegExp(`${journeyType}_phase_invalid`)
    );
  });

  test(`${journeyType} : rejette un canal de preuve hors email/phone`, () => {
    assert.throws(
      () =>
        parseServiceDeliveryRequestInput(journeyType, {
          phase: "verified",
          proofChannel: "sms",
          schoolYear: "2026-2027",
        }),
      new RegExp(`${journeyType}_proof_channel_invalid`)
    );
  });

  test(`${journeyType} : rejette une année scolaire qui ne respecte pas AAAA-AAAA`, () => {
    for (const schoolYear of ["2026", "2026/2027", "26-27", "2026-2027 "]) {
      assert.throws(
        () => parseServiceDeliveryRequestInput(journeyType, { phase: "verified", proofChannel: "email", schoolYear }),
        new RegExp(`${journeyType}_school_year_invalid`)
      );
    }
  });
}
