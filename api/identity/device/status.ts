import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  identityDeviceChallenges,
  identityDirectoryLookupRequests,
} from "../../../db/schema.js";
import {
  decryptIdentityLookupResult,
  identityLookupApiConfig,
  openIdentityLookupReceipt,
} from "../../../shared/identity-directory-lookup-crypto.mjs";
import {
  identityDeviceClaimsMatch,
  identityDeviceCodeSentPayload,
  identityDeviceContactUpdatePayload,
  identityDeviceFeatureEnabled,
  identityDeviceReadyPayload,
} from "../../../shared/identity-device-access.js";
import { HttpError } from "../../_shared/auth.js";
import { sendTransactionalEmail, sendTransactionalSms } from "../../_shared/brevo.js";
import { buildIdentityVerificationEmail } from "../../../shared/school-email-templates.mjs";
import {
  challengeReceiptClaims,
  clearChallengeReceiptCookie,
  identityDeviceCode,
  identityDeviceCodeHash,
  readChallengeReceipt,
} from "../../_shared/identity-device-access.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

type DeviceLookupResult = {
  firstName: string;
  lastName: string;
  personType: "student" | "guardian" | "staff";
  personRef: string;
  matchedBy: "email" | "phone";
  directoryVersionId: string;
};

function parseDeviceLookupResult(value: unknown): DeviceLookupResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(503, "La vérification n’a pas pu être contrôlée.");
  }
  const input = value as Record<string, unknown>;
  if (
    typeof input.firstName !== "string" ||
    typeof input.lastName !== "string" ||
    !["student", "guardian", "staff"].includes(String(input.personType)) ||
    typeof input.personRef !== "string" ||
    !["email", "phone"].includes(String(input.matchedBy)) ||
    typeof input.directoryVersionId !== "string"
  ) {
    throw new HttpError(503, "La vérification n’a pas pu être contrôlée.");
  }
  return input as unknown as DeviceLookupResult;
}

