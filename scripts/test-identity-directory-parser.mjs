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

function expectParseCode(run, code) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof IdentityDirectoryParseError);
    assert.equal(error.code, code);
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

expectParseCode(
  () => parseCsv(`record_type,person_ref,person_type,commentaire,active_from
person,STU-001,student,information libre,2026-09-01`),
  "unsupported_column"
);

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

console.log("identity directory parser: 8/8 checks passed");
