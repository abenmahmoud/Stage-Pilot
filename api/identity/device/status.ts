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
  identityDeviceFeatureEnabled,
  identityDeviceReadyPayload,
} from "../../../shared/identity-device-access.js";
import { HttpError } from "../../_shared/auth.js";
import { escapeHtml, sendTransactionalEmail } from "../../_shared/brevo.js";
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
  matchedBy: "email";
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
    input.matchedBy !== "email" ||
    typeof input.directoryVersionId !== "string"
  ) {
    throw new HttpError(503, "La vérification n’a pas pu être contrôlée.");
  }
  return input as unknown as DeviceLookupResult;
}

async function deliverCode(input: {
  challengeId: string;
  email: string;
  firstName: string;
}): Promise<void> {
  const code = identityDeviceCode(input.challengeId);
  const safeName = escapeHtml(input.firstName.trim() || "");
  const greeting = safeName ? `Bonjour ${safeName},` : "Bonjour,";
  await sendTransactionalEmail({
    to: { email: input.email },
    subject: "Votre code de vérification - Lycée Blaise Cendrars",
    textContent: `${greeting.replace(/<[^>]*>/g, "")}\n\nVotre code de vérification est : ${code}\n\nIl expire dans 10 minutes. Ne le transmettez à personne. Le lycée ne vous demandera jamais votre mot de passe.`,
    htmlContent: `<p>${greeting}</p><p>Votre code de vérification est :</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Il expire dans 10 minutes. Ne le transmettez à personne.</p><p>Le lycée ne vous demandera jamais votre mot de passe.</p>`,
    idempotencyKey: `identity-device-${input.challengeId}`,
    tags: ["lyceegest-identity"],
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    if (!identityDeviceFeatureEnabled()) {
      throw new HttpError(503, "La vérification par email n’est pas encore activée.");
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
      return publicPayload;
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
          email: claims.email,
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
      }
    }
    return publicPayload;
  });
}

export const config = { api: { bodyParser: false } };
