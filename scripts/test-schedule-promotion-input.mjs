import assert from "node:assert/strict";
import test from "node:test";
import { parseSchedulePromotionInput } from "../shared/schedule-promotion-input.ts";

test("accepts and normalizes a human justification", () => {
  const result = parseSchedulePromotionInput({
    justification: "  PDF vérifié, pages rapprochées et références contrôlées.  ",
  });
  assert.equal(result.justification, "PDF vérifié, pages rapprochées et références contrôlées.");
});

test("requires the exact activation confirmation", () => {
  assert.throws(
    () => parseSchedulePromotionInput({ justification: "Contrôle complet effectué par la direction.", confirmation: "activer" }, "ACTIVER"),
    /ACTIVER/
  );
  assert.doesNotThrow(
    () => parseSchedulePromotionInput({ justification: "Contrôle complet effectué par la direction.", confirmation: "ACTIVER" }, "ACTIVER")
  );
});

test("requires the exact rollback confirmation and a meaningful reason", () => {
  assert.throws(
    () => parseSchedulePromotionInput({ justification: "Trop court", confirmation: "RESTAURER" }, "RESTAURER"),
    /20 à 1 000/
  );
  assert.doesNotThrow(
    () => parseSchedulePromotionInput({ justification: "Retour à la version stable après contrôle.", confirmation: "RESTAURER" }, "RESTAURER")
  );
});
