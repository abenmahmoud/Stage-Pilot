import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import {
  decryptPersonAttributeValue,
  encryptPersonAttributeValue,
} from "../shared/person-attribute-crypto.ts";
import { parsePersonAttributeCsv } from "../shared/person-attribute-input.ts";

const env = {
  PERSON_ATTRIBUTE_ENCRYPTION_KEY_VERSION: "v1",
  PERSON_ATTRIBUTE_ENCRYPTION_KEY_V1: randomBytes(32).toString("base64"),
};
const context = {
  institutionId: "11111111-1111-4111-8111-111111111111",
  importId: "22222222-2222-4222-8222-222222222222",
  rowId: "33333333-3333-4333-8333-333333333333",
  personRef: "STU-DEMO-501",
  attributeKey: "groupe_option",
};

test("valide le contrat des attributs avec des données fictives", () => {
  const rows = parsePersonAttributeCsv(Buffer.from(`reference_personne,cle,valeur,valide_depuis,valide_jusquau,source
STU-DEMO-501,groupe_option,Groupe fictif A,2026-09-01,2027-08-31,export_fictif`, "utf8"));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].attributeKey, "groupe_option");
});

test("chiffre la valeur avec un contexte non interchangeable", () => {
  const envelope = encryptPersonAttributeValue({ ...context, value: "Valeur fictive", env });
  assert.equal(JSON.stringify(envelope).includes("Valeur fictive"), false);
  assert.equal(decryptPersonAttributeValue({ ...context, envelope, env }), "Valeur fictive");
  assert.throws(
    () => decryptPersonAttributeValue({ ...context, personRef: "STU-DEMO-502", envelope, env }),
    /authenticate|person_attribute/i
  );
});

test("refuse une clé réservée aux secrets", () => {
  assert.throws(
    () => parsePersonAttributeCsv(Buffer.from(`reference_personne,cle,valeur,valide_depuis,valide_jusquau,source
STU-DEMO-501,code_ent,valeur-fictive,2026-09-01,,export_fictif`, "utf8")),
    /person_attribute_row_invalid/
  );
});
