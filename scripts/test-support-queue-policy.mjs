import assert from "node:assert/strict";
import test from "node:test";
import {
  assessSupportQueueItem,
  compareSupportQueueItems,
  resolveSupportQueueNextAction,
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

test("does not treat a request without an explicit deadline as overdue", () => {
  const result = assessSupportQueueItem({ ...request, slaDueAt: null }, now);
  assert.equal(result.overdue, false);
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

const emptyStats = {
  total: 0,
  urgent: 0,
  overdue: 0,
  qualify: 0,
  unassigned: 0,
  waitingInternal: 0,
  callbacks: 0,
  duplicates: 0,
};

test("guides the agent through validated signals without taking an action", () => {
  const priorities = [
    ["urgent", "urgent"],
    ["overdue", "overdue"],
    ["qualify", "qualify"],
    ["unassigned", "unassigned"],
    ["waitingInternal", "internal"],
    ["callbacks", "callbacks"],
    ["duplicates", "duplicates"],
  ];
  for (const [counter, expectedMode] of priorities) {
    const result = resolveSupportQueueNextAction({
      ...emptyStats,
      total: 3,
      [counter]: 3,
    });
    assert.equal(result.mode, expectedMode);
    assert.equal(result.count, 3);
    assert.ok(result.actionLabel);
  }
});

test("keeps urgent and recorded overdue work ahead of lower signals", () => {
  assert.equal(resolveSupportQueueNextAction({
    ...emptyStats,
    total: 10,
    urgent: 1,
    overdue: 2,
    qualify: 3,
    unassigned: 4,
  }).mode, "urgent");
  assert.equal(resolveSupportQueueNextAction({
    ...emptyStats,
    total: 9,
    overdue: 2,
    qualify: 3,
    unassigned: 4,
  }).mode, "overdue");
});

test("falls back to the complete scoped queue without inventing an alert", () => {
  const result = resolveSupportQueueNextAction({ ...emptyStats, total: 6 });
  assert.equal(result.mode, "all");
  assert.equal(result.count, 6);
  assert.match(result.detail, /Aucun signal prioritaire/);
});

test("reports a genuinely empty scoped queue without an action button", () => {
  const result = resolveSupportQueueNextAction(emptyStats);
  assert.equal(result.mode, null);
  assert.equal(result.count, 0);
  assert.equal(result.actionLabel, null);
});
