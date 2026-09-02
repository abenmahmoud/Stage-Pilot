import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../db/index.js";
import { supportContacts, supportDeviceSessions, supportRequests, supportSessionRequests } from "../../db/schema.js";
import { getUserFromRequest, HttpError } from "./auth.js";
import { requireConfiguredInstitution } from "./institution-context.js";
import { resolveAssistantQuotaCookie } from "./assistant-quota-identity.js";
import { supportSessionContactPredicate } from "./support-session-contact.js";
import {
  SUPPORT_RATE_LIMIT_POLICIES,
  normalizedSupportBehaviorText,
  normalizedSupportDeviceId,
  type SupportRateLimitPolicy,
} from "../../shared/support-rate-limit-policy.js";
import {
  enforceSupportRateLimit,
  enforceSupportRateLimits,
  personalHash,
  readSupportSessionToken,
  requestIpHash,
  sha256,
  type SupportRateLimitAttempt,
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
  explicitDeviceId: string,
  res: VercelResponse
): Promise<string> {
  const networkKey = requestIpHash(req);
  if (networkKey) await enforce(SUPPORT_RATE_LIMIT_POLICIES.assistantNetworkGuard, networkKey);

  const institution = await requireConfiguredInstitution();
  await enforce(
    SUPPORT_RATE_LIMIT_POLICIES.assistantGlobalGuard,
    personalHash(`assistant-global:${institution.id}`)
  );
  let anonymous;
  try {
    anonymous = resolveAssistantQuotaCookie({
      cookieHeader: req.headers.cookie,
      secret: process.env.SUPPORT_HASH_SECRET,
      institutionId: institution.id,
      production: process.env.NODE_ENV === "production",
    });
  } catch {
    throw new HttpError(503, "L'assistant est momentanément indisponible. Le formulaire reste disponible.");
  }
  if (anonymous.setCookie) {
    const existing = res.getHeader("Set-Cookie");
    const cookies = existing === undefined ? [] : Array.isArray(existing) ? existing : [String(existing)];
    res.setHeader("Set-Cookie", [...cookies, anonymous.setCookie]);
  }

  // The declared signal still binds tool receipts, but cannot renew the server quota.
  const deviceKey = supportDeviceRateKey(req, explicitDeviceId);
  if (!deviceKey) throw new Error("validated_support_device_missing");
  const keys = [deviceKey, personalHash(`assistant-anonymous:${institution.id}:${anonymous.anonymousId}`)];
  if (req.headers.authorization) {
    let user;
    try {
      user = await getUserFromRequest(req);
    } catch {
      throw new HttpError(503, "La vérification de la session est momentanément indisponible.");
    }
    if (!user) throw new HttpError(401, "Reconnectez-vous ou utilisez le formulaire public.");
    keys.push(personalHash(`assistant-account:${institution.id}:${user.id}`));
  }
  let token: string | null;
  try {
    token = readSupportSessionToken(req);
  } catch {
    throw new HttpError(400, "Les informations de suivi sont invalides. Le formulaire reste disponible.");
  }
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    try {
      const [session] = await db.select({ id: supportDeviceSessions.id })
        .from(supportDeviceSessions)
        .innerJoin(supportSessionRequests, eq(supportSessionRequests.sessionId, supportDeviceSessions.id))
        .innerJoin(supportRequests, eq(supportRequests.id, supportSessionRequests.requestId))
        .leftJoin(supportContacts, eq(supportContacts.id, supportDeviceSessions.accessContactId))
        .where(and(
          eq(supportDeviceSessions.sessionHash, sha256(token)),
          gt(supportDeviceSessions.expiresAt, new Date()),
          isNull(supportDeviceSessions.revokedAt),
          eq(supportRequests.institutionId, institution.id),
          supportSessionContactPredicate()
        )).limit(1);
      if (session) keys.push(personalHash(`assistant-tracking:${institution.id}:${session.id}`));
    } catch {
      throw new HttpError(503, "La vérification du suivi est momentanément indisponible.");
    }
  }
  await enforceSupportRateLimits(keys.map((keyHash) => ({
    ...SUPPORT_RATE_LIMIT_POLICIES.assistantDeviceDaily, keyHash,
  })));
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

