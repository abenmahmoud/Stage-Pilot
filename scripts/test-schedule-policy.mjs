import assert from "node:assert/strict";
import test from "node:test";
import { readNextAuthorizedCourse } from "../shared/schedule-policy.ts";

const now = "2026-08-27T08:00:00.000Z";
const version = {
  id: "version-fictive-2",
  sourceType: "official_export",
  status: "active",
  effectiveFrom: "2026-08-24T00:00:00.000Z",
  effectiveUntil: "2026-12-31T23:59:59.000Z",
  activatedAt: "2026-08-26T17:00:00.000Z",
  freshUntil: "2026-08-28T17:00:00.000Z",
};
const slot = {
  id: "slot-fictif-1",
  sourceVersionId: version.id,
  classRef: "classe-fictive-a",
  groupRef: "groupe-fictif-1",
  teacherRef: "personnel-fictif-1",
  subjectCode: "SCI",
  subjectLabel: "Sciences",
  roomCode: "S-101",
  startsAt: "2026-08-27T09:00:00.000Z",
  endsAt: "2026-08-27T10:00:00.000Z",
  reviewStatus: "approved",
};
const studentViewer = {
  identityLevel: "school_identity",
  authorizedClassRefs: ["classe-fictive-a"],
  authorizedGroupRefs: ["groupe-fictif-1"],
  authorizedTeacherRefs: [],
};

function read(overrides = {}) {
  return readNextAuthorizedCourse({
    viewer: studentViewer,
    now,
    requestedAt: now,
    versions: [version],
    slots: [slot],
    changes: [],
    ...overrides,
  });
}

test("requires a school identity before reading a personal schedule", () => {
  for (const identityLevel of ["visitor", "contact_verified"]) {
    const result = read({ viewer: { ...studentViewer, identityLevel } });
    assert.deepEqual(result, { ok: false, reason: "school_identity_required" });
  }
});

test("returns only an authorized, approved course with its source", () => {
  const result = read();
  assert.equal(result.ok, true);
  assert.equal(result.course.subjectLabel, "Sciences");
  assert.equal(result.course.roomCode, "S-101");
  assert.equal(result.source.versionId, version.id);
  assert.equal("teacherRef" in result.course, false);
});

test("does not reveal whether another class has a course", () => {
  const result = read({
    viewer: {
      ...studentViewer,
      authorizedClassRefs: ["classe-fictive-b"],
      authorizedGroupRefs: [],
    },
  });
  assert.deepEqual(result, { ok: false, reason: "no_authorized_course" });
});

test("does not grant a group course to the whole class", () => {
  const result = read({
    viewer: {
      ...studentViewer,
      authorizedClassRefs: ["classe-fictive-a"],
      authorizedGroupRefs: ["groupe-fictif-2"],
    },
  });
  assert.deepEqual(result, { ok: false, reason: "no_authorized_course" });
});

test("refuses a stale or unapproved source", () => {
  assert.deepEqual(
    read({ versions: [{ ...version, freshUntil: "2026-08-26T17:00:00.000Z" }] }),
    { ok: false, reason: "source_stale" }
  );
  assert.deepEqual(read({ versions: [{ ...version, status: "review" }] }), {
    ok: false,
    reason: "source_unavailable",
  });
});

test("uses the most recently activated applicable version", () => {
  const oldVersion = {
    ...version,
    id: "version-fictive-1",
    activatedAt: "2026-08-25T17:00:00.000Z",
  };
  const result = read({
    versions: [oldVersion, version],
    slots: [
      { ...slot, id: "ancien-slot", sourceVersionId: oldVersion.id, roomCode: "S-050" },
      slot,
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.source.versionId, version.id);
  assert.equal(result.course.roomCode, "S-101");
});

test("does not answer from a slot awaiting human review", () => {
  const result = read({ slots: [{ ...slot, reviewStatus: "pending" }] });
  assert.deepEqual(result, { ok: false, reason: "no_authorized_course" });
});

test("applies the latest valid official room change", () => {
  const result = read({
    changes: [
      {
        id: "changement-fictif-1",
        baseSlotId: slot.id,
        changeType: "room_changed",
        newRoomCode: "S-204",
        newStartsAt: null,
        newEndsAt: null,
        observedAt: "2026-08-27T07:30:00.000Z",
        expiresAt: "2026-08-27T11:00:00.000Z",
        status: "active",
      },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.course.roomCode, "S-204");
  assert.equal(result.course.state, "moved");
  assert.equal(result.source.changeObservedAt, "2026-08-27T07:30:00.000Z");
});

test("refuses contradictory changes observed at the same time", () => {
  const baseChange = {
    id: "changement-fictif-a",
    baseSlotId: slot.id,
    changeType: "room_changed",
    newRoomCode: "S-204",
    newStartsAt: null,
    newEndsAt: null,
    observedAt: "2026-08-27T07:30:00.000Z",
    expiresAt: "2026-08-27T11:00:00.000Z",
    status: "active",
  };
  const result = read({
    changes: [baseChange, { ...baseChange, id: "changement-fictif-b", newRoomCode: "S-305" }],
  });
  assert.deepEqual(result, { ok: false, reason: "conflicting_changes" });
});

test("ignores an expired change instead of presenting it as current", () => {
  const result = read({
    changes: [
      {
        id: "changement-expire",
        baseSlotId: slot.id,
        changeType: "cancelled",
        newRoomCode: null,
        newStartsAt: null,
        newEndsAt: null,
        observedAt: "2026-08-26T07:00:00.000Z",
        expiresAt: "2026-08-26T12:00:00.000Z",
        status: "active",
      },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.course.state, "scheduled");
});

test("does not keep showing a room for a cancelled course", () => {
  const result = read({
    changes: [
      {
        id: "annulation-fictive",
        baseSlotId: slot.id,
        changeType: "cancelled",
        newRoomCode: null,
        newStartsAt: null,
        newEndsAt: null,
        observedAt: "2026-08-27T07:45:00.000Z",
        expiresAt: "2026-08-27T11:00:00.000Z",
        status: "active",
      },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.course.state, "cancelled");
  assert.equal(result.course.roomCode, null);
});
