import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, gt, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  identityDeviceSessions,
  identityDirectoryImports,
  identityDirectoryRows,
} from "../../db/schema.js";
import {
  IDENTITY_DEVICE_ABSOLUTE_SESSION_SECONDS,
  IDENTITY_DEVICE_PERSISTENT_IDLE_SECONDS,
  IDENTITY_DEVICE_SHARED_SESSION_SECONDS,
} from "../../shared/identity-device-access.js";
import { HttpError } from "./auth.js";
import { requireConfiguredInstitution } from "./institution-context.js";
import { opaqueToken, personalHash } from "./support.js";

export const IDENTITY_DEVICE_CHALLENGE_COOKIE = "lyceegest_identity_challenge";
export const IDENTITY_DEVICE_SESSION_COOKIE = "lyceegest_identity_session";

type ChallengeReceipt = {
  schema: 1;
  challengeId: string;
  requestId: string;
  institutionId: string;
  responseKey: string;
  email: string;
  deviceId: string;
  expiresAt: string;
};

function cookieMap(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").flatMap((part) => {
      const separator = part.indexOf("=");
      if (separator < 1) return [];
      const key = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      try {
        return [[key, decodeURIComponent(value)]];
      } catch {
        return [];
      }
    })
  );
}

function appendCookie(res: VercelResponse, value: string): void {
  const current = res.getHeader("Set-Cookie");
  const cookies = Array.isArray(current) ? current.map(String) : current ? [String(current)] : [];
  res.setHeader("Set-Cookie", [...cookies, value]);
}

function secureCookieSuffix(): string {
  return process.env.NODE_ENV === "production" ? "; Secure" : "";
}

function challengeSecret(): string {
  const value = process.env.IDENTITY_DEVICE_OTP_SECRET;
  if (!value || value.length < 32) {
    throw new HttpError(503, "La vérification par email n’est pas disponible.");
  }
  return value;
}

export function identityDeviceCode(challengeId: string): string {
  const digest = createHmac("sha256", challengeSecret())
    .update(`lyceegest:identity-device-code:${challengeId}`)
    .digest();
  return (digest.readUInt32BE(0) % 1_000_000).toString().padStart(6, "0");
}

export function identityDeviceCodeHash(challengeId: string, code: string): string {
  return createHmac("sha256", challengeSecret())
    .update(`lyceegest:identity-device-code-hash:${challengeId}:${code}`)
    .digest("hex");
}

export function identityDeviceCodeMatches(
  challengeId: string,
  candidate: string,
  expectedHash: string
): boolean {
  const actual = Buffer.from(identityDeviceCodeHash(challengeId, candidate), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function challengeReceiptClaims(value: unknown): ChallengeReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(401, "Vérification expirée ou invalide.");
  }
  const input = value as Record<string, unknown>;
  const exact = [
    "schema",
    "challengeId",
    "requestId",
    "institutionId",
    "responseKey",
    "email",
    "deviceId",
    "expiresAt",
  ];
  if (Object.keys(input).length !== exact.length || Object.keys(input).some((key) => !exact.includes(key))) {
    throw new HttpError(401, "Vérification expirée ou invalide.");
  }
  if (
    input.schema !== 1 ||
    ![input.challengeId, input.requestId, input.institutionId].every(
      (entry) => typeof entry === "string" && /^[0-9a-f-]{36}$/i.test(entry)
    ) ||
    typeof input.responseKey !== "string" ||
    Buffer.from(input.responseKey, "base64").length !== 32 ||
    typeof input.email !== "string" ||
    typeof input.deviceId !== "string" ||
    typeof input.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(input.expiresAt))
  ) {
    throw new HttpError(401, "Vérification expirée ou invalide.");
  }
  return input as ChallengeReceipt;
}

export function readChallengeReceipt(req: VercelRequest): string | null {
  return cookieMap(req.headers.cookie)[IDENTITY_DEVICE_CHALLENGE_COOKIE] ?? null;
}

export function setChallengeReceiptCookie(
  res: VercelResponse,
  receipt: string,
  maxAgeSeconds: number
): void {
  appendCookie(
    res,
    `${IDENTITY_DEVICE_CHALLENGE_COOKIE}=${encodeURIComponent(receipt)}; Path=/api/identity/device; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secureCookieSuffix()}`
  );
}

export function clearChallengeReceiptCookie(res: VercelResponse): void {
  appendCookie(
    res,
    `${IDENTITY_DEVICE_CHALLENGE_COOKIE}=; Path=/api/identity/device; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureCookieSuffix()}`
  );
}

export function readIdentityDeviceSessionToken(req: VercelRequest): string | null {
  return cookieMap(req.headers.cookie)[IDENTITY_DEVICE_SESSION_COOKIE] ?? null;
}

export function setIdentityDeviceSessionCookie(
  res: VercelResponse,
  token: string,
  persistent: boolean
): void {
  const maxAge = persistent ? `; Max-Age=${IDENTITY_DEVICE_PERSISTENT_IDLE_SECONDS}` : "";
  appendCookie(
    res,
    `${IDENTITY_DEVICE_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${maxAge}${secureCookieSuffix()}`
  );
}

