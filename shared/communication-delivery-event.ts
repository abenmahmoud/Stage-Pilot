import { createHmac } from "node:crypto";
import { hashCommunicationProviderOutboundMessageId } from "./communication-brevo-inbound.js";
import {
  isCommunicationWebhookSecret,
  verifyCommunicationWebhookBearerHeader,
} from "./communication-webhook-auth.js";

export type CommunicationDeliveryStatus =
  | "delivered"
  | "deferred"
  | "rejected"
  | "spam"
  | "unsubscribed";

export type CommunicationDeliveryEvent = {
  provider: "brevo_transactional";
  providerMessageRef: string;
  eventHash: string;
  status: CommunicationDeliveryStatus;
  occurredAt: string;
};

const EVENT_STATUS: Record<string, CommunicationDeliveryStatus> = {
  delivered: "delivered",
  deferred: "deferred",
  soft_bounce: "deferred",
  softBounce: "deferred",
  hard_bounce: "rejected",
  hardBounce: "rejected",
  blocked: "rejected",
  invalid_email: "rejected",
  invalid: "rejected",
  error: "rejected",
  spam: "spam",
  unsubscribed: "unsubscribed",
};

const EVENT_HASH_DOMAIN = "lyceegest:communication:brevo:delivery-event:v1";
const MAX_EVENT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

function eventName(value: unknown): string {
  if (typeof value !== "string") throw new Error("event_invalid");
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 64 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error("event_invalid");
  }
  if (!EVENT_STATUS[normalized]) throw new Error("event_unsupported");
  return normalized;
}

function eventTimestamp(value: unknown, serverNow: Date): number {
  if (!Number.isFinite(serverNow.getTime())) throw new Error("server_time_invalid");
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error("event_time_invalid");
  const timestamp = Number(value);
  if (
    timestamp < serverNow.getTime() - MAX_EVENT_AGE_MS ||
    timestamp > serverNow.getTime() + MAX_FUTURE_SKEW_MS
  ) {
    throw new Error("event_time_out_of_range");
  }
  return timestamp;
}

function eventFingerprint(
  providerMessageRef: string,
  event: string,
  timestamp: number,
  hashingSecret: string
): string {
  return createHmac("sha256", hashingSecret)
    .update(EVENT_HASH_DOMAIN)
    .update("\0")
    .update(providerMessageRef)
    .update("\0")
    .update(event)
    .update("\0")
    .update(String(timestamp))
    .digest("hex");
}

export function verifyCommunicationDeliveryBearerHeader(
  authorization: string | string[] | undefined,
  expectedSecret: string | undefined
): boolean {
  return verifyCommunicationWebhookBearerHeader(authorization, expectedSecret);
}

export function parseCommunicationBrevoDeliveryEvent(
  value: unknown,
  hashingSecret: string,
  serverNow = new Date()
): CommunicationDeliveryEvent {
  if (!isCommunicationWebhookSecret(hashingSecret)) throw new Error("hashing_secret_invalid");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("input_invalid");
  const input = value as Record<string, unknown>;
  const event = eventName(input.event);
  const timestamp = eventTimestamp(input.ts_epoch, serverNow);
  const providerMessageRef = hashCommunicationProviderOutboundMessageId(
    input["message-id"],
    hashingSecret
  );

  return {
    provider: "brevo_transactional",
    providerMessageRef,
    eventHash: eventFingerprint(providerMessageRef, event, timestamp, hashingSecret),
    status: EVENT_STATUS[event],
    occurredAt: new Date(timestamp).toISOString(),
  };
}
