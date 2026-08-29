import type { VercelRequest } from "@vercel/node";
import {
  SUPPORT_RATE_LIMIT_POLICIES,
  normalizedSupportBehaviorText,
  normalizedSupportDeviceId,
  type SupportRateLimitPolicy,
} from "../../shared/support-rate-limit-policy.js";
import {
  enforceSupportRateLimit,
  personalHash,
  readSupportSessionToken,
  requestIpHash,
  sha256,
  type SupportRequestInput,
} from "./support.js";

function firstHeaderValue(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || null;
}

async function enforce(policy: SupportRateLimitPolicy, keyHash: string): Promise<void> {
  await enforceSupportRateLimit({ ...policy, keyHash });
}

export function supportDeviceRateKey(
  req: VercelRequest,
  explicitDeviceId?: unknown
): string | null {
  const declared =
    normalizedSupportDeviceId(explicitDeviceId) ??
    normalizedSupportDeviceId(firstHeaderValue(req.headers["x-support-device"]));
  if (declared) return personalHash(`support-device:${declared}`);

  const sessionToken = readSupportSessionToken(req);
  return sessionToken ? personalHash(`support-session:${sessionToken}`) : null;
}

export async function enforceAssistantRateLimits(
  req: VercelRequest,
  explicitDeviceId: string
): Promise<string> {
  const networkKey = requestIpHash(req);
  if (networkKey) await enforce(SUPPORT_RATE_LIMIT_POLICIES.assistantNetworkGuard, networkKey);

  const deviceKey = supportDeviceRateKey(req, explicitDeviceId);
  if (!deviceKey) throw new Error("validated_support_device_missing");
  await enforce(SUPPORT_RATE_LIMIT_POLICIES.assistantDeviceDaily, deviceKey);
  return deviceKey;
}

export async function enforceSupportRequestNetworkGuard(req: VercelRequest): Promise<void> {
  const networkKey = requestIpHash(req);
  if (networkKey) await enforce(SUPPORT_RATE_LIMIT_POLICIES.requestNetworkGuard, networkKey);
}

export async function enforceMagicTokenNetworkGuard(req: VercelRequest): Promise<void> {
  const networkKey = requestIpHash(req);
  if (networkKey) await enforce(SUPPORT_RATE_LIMIT_POLICIES.magicTokenNetworkGuard, networkKey);
}

export async function recordInvalidSupportRequest(deviceKey: string | null): Promise<void> {
  if (deviceKey) await enforce(SUPPORT_RATE_LIMIT_POLICIES.requestInvalidDevice, deviceKey);
}

function contactRateKeys(input: SupportRequestInput): string[] {
  return [...new Set(
    [input.email, input.phone]
      .filter((value): value is string => Boolean(value))
      .map((value) => personalHash(`support-contact:${value}`))
  )];
}

function repeatedRequestKey(
  input: SupportRequestInput,
  deviceKey: string | null,
  contacts: string[]
): string {
  const fingerprint = sha256(
    JSON.stringify([
      input.category,
      normalizedSupportBehaviorText(input.subject),
      normalizedSupportBehaviorText(input.description),
    ])
  );
  return personalHash(`support-repeat:${deviceKey ?? contacts[0]}:${fingerprint}`);
}

export async function enforceSupportRequestCreationLimits(input: {
  parsed: SupportRequestInput;
  deviceKey: string | null;
}): Promise<void> {
  const contacts = contactRateKeys(input.parsed);
  if (input.deviceKey) {
    await enforce(SUPPORT_RATE_LIMIT_POLICIES.requestDeviceBurst, input.deviceKey);
    await enforce(SUPPORT_RATE_LIMIT_POLICIES.requestDeviceDaily, input.deviceKey);
  }
  for (const contactKey of contacts) {
    await enforce(SUPPORT_RATE_LIMIT_POLICIES.requestContactBurst, contactKey);
    await enforce(SUPPORT_RATE_LIMIT_POLICIES.requestContactDaily, contactKey);
  }
  await enforce(
    SUPPORT_RATE_LIMIT_POLICIES.requestRepeatedBehavior,
    repeatedRequestKey(input.parsed, input.deviceKey, contacts)
  );
}

export async function enforceAttachmentReservationRateLimit(sessionId: string): Promise<void> {
  await enforce(
    SUPPORT_RATE_LIMIT_POLICIES.attachmentReservationSession,
    personalHash(`attachment-reserve:${sessionId}`)
  );
}

export async function enforceAttachmentConfirmationRateLimit(sessionId: string): Promise<void> {
  await enforce(
    SUPPORT_RATE_LIMIT_POLICIES.attachmentConfirmationSession,
    personalHash(`attachment-confirm:${sessionId}`)
  );
}

export async function enforceAgentWriteRateLimit(userId: string): Promise<void> {
  await enforce(
    SUPPORT_RATE_LIMIT_POLICIES.agentWriteAccount,
    personalHash(`agent-write:${userId}`)
  );
}
