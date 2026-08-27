import assert from "node:assert/strict";
import test from "node:test";
import {
  assessSupportQueueItem,
  compareSupportQueueItems,
} from "../shared/support-queue-policy.ts";

const now = "2026-08-27T10:00:00.000Z";
const request = {
  status: "nouveau",
  priority: "p3",
  assignedTo: null,
  slaDueAt: "2026-08-27T12:00:00.000Z",
  createdAt: "2026-08-27T08:00:00.000Z",
};

test("detects requests that still need human qualification", () => {
  const result = assessSupportQueueItem({ ...request, status: "a_qualifier" }, now);
  assert.equal(result.needsQualification, true);
  assert.equal(result.unassigned, true);
});

test("detects an overdue open request without inventing a new deadline", () => {
  const result = assessSupportQueueItem(
    { ...request, slaDueAt: "2026-08-27T09:59:59.000Z" },
    now
  );
  assert.equal(result.overdue, true);
});

test("does not flag a resolved or closed request as unassigned or overdue", () => {
  for (const status of ["resolu", "clos", "indesirable"]) {
    const result = assessSupportQueueItem(
      { ...request, status, slaDueAt: "2026-08-27T09:00:00.000Z" },
      now
    );
    assert.equal(result.closed, true);
    assert.equal(result.unassigned, false);
    assert.equal(result.overdue, false);
  }
});

test("orders priority before the deadline", () => {
  const criticalLater = { ...request, priority: "p1", slaDueAt: "2026-08-28T12:00:00.000Z" };
  const normalSooner = { ...request, priority: "p3", slaDueAt: "2026-08-27T10:05:00.000Z" };
  assert.equal(compareSupportQueueItems(criticalLater, normalSooner) < 0, true);
});

test("orders the closest recorded deadline first at equal priority", () => {
  const sooner = { ...request, slaDueAt: "2026-08-27T10:30:00.000Z" };
  const later = { ...request, slaDueAt: "2026-08-27T11:30:00.000Z" };
  assert.equal(compareSupportQueueItems(sooner, later) < 0, true);
});

test("keeps requests without a deadline after dated requests", () => {
  const withoutDeadline = { ...request, slaDueAt: null };
  assert.equal(compareSupportQueueItems(request, withoutDeadline) < 0, true);
});
