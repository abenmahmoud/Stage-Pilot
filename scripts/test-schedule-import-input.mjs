import assert from "node:assert/strict";
import test from "node:test";
import {
  parseScheduleImportInput,
  SCHEDULE_IMPORT_MAX_BYTES,
} from "../shared/schedule-import-input.ts";

const valid = {
  sourceKind: "classes",
  sourceFormat: "pdf_import",
  schoolYear: "2026-2027",
  title: "Emplois du temps classes - rentrée",
  purposeDescription: "Version entièrement fictive destinée à la recette de la preview.",
  effectiveFrom: "2026-08-25",
  effectiveUntil: "2027-06-30",
  freshUntil: "2026-09-01",
  originalName: "emplois-du-temps-classes.pdf",
  mimeType: "application/pdf",
  sizeBytes: 42_000,
};

test("accepts a bounded PDF for a consecutive school year", () => {
  assert.deepEqual(parseScheduleImportInput(valid), valid);
});

test("accepts the teacher scope and a date in the second calendar year", () => {
  const result = parseScheduleImportInput({
    ...valid,
    sourceKind: "teachers",
    effectiveFrom: "2027-01-05",
    freshUntil: "2027-01-12",
  });
  assert.equal(result.sourceKind, "teachers");
});

test("rejects non-consecutive school years and out-of-scope dates", () => {
  assert.throws(() => parseScheduleImportInput({ ...valid, schoolYear: "2026-2028" }), /format 2026-2027/i);
  assert.throws(() => parseScheduleImportInput({ ...valid, effectiveFrom: "2028-01-05" }), /année scolaire/i);
});

test("requires freshness inside the declared validity period", () => {
  assert.throws(
    () => parseScheduleImportInput({ ...valid, freshUntil: "2026-08-24" }),
    /recontrôle.*période/i
  );
  assert.throws(
    () => parseScheduleImportInput({ ...valid, effectiveUntil: "2026-08-24" }),
    /fin.*précéder/i
  );
  assert.throws(
    () => parseScheduleImportInput({ ...valid, freshUntil: "2027-07-01" }),
    /recontrôle.*période/i
  );
});

test("rejects unsafe paths and non-PDF documents", () => {
  assert.throws(() => parseScheduleImportInput({ ...valid, originalName: "../secret.pdf" }), /nom est valide/i);
  assert.throws(() => parseScheduleImportInput({ ...valid, mimeType: "text/csv" }), /PDF/i);
  assert.throws(() => parseScheduleImportInput({ ...valid, originalName: "planning.xlsx" }), /PDF/i);
});

test("rejects empty and oversized files", () => {
  assert.throws(() => parseScheduleImportInput({ ...valid, sizeBytes: 0 }), /50 Mo/i);
  assert.throws(
    () => parseScheduleImportInput({ ...valid, sizeBytes: SCHEDULE_IMPORT_MAX_BYTES + 1 }),
    /50 Mo/i
  );
});

test("removes control characters from human labels", () => {
  const result = parseScheduleImportInput({ ...valid, title: "Version\u0000 rentrée" });
  assert.equal(result.title, "Version rentrée");
});

test("defaults to pdf_import when sourceFormat is omitted (backward compatibility)", () => {
  const { sourceFormat, ...withoutFormat } = valid;
  const result = parseScheduleImportInput(withoutFormat);
  assert.equal(result.sourceFormat, "pdf_import");
});

test("accepts a bounded CSV tabular import", () => {
  const result = parseScheduleImportInput({
    ...valid,
    sourceFormat: "tabular_import",
    originalName: "export-edt.csv",
    mimeType: "text/csv",
  });
  assert.equal(result.sourceFormat, "tabular_import");
  assert.equal(result.mimeType, "text/csv");
});

test("accepts a bounded Excel tabular import", () => {
  const result = parseScheduleImportInput({
    ...valid,
    sourceFormat: "tabular_import",
    originalName: "export-edt.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  assert.equal(result.mimeType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
});

test("rejects a tabular import with a PDF mime type, a PDF name, or an unknown format", () => {
  assert.throws(
    () => parseScheduleImportInput({ ...valid, sourceFormat: "tabular_import", originalName: "export.csv", mimeType: "application/pdf" }),
    /CSV ou Excel/i
  );
  assert.throws(
    () => parseScheduleImportInput({ ...valid, sourceFormat: "tabular_import", originalName: "export.pdf", mimeType: "text/csv" }),
    /CSV ou Excel/i
  );
  assert.throws(() => parseScheduleImportInput({ ...valid, sourceFormat: "xml_import" }), /format du fichier/i);
});
