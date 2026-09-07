import assert from "node:assert/strict";
import test from "node:test";
import { parseScheduleSlotWritePayload } from "../shared/schedule-slot-write-payload.ts";

const SLOT_ID = "11111111-1111-1111-8111-111111111111";

const VALID_SLOT = {
  id: SLOT_ID,
  classRef: "CLASSE-2NDE-01",
  groupRef: null,
  teacherRef: null,
  subjectCode: "MATH",
  subjectLabel: "Mathématiques",
  roomCode: "B12",
  startsAt: "2026-09-07T06:00:00.000Z",
  endsAt: "2026-09-07T07:00:00.000Z",
  weekPattern: null,
};

const EXPECTED_CLASS = { subjectType: "class", subjectRef: "CLASSE-2NDE-01", rowCount: 1 };

test("accepte une réponse valide portant la référence de classe attendue", () => {
  const parsed = parseScheduleSlotWritePayload({ slots: [VALID_SLOT] }, EXPECTED_CLASS);
  assert.deepEqual(parsed, { slots: [VALID_SLOT] });
});

test("accepte un professeur avec classRef null", () => {
  const slot = { ...VALID_SLOT, classRef: null, teacherRef: "PERSONNEL-0042" };
  const parsed = parseScheduleSlotWritePayload(
    { slots: [slot] },
    { subjectType: "teacher", subjectRef: "PERSONNEL-0042", rowCount: 1 }
  );
  assert.deepEqual(parsed, { slots: [slot] });
});

test("rejette un nombre de créneaux différent de celui attendu", () => {
  assert.equal(parseScheduleSlotWritePayload({ slots: [VALID_SLOT] }, { ...EXPECTED_CLASS, rowCount: 2 }), null);
});

test("rejette une référence de classe ne correspondant pas à la page", () => {
  const slot = { ...VALID_SLOT, classRef: "CLASSE-2NDE-02" };
  assert.equal(parseScheduleSlotWritePayload({ slots: [slot] }, EXPECTED_CLASS), null);
});

test("rejette un créneau portant à la fois classRef et teacherRef", () => {
  const slot = { ...VALID_SLOT, teacherRef: "PERSONNEL-0042" };
  assert.equal(parseScheduleSlotWritePayload({ slots: [slot] }, EXPECTED_CLASS), null);
});

test("rejette un créneau sans classRef ni teacherRef", () => {
  const slot = { ...VALID_SLOT, classRef: null };
  assert.equal(parseScheduleSlotWritePayload({ slots: [slot] }, EXPECTED_CLASS), null);
});

test("rejette des horaires inversés", () => {
  const slot = { ...VALID_SLOT, startsAt: VALID_SLOT.endsAt, endsAt: VALID_SLOT.startsAt };
  assert.equal(parseScheduleSlotWritePayload({ slots: [slot] }, EXPECTED_CLASS), null);
});

test("rejette un champ supplémentaire ou manquant", () => {
  const withExtra = { ...VALID_SLOT, extra: true };
  assert.equal(parseScheduleSlotWritePayload({ slots: [withExtra] }, EXPECTED_CLASS), null);
  const { weekPattern: _omit, ...withoutField } = VALID_SLOT;
  assert.equal(parseScheduleSlotWritePayload({ slots: [withoutField] }, EXPECTED_CLASS), null);
});

test("rejette une racine mal formée", () => {
  assert.equal(parseScheduleSlotWritePayload([VALID_SLOT], EXPECTED_CLASS), null);
  assert.equal(parseScheduleSlotWritePayload({ slots: [VALID_SLOT], extra: 1 }, EXPECTED_CLASS), null);
});