async function deliverCode(input: {
  challengeId: string;
  contactType: "email" | "phone";
  contact: string;
  firstName: string;
}): Promise<void> {
  const code = identityDeviceCode(input.challengeId);
  if (input.contactType === "phone") {
    await sendTransactionalSms({
      recipient: input.contact,
      content: `Lycée Blaise Cendrars : ${code}. Valable 10 min. Ne le partagez pas.`,
      tag: "lyceegest-identity",
    });
    return;
  }
  await sendTransactionalEmail({
    to: { email: input.contact, name: input.firstName },
    ...buildIdentityVerificationEmail({ firstName: input.firstName, code }),
    idempotencyKey: `identity-device-${input.challengeId}`,
    tags: ["lyceegest-identity"],
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    if (!identityDeviceFeatureEnabled()) {
      throw new HttpError(503, "La vérification d’identité n’est pas encore activée.");
    }
    let config;
    let claims;
    try {
      config = identityLookupApiConfig();
      const receipt = readChallengeReceipt(req);
      if (!receipt) throw new Error("missing_receipt");
      claims = challengeReceiptClaims(openIdentityLookupReceipt(receipt, config.receiptKey));
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(401, "Vérification expirée ou invalide.");
    }
    const now = new Date();
    const publicPayload = identityDeviceReadyPayload(new Date(claims.expiresAt));
    const codeSentPayload = identityDeviceCodeSentPayload(new Date(claims.expiresAt));
    const contactUpdatePayload = identityDeviceContactUpdatePayload(new Date(claims.expiresAt));
    if (new Date(claims.expiresAt) <= now) {
      clearChallengeReceiptCookie(res);
      throw new HttpError(410, "Ce code a expiré. Demandez un nouveau code.");
    }

    const [row] = await db
      .select({
        challenge: identityDeviceChallenges,
        lookup: identityDirectoryLookupRequests,
      })
      .from(identityDeviceChallenges)
      .innerJoin(
        identityDirectoryLookupRequests,
        eq(identityDirectoryLookupRequests.id, identityDeviceChallenges.lookupRequestId)
      )
      .where(
        and(
          eq(identityDeviceChallenges.id, claims.challengeId),
          eq(identityDeviceChallenges.institutionId, claims.institutionId),
          eq(identityDeviceChallenges.lookupRequestId, claims.requestId),
          eq(identityDirectoryLookupRequests.publicActorId, claims.challengeId)
        )
      )
      .limit(1);
    if (!row) throw new HttpError(401, "Vérification expirée ou invalide.");
    if (row.challenge.expiresAt <= now) {
      await db
        .update(identityDeviceChallenges)
        .set({ status: "expired" })
        .where(eq(identityDeviceChallenges.id, claims.challengeId));
      clearChallengeReceiptCookie(res);
      throw new HttpError(410, "Ce code a expiré. Demandez un nouveau code.");
    }

    if (row.challenge.status === "code_sent") return codeSentPayload;
    if (["ineligible", "failed"].includes(row.challenge.status)) return contactUpdatePayload;

    if (
      row.challenge.status === "lookup_queued" &&
      ["not_found", "ambiguous", "failed", "expired"].includes(row.lookup.status)
    ) {
      await db
        .update(identityDeviceChallenges)
        .set({ status: row.lookup.status === "failed" ? "failed" : "ineligible" })
        .where(
          and(
            eq(identityDeviceChallenges.id, claims.challengeId),
            eq(identityDeviceChallenges.status, "lookup_queued")
          )
        );
      return contactUpdatePayload;
    }

    let shouldDeliver = false;
    let firstName = "";
    if (row.challenge.status === "lookup_queued" && row.lookup.status === "completed") {
      if (
        row.lookup.resultSchema !== 1 ||
        !row.lookup.resultIv ||
        !row.lookup.resultAuthTag ||
        !row.lookup.resultCiphertext
      ) {
        throw new HttpError(503, "La vérification n’a pas pu être contrôlée.");
      }
      const result = parseDeviceLookupResult(
        decryptIdentityLookupResult({
          envelope: {
            schema: row.lookup.resultSchema,
            iv: row.lookup.resultIv,
            authTag: row.lookup.resultAuthTag,
            ciphertext: row.lookup.resultCiphertext,
          },
          responseKey: claims.responseKey,
          requestId: claims.requestId,
          institutionId: claims.institutionId,
          actorId: claims.challengeId,
        })
      );
      if (
        result.matchedBy !== claims.contactType ||
        !identityDeviceClaimsMatch({
          claimedProfile: claims.claimedProfile,
          claimedFirstName: claims.claimedFirstName,
          claimedLastName: claims.claimedLastName,
          personType: result.personType,
          firstName: result.firstName,
          lastName: result.lastName,
        })
      ) {
        await db
          .update(identityDeviceChallenges)
          .set({ status: "ineligible" })
          .where(
            and(
              eq(identityDeviceChallenges.id, claims.challengeId),
              eq(identityDeviceChallenges.status, "lookup_queued")
            )
          );
        return contactUpdatePayload;
      }
      const code = identityDeviceCode(claims.challengeId);
      const [prepared] = await db
        .update(identityDeviceChallenges)
        .set({
          status: "delivery_pending",
          codeHash: identityDeviceCodeHash(claims.challengeId, code),
          matchedImportId: result.directoryVersionId,
          matchedPersonRef: result.personRef,
          matchedPersonType: result.personType,
        })
        .where(
          and(
            eq(identityDeviceChallenges.id, claims.challengeId),
            eq(identityDeviceChallenges.status, "lookup_queued")
          )
        )
        .returning({ id: identityDeviceChallenges.id });
      shouldDeliver = Boolean(prepared);
      firstName = result.firstName;
    } else if (
      row.challenge.status === "delivery_pending" &&
      row.challenge.updatedAt < new Date(now.getTime() - 30_000)
    ) {
      const [claimed] = await db
        .update(identityDeviceChallenges)
        .set({ updatedAt: now })
        .where(
          and(
            eq(identityDeviceChallenges.id, claims.challengeId),
            eq(identityDeviceChallenges.status, "delivery_pending"),
            lt(identityDeviceChallenges.updatedAt, new Date(now.getTime() - 30_000))
          )
        )
        .returning({ id: identityDeviceChallenges.id });
      shouldDeliver = Boolean(claimed);
    }

    if (shouldDeliver) {
      try {
        await deliverCode({
          challengeId: claims.challengeId,
          contactType: claims.contactType,
          contact: claims.contact,
          firstName,
        });
        await db
          .update(identityDeviceChallenges)
          .set({ status: "code_sent", codeSentAt: new Date() })
          .where(
            and(
              eq(identityDeviceChallenges.id, claims.challengeId),
              eq(identityDeviceChallenges.status, "delivery_pending")
            )
          );
      } catch {
        await db
          .update(identityDeviceChallenges)
          .set({ status: "failed" })
          .where(
            and(
              eq(identityDeviceChallenges.id, claims.challengeId),
              inArray(identityDeviceChallenges.status, ["delivery_pending"])
            )
          );
        return contactUpdatePayload;
      }
      return codeSentPayload;
    }
    return publicPayload;
  });
}

export const config = { api: { bodyParser: false } };