export function clearIdentityDeviceSessionCookie(res: VercelResponse): void {
  appendCookie(
    res,
    `${IDENTITY_DEVICE_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureCookieSuffix()}`
  );
}

export function identityDeviceSessionTimes(now: Date, persistent: boolean) {
  const absoluteExpiresAt = new Date(
    now.getTime() +
      (persistent
        ? IDENTITY_DEVICE_ABSOLUTE_SESSION_SECONDS
        : IDENTITY_DEVICE_SHARED_SESSION_SECONDS) *
        1000
  );
  const expiresAt = new Date(
    Math.min(
      absoluteExpiresAt.getTime(),
      now.getTime() +
        (persistent
          ? IDENTITY_DEVICE_PERSISTENT_IDLE_SECONDS
          : IDENTITY_DEVICE_SHARED_SESSION_SECONDS) *
          1000
    )
  );
  return { expiresAt, absoluteExpiresAt };
}

export function newIdentityDeviceSessionToken(): { token: string; hash: string } {
  const token = opaqueToken();
  return { token, hash: personalHash(`identity-device-session:${token}`) };
}

export type IdentityDeviceSessionContext = {
  id: string;
  institutionId: string;
  sourceImportId: string;
  personRef: string;
  personType: "student" | "guardian" | "staff";
  persistent: boolean;
  assuranceLevel: "directory_email_otp";
  expiresAt: Date;
  absoluteExpiresAt: Date;
};

export async function readIdentityDeviceSession(
  req: VercelRequest,
  res?: VercelResponse
): Promise<IdentityDeviceSessionContext | null> {
  const token = readIdentityDeviceSessionToken(req);
  if (!token) return null;
  const institution = await requireConfiguredInstitution();
  const now = new Date();
  const sessionHash = personalHash(`identity-device-session:${token}`);
  const [row] = await db
    .select({
      id: identityDeviceSessions.id,
      institutionId: identityDeviceSessions.institutionId,
      sourceImportId: identityDeviceSessions.sourceImportId,
      personRef: identityDeviceSessions.personRef,
      personType: identityDeviceSessions.personType,
      persistent: identityDeviceSessions.persistent,
      assuranceLevel: identityDeviceSessions.assuranceLevel,
      expiresAt: identityDeviceSessions.expiresAt,
      absoluteExpiresAt: identityDeviceSessions.absoluteExpiresAt,
    })
    .from(identityDeviceSessions)
    .innerJoin(
      identityDirectoryImports,
      and(
        eq(identityDirectoryImports.id, identityDeviceSessions.sourceImportId),
        eq(identityDirectoryImports.institutionId, identityDeviceSessions.institutionId),
        eq(identityDirectoryImports.status, "active")
      )
    )
    .innerJoin(
      identityDirectoryRows,
      and(
        eq(identityDirectoryRows.importId, identityDeviceSessions.sourceImportId),
        eq(identityDirectoryRows.institutionId, identityDeviceSessions.institutionId),
        eq(identityDirectoryRows.personRef, identityDeviceSessions.personRef),
        eq(identityDirectoryRows.recordType, "person"),
        inArray(identityDirectoryRows.validationStatus, ["valid", "warning"]),
        or(isNull(identityDirectoryRows.validFrom), lte(identityDirectoryRows.validFrom, now.toISOString().slice(0, 10))),
        or(isNull(identityDirectoryRows.validUntil), gte(identityDirectoryRows.validUntil, now.toISOString().slice(0, 10)))
      )
    )
    .where(
      and(
        eq(identityDeviceSessions.institutionId, institution.id),
        eq(identityDeviceSessions.sessionHash, sessionHash),
        isNull(identityDeviceSessions.revokedAt),
        gt(identityDeviceSessions.expiresAt, now),
        gt(identityDeviceSessions.absoluteExpiresAt, now)
      )
    )
    .limit(1);
  if (!row || !["student", "guardian", "staff"].includes(row.personType)) {
    if (res) clearIdentityDeviceSessionCookie(res);
    return null;
  }

  let expiresAt = row.expiresAt;
  if (row.persistent) {
    expiresAt = new Date(
      Math.min(
        row.absoluteExpiresAt.getTime(),
        now.getTime() + IDENTITY_DEVICE_PERSISTENT_IDLE_SECONDS * 1000
      )
    );
    await db
      .update(identityDeviceSessions)
      .set({ lastUsedAt: now, expiresAt })
      .where(
        and(
          eq(identityDeviceSessions.id, row.id),
          isNull(identityDeviceSessions.revokedAt),
          gt(identityDeviceSessions.expiresAt, now)
        )
      );
    if (res) setIdentityDeviceSessionCookie(res, token, true);
  }
  return {
    ...row,
    personType: row.personType as IdentityDeviceSessionContext["personType"],
    assuranceLevel: "directory_email_otp",
    expiresAt,
  };
}

export function randomResponseKey(): Buffer {
  return randomBytes(32);
}
