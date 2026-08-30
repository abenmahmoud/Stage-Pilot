import type { CommunicationDeliveryStatus } from "./communication-delivery-event.js";
import type { CommunicationDeliveryLifecycleStatus } from "./communication-job-policy.js";

export type StoredCommunicationDeliveryStatus = CommunicationDeliveryLifecycleStatus | "spam";

export type CommunicationDeliveryTransition = {
  apply: boolean;
  currentStatus: StoredCommunicationDeliveryStatus;
  nextStatus: StoredCommunicationDeliveryStatus;
  reason: "advanced" | "same_status" | "stale_event" | "terminal_status";
  deliveredAtAction: "set_if_empty" | "preserve";
};

const STORED_STATUSES = new Set<StoredCommunicationDeliveryStatus>([
  "prepared",
  "queued",
  "sent",
  "delivered",
  "deferred",
  "rejected",
  "spam",
  "unsubscribed",
  "error",
  "cancelled",
]);
const INCOMING_STATUSES = new Set<CommunicationDeliveryStatus>([
  "delivered",
  "deferred",
  "rejected",
  "spam",
  "unsubscribed",
]);

export function planCommunicationDeliveryTransition(
  currentValue: unknown,
  incomingValue: unknown
): CommunicationDeliveryTransition {
  if (typeof currentValue !== "string" || !STORED_STATUSES.has(currentValue as StoredCommunicationDeliveryStatus)) {
    throw new Error("current_status_invalid");
  }
  if (typeof incomingValue !== "string" || !INCOMING_STATUSES.has(incomingValue as CommunicationDeliveryStatus)) {
    throw new Error("incoming_status_invalid");
  }
  const currentStatus = currentValue as StoredCommunicationDeliveryStatus;
  const incomingStatus = incomingValue as CommunicationDeliveryStatus;
  const base = {
    currentStatus,
    deliveredAtAction: incomingStatus === "delivered" ? "set_if_empty" as const : "preserve" as const,
  };

  if (currentStatus === incomingStatus) {
    return { ...base, apply: false, nextStatus: currentStatus, reason: "same_status" };
  }
  if (currentStatus === "unsubscribed" || currentStatus === "cancelled") {
    return { ...base, apply: false, nextStatus: currentStatus, reason: "terminal_status" };
  }
  if (currentStatus === "spam") {
    return incomingStatus === "unsubscribed"
      ? { ...base, apply: true, nextStatus: incomingStatus, reason: "advanced" }
      : { ...base, apply: false, nextStatus: currentStatus, reason: "terminal_status" };
  }
  if (currentStatus === "delivered" || currentStatus === "rejected") {
    return incomingStatus === "spam" || incomingStatus === "unsubscribed"
      ? { ...base, apply: true, nextStatus: incomingStatus, reason: "advanced" }
      : { ...base, apply: false, nextStatus: currentStatus, reason: "stale_event" };
  }

  return {
    ...base,
    apply: true,
    nextStatus: incomingStatus,
    reason: "advanced",
  };
}
