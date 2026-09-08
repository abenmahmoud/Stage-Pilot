import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import {
  IdentityDirectoryParseError,
  parseIdentityDirectoryBytes,
} from "../workers/identity-directory-parser.mjs";

const pepper = "0123456789abcdef0123456789abcdef";

function parseCsv(csv, nextPepper = pepper) {
  return parseIdentityDirectoryBytes({
    bytes: Buffer.from(csv, "utf8"),
    fileName: "repertoire.csv",
    contactPepper: nextPepper,
  });
}

function expectParseCode(run, code, forbiddenFragments = []) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof IdentityDirectoryParseError);
    assert.equal(error.code, code);
    for (const fragment of forbiddenFragments) {
      assert.equal(error.message.includes(fragment), false, "secret leaked in parser error");
    }
    return true;
  });
}

const template = await readFile(
  new URL("../public/modeles/repertoire-identites-fictif.csv", import.meta.url)
);
const parsedTemplate = parseIdentityDirectoryBytes({
  bytes: template,
  fileName: "repertoire-identites-fictif.csv",
  contactPepper: pepper,
});
assert.deepEqual(
  {
    rows: parsedTemplate.summary.rowCount,
    people: parsedTemplate.summary.personCount,
    relationships: parsedTemplate.summary.relationshipCount,
    rejected: parsedTemplate.summary.rejectedRowCount,
  },
  { rows: 5, people: 3, relationships: 2, rejected: 0 }
);
const serialized = JSON.stringify(parsedTemplate.rows);
for (const rawValue of ["Lina", "Martin", "lina.martin@example.test", "+33600000001"]) {
  assert.equal(serialized.includes(rawValue), false, `raw value leaked: ${rawValue}`);
}
assert.equal(parsedTemplate.privateRows.length, 3);
assert.equal(parsedTemplate.privateRows[0].value.firstName, "Lina");
assert.equal(parsedTemplate.privateRows[0].value.academicEmail, "lina.martin@example.test");

const alternate = parseIdentityDirectoryBytes({
  bytes: template,
  fileName: "repertoire-identites-fictif.csv",
  contactPepper: "abcdef0123456789abcdef0123456789",
});
assert.notEqual(
  parsedTemplate.rows[0].academicEmailHash,
  alternate.rows[0].academicEmailHash,
  "contact fingerprints must be keyed"
);

const duplicate = parseCsv(`record_type,person_ref,person_type,academic_email,active_from
person,STU-001,student,eleve1@example.test,2026-09-01
person,STU-001,student,eleve2@example.test,2026-09-01`);
assert.equal(duplicate.summary.rejectedRowCount, 2);
assert.equal(duplicate.summary.issueCounts.duplicate_person_ref, 2);

const sharedPhone = parseCsv(`record_type,person_ref,person_type,phone,active_from
person,PAR-001,guardian,+33611111111,2026-09-01
person,PAR-002,guardian,+33611111111,2026-09-01`);
assert.equal(sharedPhone.summary.rejectedRowCount, 0);
assert.equal(sharedPhone.summary.warningRowCount, 2);
assert.equal(sharedPhone.summary.issueCounts.shared_phone, 2);

const brokenRelation = parseCsv(`record_type,person_ref,person_type,active_from,subject_person_ref,relationship_type,object_ref,valid_from
person,PAR-001,guardian,2026-09-01,,,,
relationship,,,,PAR-001,guardian_of,STU-404,2026-09-01`);
assert.equal(brokenRelation.summary.rejectedRowCount, 1);
assert.equal(brokenRelation.summary.issueCounts.unknown_object_ref, 1);