export async function enforceSupportAccessRecoveryLimits(input: {
  institutionId: string; publicCode: string; email: string;
}): Promise<void> {
  await enforceSupportRateLimits([
    { ...SUPPORT_RATE_LIMIT_POLICIES.accessRecoveryPair,
      keyHash: personalHash(`support-recovery-pair:${input.institutionId}:${input.publicCode}:${input.email}`) },
    { ...SUPPORT_RATE_LIMIT_POLICIES.accessRecoveryEmail,
      keyHash: personalHash(`support-recovery-email:${input.institutionId}:${input.email}`) },
    { ...SUPPORT_RATE_LIMIT_POLICIES.accessRecoveryGlobal,
      keyHash: personalHash(`support-recovery-global:${input.institutionId}`) },
  ]);
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
  const attempts: SupportRateLimitAttempt[] = [];
  if (input.deviceKey) {
    attempts.push(
      { ...SUPPORT_RATE_LIMIT_POLICIES.requestDeviceBurst, keyHash: input.deviceKey },
      { ...SUPPORT_RATE_LIMIT_POLICIES.requestDeviceDaily, keyHash: input.deviceKey }
    );
  }
  for (const contactKey of contacts) {
    attempts.push(
      { ...SUPPORT_RATE_LIMIT_POLICIES.requestContactBurst, keyHash: contactKey },
      { ...SUPPORT_RATE_LIMIT_POLICIES.requestContactDaily, keyHash: contactKey }
    );
  }
  attempts.push({
    ...SUPPORT_RATE_LIMIT_POLICIES.requestRepeatedBehavior,
    keyHash: repeatedRequestKey(input.parsed, input.deviceKey, contacts),
  });
  await enforceSupportRateLimits(attempts);
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

export async function enforceAttachmentDownloadRateLimit(sessionId: string): Promise<void> {
  await enforce(
    SUPPORT_RATE_LIMIT_POLICIES.attachmentDownloadSession,
    personalHash(`attachment-download:${sessionId}`)
  );
}

export async function enforceAgentAttachmentDownloadRateLimit(userId: string): Promise<void> {
  await enforce(
    SUPPORT_RATE_LIMIT_POLICIES.agentAttachmentDownloadAccount,
    personalHash(`agent-attachment-download:${userId}`)
  );
}

export async function enforceAgentWriteRateLimit(userId: string): Promise<void> {
  await enforce(
    SUPPORT_RATE_LIMIT_POLICIES.agentWriteAccount,
    personalHash(`agent-write:${userId}`)
  );
}

export async function enforceIdentityOtpRequestLimits(input: {
  req: VercelRequest;
  institutionId: string;
  deviceId: string;
  email: string;
}): Promise<void> {
  const deviceKey = personalHash(
    `identity-otp-device:${input.institutionId}:${input.deviceId}`
  );
  const contactKey = personalHash(
    `identity-otp-contact:${input.institutionId}:${input.email}`
  );
  const attempts: SupportRateLimitAttempt[] = [
    { ...SUPPORT_RATE_LIMIT_POLICIES.identityOtpDeviceBurst, keyHash: deviceKey },
    { ...SUPPORT_RATE_LIMIT_POLICIES.identityOtpDeviceDaily, keyHash: deviceKey },
    { ...SUPPORT_RATE_LIMIT_POLICIES.identityOtpContactBurst, keyHash: contactKey },
    { ...SUPPORT_RATE_LIMIT_POLICIES.identityOtpContactDaily, keyHash: contactKey },
  ];
  const networkKey = requestIpHash(input.req);
  if (networkKey) {
    attempts.push({
      ...SUPPORT_RATE_LIMIT_POLICIES.identityOtpNetwork,
      keyHash: personalHash(`identity-otp-network:${input.institutionId}:${networkKey}`),
    });
  }
  await enforceSupportRateLimits(attempts);
}

export async function enforceIdentityOtpVerificationLimit(input: {
  institutionId: string;
  deviceId: string;
}): Promise<void> {
  await enforce(
    SUPPORT_RATE_LIMIT_POLICIES.identityOtpVerifyDevice,
    personalHash(`identity-otp-verify:${input.institutionId}:${input.deviceId}`)
  );
}
