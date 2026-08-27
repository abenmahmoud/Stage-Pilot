export const SUPPORT_CALLBACK_STATUSES = [
  "todo",
  "in_progress",
  "done",
  "cancelled",
] as const;

export type SupportCallbackStatus = (typeof SUPPORT_CALLBACK_STATUSES)[number];
export type SupportCallbackAction = "claim" | "complete" | "cancel";

type CallbackTransitionInput = {
  status: string;
  assignedTo: string | null;
  actorId: string;
  action: SupportCallbackAction;
  outcome?: unknown;
  completedAt: string;
};

export type CallbackTransitionResult =
  | {
      ok: true;
      status: SupportCallbackStatus;
      assignedTo: string;
      outcome: string | null;
      completedAt: string | null;
      changed: boolean;
    }
  | {
      ok: false;
      reason: "invalid_status" | "already_finished" | "owned_by_other" | "outcome_required";
    };

function cleanOutcome(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
  return clean.length >= 2 && clean.length <= 1000 ? clean : null;
}

export function planSupportCallbackTransition(
  input: CallbackTransitionInput
): CallbackTransitionResult {
  if (!SUPPORT_CALLBACK_STATUSES.includes(input.status as SupportCallbackStatus)) {
    return { ok: false, reason: "invalid_status" };
  }
  if (input.status === "done" || input.status === "cancelled") {
    return { ok: false, reason: "already_finished" };
  }
  if (input.assignedTo && input.assignedTo !== input.actorId) {
    return { ok: false, reason: "owned_by_other" };
  }

  if (input.action === "claim") {
    return {
      ok: true,
      status: "in_progress",
      assignedTo: input.actorId,
      outcome: null,
      completedAt: null,
      changed: input.status !== "in_progress" || input.assignedTo !== input.actorId,
    };
  }

  const outcome = cleanOutcome(input.outcome);
  if (!outcome) return { ok: false, reason: "outcome_required" };
  return {
    ok: true,
    status: input.action === "complete" ? "done" : "cancelled",
    assignedTo: input.actorId,
    outcome,
    completedAt: input.completedAt,
    changed: true,
  };
}
