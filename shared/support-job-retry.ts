export const SUPPORT_RETRYABLE_JOB_TYPES = [
  "notify_requester_request_created",
  "notify_agent_request_created",
  "notify_agent_message_received",
  "send_requester_reply",
] as const;

export type SupportRetryableJobType = (typeof SUPPORT_RETRYABLE_JOB_TYPES)[number];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSupportRetryableJobType(value: unknown): value is SupportRetryableJobType {
  return (
    typeof value === "string" &&
    SUPPORT_RETRYABLE_JOB_TYPES.includes(value as SupportRetryableJobType)
  );
}

export function supportRetryNeedsRequesterAccess(jobType: SupportRetryableJobType): boolean {
  return ["notify_requester_request_created", "send_requester_reply"].includes(jobType);
}

export function retryPayloadId(
  payload: unknown,
  key: "messageId" | "contactId"
): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}