const depotContract = parseCsv(`type_ligne,reference_personne,type_personne,nom,prenom,date_naissance,reference_classe,email,telephone,type_relation,reference_sujet,reference_objet,valide_depuis,valide_jusquau,source,commentaire,actif
person,STU-DEMO-101,student,Fictif,Eleve,2010-03-12,2E5,eleve.101@example.test,,,,,2026-09-01,2027-08-31,ent,Donnee fictive,true
person,RESP-DEMO-101,guardian,Fictif,Responsable,,,responsable.101@example.test,+33600000101,,,,2026-09-01,2027-08-31,ent,Donnee fictive,1
relationship,,,,,,,,,guardian_of,RESP-DEMO-101,STU-DEMO-101,2026-09-01,2027-08-31,siecle,Donnee fictive,oui`);
assert.deepEqual(
  {
    rows: depotContract.summary.rowCount,
    people: depotContract.summary.personCount,
    relationships: depotContract.summary.relationshipCount,
    rejected: depotContract.summary.rejectedRowCount,
  },
  { rows: 3, people: 2, relationships: 1, rejected: 0 },
  "the exact 17-column Depot Lycee contract must be accepted"
);
assert.equal(depotContract.privateRows[0].value.personalEmail, "eleve.101@example.test");
assert.equal(depotContract.rows[0].personalEmailHash?.length, 64);
assert.equal(JSON.stringify(depotContract.rows).includes("eleve.101@example.test"), false);

const inactive = parseCsv(`type_ligne,reference_personne,type_personne,email,valide_depuis,actif
person,STU-DEMO-102,student,eleve.102@example.test,2026-09-01,false`);
assert.equal(inactive.summary.rejectedRowCount, 0);
assert.equal(inactive.summary.warningRowCount, 1);
assert.equal(inactive.summary.issueCounts.inactive_record, 1);

for (const [header, value] of [
  ["mot_de_passe", "Azerty123!"],
  ["code_ent", "BC93-2026"],
  ["code d'accès ENT", "BC93-2026"],
  ["api_key", "sk-exampletoken123456789"],
]) {
  expectParseCode(
    () => parseCsv(`record_type,person_ref,person_type,${header},active_from
person,STU-001,student,${value},2026-09-01`),
    "secret_forbidden",
    [value]
  );
}

for (const secretValue of [
  "Mot de passe: Azerty123!",
  "Code Pronote: 923864",
  "-----BEGIN PRIVATE KEY-----",
  "Bearer abcdefghijklmnopqrstuvwxyz123456",
]) {
  expectParseCode(
    () => parseCsv(`record_type,person_ref,person_type,first_name,active_from
person,STU-001,student,${secretValue},2026-09-01`),
    "secret_forbidden",
    [secretValue]
  );
}

const benignAccessHelp = parseCsv(`record_type,person_ref,person_type,first_name,last_name,service_code,active_from
person,STA-001,staff,Mot de passe oublié,Test,secretariat,2026-09-01`);
assert.equal(benignAccessHelp.summary.rejectedRowCount, 0);

const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.aoa_to_sheet([
  ["person_ref", "person_type", "academic_email", "active_from"],
  ["STA-001", "staff", "agent@example.test", "2026-09-01"],
]);
worksheet.C2 = { t: "s", f: "LOWER(\"AGENT@EXAMPLE.TEST\")", v: "agent@example.test" };
XLSX.utils.book_append_sheet(workbook, worksheet, "personnes");
const formulaWorkbook = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
expectParseCode(
  () => parseIdentityDirectoryBytes({
    bytes: formulaWorkbook,
    fileName: "formule.xlsx",
    contactPepper: pepper,
  }),
  "formula_not_allowed"
);

const invalidValues = parseCsv(`record_type,person_ref,person_type,phone,active_from,active_until
person,STU-001,student,abc,2026-13-01,2025-01-01`);
assert.equal(invalidValues.summary.rejectedRowCount, 1);
assert.equal(invalidValues.summary.issueCounts.invalid_phone, 1);
assert.equal(invalidValues.summary.issueCounts.invalid_date, 1);

console.log("identity directory parser: 17/17 checks passed");
