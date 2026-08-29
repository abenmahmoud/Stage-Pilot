import assert from "node:assert/strict";
import test from "node:test";
import {
  parseScheduleImportInput,
  SCHEDULE_IMPORT_MAX_BYTES,
} from "../shared/schedule-import-input.ts";

const valid = {
  sourceKind: "classes",
  schoolYear: "2026-2027",
  title: "Emplois du temps classes - rentrée",
  purposeDescription: "Version entièrement fictive destinée à la recette de la preview.",
  effectiveFrom: "2026-08-25",
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
  });
  assert.equal(result.sourceKind, "teachers");
});

test("rejects non-consecutive school years and out-of-scope dates", () => {
  assert.throws(() => parseScheduleImportInput({ ...valid, schoolYear: "2026-2028" }), /format 2026-2027/i);
  assert.throws(() => parseScheduleImportInput({ ...valid, effectiveFrom: "2028-01-05" }), /année scolaire/i);
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
