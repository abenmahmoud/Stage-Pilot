import {
  SUPPORT_CALLBACK_STATUSES,
  type SupportCallbackStatus,
} from "./support-callback-policy.ts";

export const SUPPORT_CALLBACK_CONFIRMATION_OPERATIONS = [
  "support_callback_create",
  "support_callback_claim",
  "support_callback_complete",
  "support_callback_cancel",
] as const;

export type SupportCallbackConfirmationOperation =
  (typeof SUPPORT_CALLBACK_CONFIRMATION_OPERATIONS)[number];

export type SupportCallbackConfirmation = {
  status: "persisted";
  operation: SupportCallbackConfirmationOperation;
  publicCode: string;
  callbackId: string;
  previousStatus: SupportCallbackStatus | null;
  callbackStatus: SupportCallbackStatus;
  duplicate: boolean;
  confirmedAt: string;
  confirmationRef: string;
};

const PUBLIC_CODE_PATTERN = /^BC-[0-9]{4}-[0-9]{6}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONFIRMATION_WINDOW_MS = 5 * 60 * 1000;

function isCallbackStatus(value: unknown): value is SupportCallbackStatus {
  return typeof value === "string"
    && SUPPORT_CALLBACK_STATUSES.includes(value as SupportCallbackStatus);
}

function transitionMatches(
  operation: SupportCallbackConfirmationOperation,
  previousStatus: SupportCallbackStatus | null,
  callbackStatus: SupportCallbackStatus
): boolean {
  if (operation === "support_callback_create") return previousStatus === null;
  if (operation === "support_callback_claim") {
    return previousStatus === "todo" && callbackStatus === "in_progress";
  }
  if (operation === "support_callback_complete") {
    return previousStatus === "in_progress" && callbackStatus === "done";
  }
  return (previousStatus === "todo" || previousStatus === "in_progress")
    && callbackStatus === "cancelled";
}

export function createSupportCallbackConfirmation(input: {
  operation: SupportCallbackConfirmationOperation;
  publicCode: string;
  callbackId: string;
  previousStatus: SupportCallbackStatus | null;
  callbackStatus: SupportCallbackStatus;
  duplicate: boolean;
  confirmedAt: Date;
  correlationId: string;
}): SupportCallbackConfirmation {
  if (
    !SUPPORT_CALLBACK_CONFIRMATION_OPERATIONS.includes(input.operation)
    || !PUBLIC_CODE_PATTERN.test(input.publicCode)
    || !UUID_PATTERN.test(input.callbackId)
    || !UUID_PATTERN.test(input.correlationId)
    || !Number.isFinite(input.confirmedAt.getTime())
    || !transitionMatches(input.operation, input.previousStatus, input.callbackStatus)
  ) {
    throw new Error("Support callback confirmation is invalid");
  }

  return {
    status: "persisted",
    operation: input.operation,
    publicCode: input.publicCode,
    callbackId: input.callbackId,
    previousStatus: input.previousStatus,
    callbackStatus: input.callbackStatus,
    duplicate: input.duplicate,
    confirmedAt: input.confirmedAt.toISOString(),
    confirmationRef: `support:callback:${input.correlationId}`,
  };
}

export function verifySupportCallbackConfirmation(input: {
  expectedOperation: SupportCallbackConfirmationOperation;
  expectedPublicCode: string;
  expectedCallbackId?: string;
  confirmation: unknown;
  now?: number;
}): SupportCallbackConfirmation | null {
  if (
    !SUPPORT_CALLBACK_CONFIRMATION_OPERATIONS.includes(input.expectedOperation)
    || !PUBLIC_CODE_PATTERN.test(input.expectedPublicCode)
    || (input.expectedCallbackId !== undefined && !UUID_PATTERN.test(input.expectedCallbackId))
    || !input.confirmation
    || typeof input.confirmation !== "object"
    || Array.isArray(input.confirmation)
  ) {
    return null;
  }

  const confirmation = input.confirmation as Record<string, unknown>;
  const operation = confirmation.operation as SupportCallbackConfirmationOperation;
  const previousStatus = confirmation.previousStatus === null || isCallbackStatus(confirmation.previousStatus)
    ? confirmation.previousStatus as SupportCallbackStatus | null
    : undefined;
  const callbackStatus = isCallbackStatus(confirmation.callbackStatus)
    ? confirmation.callbackStatus
    : null;
  const confirmedAt = typeof confirmation.confirmedAt === "string"
    ? Date.parse(confirmation.confirmedAt)
    : Number.NaN;
  const now = input.now ?? Date.now();

  if (
    confirmation.status !== "persisted"
    || operation !== input.expectedOperation
    || confirmation.publicCode !== input.expectedPublicCode
    || typeof confirmation.callbackId !== "string"
    || !UUID_PATTERN.test(confirmation.callbackId)
    || (input.expectedCallbackId !== undefined && confirmation.callbackId !== input.expectedCallbackId)
    || previousStatus === undefined
    || !callbackStatus
    || !transitionMatches(operation, previousStatus, callbackStatus)
    || typeof confirmation.duplicate !== "boolean"
    || typeof confirmation.confirmationRef !== "string"
    || !/^support:callback:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(confirmation.confirmationRef)
    || !Number.isFinite(confirmedAt)
    || confirmedAt > now + CONFIRMATION_WINDOW_MS
    || (confirmation.duplicate === false && confirmedAt < now - CONFIRMATION_WINDOW_MS)
  ) {
    return null;
  }

  return confirmation as SupportCallbackConfirmation;
}
