import assert from "node:assert/strict";
import test from "node:test";
import { planSupportCallbackTransition } from "../shared/support-callback-policy.ts";

const completedAt = "2026-08-27T10:00:00.000Z";

test("lets an agent claim an unassigned callback", () => {
  assert.deepEqual(
    planSupportCallbackTransition({
      status: "todo",
      assignedTo: null,
      actorId: "agent-a",
      action: "claim",
      completedAt,
    }),
    {
      ok: true,
      status: "in_progress",
      assignedTo: "agent-a",
      outcome: null,
      completedAt: null,
      changed: true,
    }
  );
});

test("keeps a repeated claim by the same agent idempotent", () => {
  const result = planSupportCallbackTransition({
    status: "in_progress",
    assignedTo: "agent-a",
    actorId: "agent-a",
    action: "claim",
    completedAt,
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.changed, false);
});

test("prevents one agent from taking another agent callback", () => {
  assert.deepEqual(
    planSupportCallbackTransition({
      status: "in_progress",
      assignedTo: "agent-a",
      actorId: "agent-b",
      action: "claim",
      completedAt,
    }),
    { ok: false, reason: "owned_by_other" }
  );
});

test("requires a useful result before completing a callback", () => {
  const result = planSupportCallbackTransition({
    status: "in_progress",
    assignedTo: "agent-a",
    actorId: "agent-a",
    action: "complete",
    outcome: " ",
    completedAt,
  });
  assert.deepEqual(result, { ok: false, reason: "outcome_required" });
});

test("records the result and completion time", () => {
  const result = planSupportCallbackTransition({
    status: "in_progress",
    assignedTo: "agent-a",
    actorId: "agent-a",
    action: "complete",
    outcome: " Parent rappelé, explication comprise. ",
    completedAt,
  });
  assert.deepEqual(result, {
    ok: true,
    status: "done",
    assignedTo: "agent-a",
    outcome: "Parent rappelé, explication comprise.",
    completedAt,
    changed: true,
  });
});

test("never reopens a finished callback through the transition API", () => {
  const result = planSupportCallbackTransition({
    status: "done",
    assignedTo: "agent-a",
    actorId: "agent-a",
    action: "claim",
    completedAt,
  });
  assert.deepEqual(result, { ok: false, reason: "already_finished" });
});
