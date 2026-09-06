import assert from "node:assert/strict";
import test from "node:test";
import { parseScheduleSlotBatchInput } from "../shared/schedule-slot-input.ts";

const VALID_ROW = {
  subjectCode: "math",
  subjectLabel: "Mathématiques",
  roomCode: "b12",
  startsAt: "2026-09-07T06:00:00.000Z",
  endsAt: "2026-09-07T07:00:00.000Z",
  weekPattern: null,
  groupRef: null,
};

test("normalise une ligne valide", () => {
  const parsed = parseScheduleSlotBatchInput({ rows: [VALID_ROW] });
  assert.deepEqual(parsed, {
    rows: [{
      subjectCode: "MATH",
      subjectLabel: "Mathématiques",
      roomCode: "b12",
      startsAt: "2026-09-07T06:00:00.000Z",
      endsAt: "2026-09-07T07:00:00.000Z",
      weekPattern: null,
      groupRef: null,
    }],
  });
});

test("normalise une référence de groupe optionnelle", () => {
  const parsed = parseScheduleSlotBatchInput({
    rows: [{ ...VALID_ROW, groupRef: " lv2 esp ", weekPattern: "a" }],
  });
  assert.equal(parsed.rows[0].groupRef, "LV2-ESP");
  assert.equal(parsed.rows[0].weekPattern, "a");
});

test("rejette une liste vide, trop longue ou mal formée", () => {
  assert.throws(() => parseScheduleSlotBatchInput({ rows: [] }), /1 et 80/i);
  assert.throws(() => parseScheduleSlotBatchInput({ rows: Array(81).fill(VALID_ROW) }), /1 et 80/i);
  assert.throws(() => parseScheduleSlotBatchInput({}), /1 et 80/i);
  assert.throws(() => parseScheduleSlotBatchInput([VALID_ROW]), /1 et 80/i);
});

test("rejette un code matière hors norme", () => {
  assert.throws(
    () => parseScheduleSlotBatchInput({ rows: [{ ...VALID_ROW, subjectCode: "x".repeat(40) }] }),
    /code matière/i
  );
  assert.throws(
    () => parseScheduleSlotBatchInput({ rows: [{ ...VALID_ROW, subjectCode: "" }] }),
    /code matière/i
  );
});

test("rejette un intitulé de matière hors bornes", () => {
  assert.throws(
    () => parseScheduleSlotBatchInput({ rows: [{ ...VALID_ROW, subjectLabel: "x" }] }),
    /intitulé/i
  );
  assert.throws(
    () => parseScheduleSlotBatchInput({ rows: [{ ...VALID_ROW, subjectLabel: "x".repeat(121) }] }),
    /intitulé/i
  );
});

test("rejette des horaires invalides ou inversés", () => {
  assert.throws(
    () => parseScheduleSlotBatchInput({ rows: [{ ...VALID_ROW, startsAt: "pas une date" }] }),
    /horaires/i
  );
  assert.throws(
    () => parseScheduleSlotBatchInput({ rows: [{ ...VALID_ROW, startsAt: VALID_ROW.endsAt, endsAt: VALID_ROW.startsAt }] }),
    /fin doit suivre/i
  );
});

test("rejette une salle hors bornes", () => {
  assert.throws(
    () => parseScheduleSlotBatchInput({ rows: [{ ...VALID_ROW, roomCode: "x".repeat(41) }] }),
    /salle/i
  );
});

test("rejette les doublons dans un même envoi", () => {
  assert.throws(
    () => parseScheduleSlotBatchInput({ rows: [VALID_ROW, { ...VALID_ROW }] }),
    /double/i
  );
});
