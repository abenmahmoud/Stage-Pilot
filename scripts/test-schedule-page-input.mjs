import assert from "node:assert/strict";
import test from "node:test";
import { parseSchedulePageMappingInput } from "../shared/schedule-page-input.ts";

test("normalizes an opaque page reference", () => {
  assert.deepEqual(parseSchedulePageMappingInput({ pageNumber: 12, subjectRef: " classe 2nde-01 " }), {
    pageNumber: 12,
    subjectRef: "CLASSE-2NDE-01",
  });
});

test("accepts an opaque personnel reference", () => {
  assert.equal(
    parseSchedulePageMappingInput({ pageNumber: 1, subjectRef: "PERSONNEL:0042" }).subjectRef,
    "PERSONNEL:0042"
  );
});

test("rejects out-of-range pages and identifying free text", () => {
  assert.throws(() => parseSchedulePageMappingInput({ pageNumber: 0, subjectRef: "CLASSE-01" }), /1 et 500/i);
  assert.throws(() => parseSchedulePageMappingInput({ pageNumber: 3, subjectRef: "Nom Prénom" }), /référence/i);
  assert.throws(() => parseSchedulePageMappingInput({ pageNumber: 3, subjectRef: "A" }), /référence/i);
});
