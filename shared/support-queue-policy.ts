export type SupportQueueItem = {
  status: string;
  priority: string;
  assignedTo: string | null;
  slaDueAt: string | null;
  createdAt: string;
};

export type SupportQueueAssessment = {
  needsQualification: boolean;
  unassigned: boolean;
  overdue: boolean;
  closed: boolean;
};

const CLOSED_STATUSES = new Set(["resolu", "clos", "indesirable"]);

function timestamp(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function priorityRank(priority: string): number {
  return ({ p1: 1, p2: 2, p3: 3, p4: 4 } as Record<string, number>)[priority] ?? 5;
}

export function assessSupportQueueItem(
  item: SupportQueueItem,
  now: string
): SupportQueueAssessment {
  const closed = CLOSED_STATUSES.has(item.status);
  return {
    needsQualification: item.status === "a_qualifier",
    unassigned: !closed && item.assignedTo === null,
    overdue: !closed && item.slaDueAt !== null && timestamp(item.slaDueAt) < timestamp(now),
    closed,
  };
}

export function compareSupportQueueItems(
  left: SupportQueueItem,
  right: SupportQueueItem
): number {
  const priorityDifference = priorityRank(left.priority) - priorityRank(right.priority);
  if (priorityDifference !== 0) return priorityDifference;

  const slaDifference = timestamp(left.slaDueAt) - timestamp(right.slaDueAt);
  if (slaDifference !== 0) return slaDifference;

  return timestamp(left.createdAt) - timestamp(right.createdAt);
}
