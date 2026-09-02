import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  identityDeviceChallenges,
  identityDeviceSessions,
} from "../../../db/schema.js";
import {
  IDENTITY_DEVICE_MAX_ATTEMPTS,
  identityDeviceFeatureEnabled,
  parseIdentityDeviceVerifyInput,
} from "../../../shared/identity-device-access.js";
import {
  identityLookupApiConfig,
  openIdentityLookupReceipt,
} from "../../../shared/identity-directory-lookup-crypto.mjs";
import { HttpError } from "../../_shared/auth.js";
import {
  challengeReceiptClaims,
  clearChallengeReceiptCookie,
  identityDeviceCodeMatches,
  identityDeviceSessionTimes,
  newIdentityDeviceSessionToken,
  readChallengeReceipt,
  setIdentityDeviceSessionCookie,
} from "../../_shared/identity-device-access.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { enforceIdentityOtpVerificationLimit } from "../../_shared/support-rate-limits.js";
import { personalHash } from "../../_shared/support.js";

type LockedChallenge = {
  id: string;
  device_key_hash: string;
  remember_device: boolean;
  status: string;
  code_hash: string | null;
  attempt_count: number;
  matched_import_id: string | null;
  matched_person_ref: string | null;
  matched_person_type: string | null;
  expires_at: Date;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    if (!identityDeviceFeatureEnabled()) {
      throw new HttpError(503, "La vérification par email n’est pas encore activée.");
    }
    let input;
    let claims;
    try {
      input = parseIdentityDeviceVerifyInput(req.body);
      const config = identityLookupApiConfig();
      const receipt = readChallengeReceipt(req);
      if (!receipt) throw new Error("missing_receipt");
      claims = challengeReceiptClaims(openIdentityLookupReceipt(receipt, config.receiptKey));
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(400, "Le code est invalide ou expiré.");
    }
    await enforceIdentityOtpVerificationLimit({
      institutionId: claims.institutionId,
      deviceId: claims.deviceId,
    });
    const now = new Date();
    const session = newIdentityDeviceSessionToken();
    const outcome = await db.transaction(async (tx) => {
      const rows = await tx.execute(sql<LockedChallenge>`
        select id, device_key_hash, remember_device, status, code_hash,
               attempt_count, matched_import_id, matched_person_ref,
               matched_person_type, expires_at
        from public.identity_device_challenges
        where id = ${claims.challengeId}
          and institution_id = ${claims.institutionId}
          and lookup_request_id = ${claims.requestId}
        for update
      `);
      const challenge = Array.from(rows as unknown as LockedChallenge[])[0];
      const expectedDeviceHash = personalHash(
        `identity-device:${claims.institutionId}:${claims.deviceId}`
      );
      if (
        !challenge ||
        challenge.device_key_hash !== expectedDeviceHash ||
        challenge.status !== "code_sent" ||
        !challenge.code_hash ||
        challenge.expires_at <= now ||
        !challenge.matched_import_id ||
        !challenge.matched_person_ref ||
        !["student", "guardian", "staff"].includes(challenge.matched_person_type ?? "")
      ) {
        return { verified: false as const, exhausted: false };
      }
      if (!identityDeviceCodeMatches(challenge.id, input.code, challenge.code_hash)) {
        const attempts = challenge.attempt_count + 1;
        await tx
          .update(identityDeviceChallenges)
          .set({
            attemptCount: attempts,
            status: attempts >= IDENTITY_DEVICE_MAX_ATTEMPTS ? "failed" : "code_sent",
          })
          .where(eq(identityDeviceChallenges.id, challenge.id));
        return {
          verified: false as const,
          exhausted: attempts >= IDENTITY_DEVICE_MAX_ATTEMPTS,
        };
      }
      const active = await tx.execute(sql`
        select 1
        from public.identity_directory_imports i
        join public.identity_directory_rows r
          on r.import_id = i.id and r.institution_id = i.institution_id
        where i.id = ${challenge.matched_import_id}
          and i.institution_id = ${claims.institutionId}
          and i.status = 'active'
          and r.person_ref = ${challenge.matched_person_ref}
          and r.person_type = ${challenge.matched_person_type}
          and r.record_type = 'person'
          and r.validation_status in ('valid', 'warning')
          and (r.valid_from is null or r.valid_from <= current_date)
          and (r.valid_until is null or r.valid_until >= current_date)
        limit 1
      `);
      if (Array.from(active as unknown as unknown[]).length !== 1) {
        await tx
          .update(identityDeviceChallenges)
          .set({ status: "failed" })
          .where(eq(identityDeviceChallenges.id, challenge.id));
        return { verified: false as const, exhausted: false };
      }
      const matchedImportId = challenge.matched_import_id;
      const matchedPersonRef = challenge.matched_person_ref;
      const matchedPersonType = challenge.matched_person_type;
      if (!matchedImportId || !matchedPersonRef || !matchedPersonType) {
        return { verified: false as const, exhausted: false };
      }
      const times = identityDeviceSessionTimes(now, challenge.remember_device);
      await tx.insert(identityDeviceSessions).values({
        institutionId: claims.institutionId,
        sourceImportId: matchedImportId,
        personRef: matchedPersonRef,
        personType: matchedPersonType,
        sessionHash: session.hash,
        persistent: challenge.remember_device,
        verifiedAt: now,
        lastUsedAt: now,
        expiresAt: times.expiresAt,
        absoluteExpiresAt: times.absoluteExpiresAt,
      });
      await tx
        .update(identityDeviceChallenges)
        .set({ status: "verified", verifiedAt: now, consumedAt: now })
        .where(eq(identityDeviceChallenges.id, challenge.id));
      return {
        verified: true as const,
        personType: matchedPersonType as "student" | "guardian" | "staff",
        persistent: challenge.remember_device,
        expiresAt: times.expiresAt,
      };
    });
    if (!outcome.verified) {
      if (outcome.exhausted) clearChallengeReceiptCookie(res);
      throw new HttpError(400, "Le code est invalide ou expiré.");
    }
    setIdentityDeviceSessionCookie(res, session.token, outcome.persistent);
    clearChallengeReceiptCookie(res);
    return {
      available: true,
      status: "verified" as const,
      personType: outcome.personType,
      expiresAt: outcome.expiresAt.toISOString(),
    };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "2kb" } } };
