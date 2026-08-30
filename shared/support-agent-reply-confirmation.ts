export type SupportAgentReplyConfirmation = {
  status: "queued" | "callback_required";
  operation: "support_agent_reply";
  publicCode: string;
  messageId: string;
  channel: "email" | "phone";
  duplicate: boolean;
  messageCreatedAt: string;
  confirmedAt: string;
  confirmationRef: string;
};

const PUBLIC_CODE_PATTERN = /^BC-[0-9]{4}-[0-9]{6}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONFIRMATION_WINDOW_MS = 5 * 60 * 1000;

function expectedStatus(channel: "email" | "phone") {
  return channel === "email" ? "queued" : "callback_required";
}

export function createSupportAgentReplyConfirmation(input: {
  publicCode: string;
  messageId: string;
  channel: "email" | "phone";
  duplicate: boolean;
  messageCreatedAt: Date;
  confirmedAt: Date;
  correlationId: string;
}): SupportAgentReplyConfirmation {
  if (
    !PUBLIC_CODE_PATTERN.test(input.publicCode)
    || !UUID_PATTERN.test(input.messageId)
    || !UUID_PATTERN.test(input.correlationId)
    || !Number.isFinite(input.messageCreatedAt.getTime())
    || !Number.isFinite(input.confirmedAt.getTime())
    || input.messageCreatedAt.getTime() > input.confirmedAt.getTime()
  ) {
    throw new Error("Support agent reply confirmation is invalid");
  }

  return {
    status: expectedStatus(input.channel),
    operation: "support_agent_reply",
    publicCode: input.publicCode,
    messageId: input.messageId,
    channel: input.channel,
    duplicate: input.duplicate,
    messageCreatedAt: input.messageCreatedAt.toISOString(),
    confirmedAt: input.confirmedAt.toISOString(),
    confirmationRef: `support:agent-reply:${input.correlationId}`,
  };
}

export function verifySupportAgentReplyConfirmation(input: {
  expectedPublicCode: string;
  confirmation: unknown;
  now?: number;
}): SupportAgentReplyConfirmation | null {
  if (
    !PUBLIC_CODE_PATTERN.test(input.expectedPublicCode)
    || !input.confirmation
    || typeof input.confirmation !== "object"
    || Array.isArray(input.confirmation)
  ) {
    return null;
  }

  const confirmation = input.confirmation as Record<string, unknown>;
  const channel = confirmation.channel === "email" || confirmation.channel === "phone"
    ? confirmation.channel
    : null;
  const messageCreatedAt = typeof confirmation.messageCreatedAt === "string"
    ? Date.parse(confirmation.messageCreatedAt)
    : Number.NaN;
  const confirmedAt = typeof confirmation.confirmedAt === "string"
    ? Date.parse(confirmation.confirmedAt)
    : Number.NaN;
  const now = input.now ?? Date.now();

  if (
    !channel
    || confirmation.status !== expectedStatus(channel)
    || confirmation.operation !== "support_agent_reply"
    || confirmation.publicCode !== input.expectedPublicCode
    || typeof confirmation.messageId !== "string"
    || !UUID_PATTERN.test(confirmation.messageId)
    || typeof confirmation.duplicate !== "boolean"
    || typeof confirmation.confirmationRef !== "string"
    || !/^support:agent-reply:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(confirmation.confirmationRef)
    || !Number.isFinite(messageCreatedAt)
    || !Number.isFinite(confirmedAt)
    || messageCreatedAt > confirmedAt
    || confirmedAt > now + CONFIRMATION_WINDOW_MS
    || (confirmation.duplicate === false && confirmedAt < now - CONFIRMATION_WINDOW_MS)
  ) {
    return null;
  }

  return confirmation as SupportAgentReplyConfirmation;
}
