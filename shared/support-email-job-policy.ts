import {
  isSupportRetryableJobType,
  type SupportRetryableJobType,
} from "./support-job-retry.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;
const MAX_QUEUE_PAYLOAD_LENGTH = 4_096;

export type SupportEmailQueueJob = {
  job_id: string;
  job_type: SupportRetryableJobType;
  institution_id: string;
  request_id: string;
  message_id?: string;
  contact_id?: string;
  access_token?: string;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid_queue_payload");
  }
  return value as Record<string, unknown>;
}

function uuid(value: unknown): string | undefined {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : undefined;
}

export function parseSupportEmailQueueJob(
  raw: unknown,
  expectedInstitutionId: string
): SupportEmailQueueJob {
  if (!UUID_PATTERN.test(expectedInstitutionId)) throw new Error("institution_invalid");
  let value = raw;
  if (typeof raw === "string") {
    if (raw.length === 0 || raw.length > MAX_QUEUE_PAYLOAD_LENGTH) {
      throw new Error("invalid_queue_payload");
    }
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      throw new Error("invalid_queue_payload");
    }
  }
  const input = record(value);
  const jobId = uuid(input.job_id);
  const institutionId = uuid(input.institution_id);
  const requestId = uuid(input.request_id);
  if (!jobId || !requestId) throw new Error("invalid_queue_payload");
  if (!institutionId || institutionId !== expectedInstitutionId) {
    throw new Error("institution_mismatch");
  }
  if (!isSupportRetryableJobType(input.job_type)) throw new Error("unsupported_job_type");

  const messageId = input.message_id == null ? undefined : uuid(input.message_id);
  const contactId = input.contact_id == null ? undefined : uuid(input.contact_id);
  const accessToken = input.access_token == null ? undefined : input.access_token;
  if (input.message_id != null && !messageId) throw new Error("invalid_queue_payload");
  if (input.contact_id != null && !contactId) throw new Error("invalid_queue_payload");
  if (accessToken != null && (typeof accessToken !== "string" || !TOKEN_PATTERN.test(accessToken))) {
    throw new Error("invalid_queue_payload");
  }

  const requesterJob = ["notify_requester_request_created", "send_requester_reply"].includes(input.job_type);
  if (!messageId || (requesterJob && (!contactId || !accessToken))) {
    throw new Error("invalid_queue_payload");
  }

  return {
    job_id: jobId,
    job_type: input.job_type,
    institution_id: institutionId,
    request_id: requestId,
    message_id: messageId,
    ...(contactId ? { contact_id: contactId } : {}),
    ...(typeof accessToken === "string" ? { access_token: accessToken } : {}),
  };
}

export function supportEmailFailureDisposition(readCount: number): "retry" | "dead_letter" {
  if (!Number.isInteger(readCount) || readCount < 1 || readCount > 10_000) {
    throw new Error("invalid_queue_attempt");
  }
  return readCount >= 5 ? "dead_letter" : "retry";
}
