export type SupportJobRetryConfirmation = {
  status: "queued";
  operation: "support_job_retry";
  failedJobId: string;
  jobId: string;
  confirmedAt: string;
  confirmationRef: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONFIRMATION_WINDOW_MS = 5 * 60 * 1000;

function confirmationReference(correlationId: string): string {
  return `support:job-retry:${correlationId}`;
}

export function createSupportJobRetryConfirmation(input: {
  failedJobId: string;
  jobId: string;
  confirmedAt: Date;
  correlationId: string;
}): SupportJobRetryConfirmation {
  if (
    !UUID_PATTERN.test(input.failedJobId)
    || !UUID_PATTERN.test(input.jobId)
    || !UUID_PATTERN.test(input.correlationId)
    || !Number.isFinite(input.confirmedAt.getTime())
  ) {
    throw new Error("Support job retry confirmation is invalid");
  }

  return {
    status: "queued",
    operation: "support_job_retry",
    failedJobId: input.failedJobId,
    jobId: input.jobId,
    confirmedAt: input.confirmedAt.toISOString(),
    confirmationRef: confirmationReference(input.correlationId),
  };
}

export function verifySupportJobRetryConfirmation(input: {
  expectedFailedJobId: string;
  confirmation: unknown;
  now?: number;
}): SupportJobRetryConfirmation | null {
  if (
    !UUID_PATTERN.test(input.expectedFailedJobId)
    || !input.confirmation
    || typeof input.confirmation !== "object"
    || Array.isArray(input.confirmation)
  ) {
    return null;
  }

  const confirmation = input.confirmation as Record<string, unknown>;
  const confirmedAt = typeof confirmation.confirmedAt === "string"
    ? Date.parse(confirmation.confirmedAt)
    : Number.NaN;
  const now = input.now ?? Date.now();

  if (
    confirmation.status !== "queued"
    || confirmation.operation !== "support_job_retry"
    || confirmation.failedJobId !== input.expectedFailedJobId
    || typeof confirmation.jobId !== "string"
    || !UUID_PATTERN.test(confirmation.jobId)
    || typeof confirmation.confirmationRef !== "string"
    || !/^support:job-retry:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(confirmation.confirmationRef)
    || !Number.isFinite(confirmedAt)
    || confirmedAt < now - CONFIRMATION_WINDOW_MS
    || confirmedAt > now + CONFIRMATION_WINDOW_MS
  ) {
    return null;
  }

  return confirmation as SupportJobRetryConfirmation;
}
