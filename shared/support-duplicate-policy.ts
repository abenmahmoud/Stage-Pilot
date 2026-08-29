export const SUPPORT_DUPLICATE_WINDOW_DAYS = 7;

export const SUPPORT_DUPLICATE_EVENT_TYPES = [
  "request.duplicate_suspected",
  "request.duplicate_confirmed",
  "request.duplicate_dismissed",
] as const;

export type SupportDuplicateDecision = "pending" | "confirmed" | "dismissed";

type DuplicateEvent = {
  eventType: string;
  toValue: unknown;
  createdAt: Date | string;
};

export type SupportDuplicateReview = {
  status: SupportDuplicateDecision;
  candidateRequestId: string;
  reason: string;
  decidedAt: string | null;
};

function eventDate(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date(0).toISOString();
}

function eventPayload(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

export function supportDuplicateWindowStart(now = new Date()): Date {
  return new Date(now.getTime() - SUPPORT_DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

export function deriveSupportDuplicateReview(
  events: DuplicateEvent[]
): SupportDuplicateReview | null {
  const latest = [...events]
    .filter((event) => SUPPORT_DUPLICATE_EVENT_TYPES.includes(
      event.eventType as (typeof SUPPORT_DUPLICATE_EVENT_TYPES)[number]
    ))
    .sort((left, right) => eventDate(right.createdAt).localeCompare(eventDate(left.createdAt)))[0];
  if (!latest) return null;

  const payload = eventPayload(latest.toValue);
  const candidateRequestId = payload?.candidateRequestId;
  if (typeof candidateRequestId !== "string" || !/^[0-9a-f-]{36}$/i.test(candidateRequestId)) {
    return null;
  }

  const status: SupportDuplicateDecision = latest.eventType === "request.duplicate_confirmed"
    ? "confirmed"
    : latest.eventType === "request.duplicate_dismissed"
      ? "dismissed"
      : "pending";

  return {
    status,
    candidateRequestId,
    reason: typeof payload?.reason === "string" ? payload.reason : "same_contact_category_7_days",
    decidedAt: status === "pending" ? null : eventDate(latest.createdAt),
  };
}
