import { createHash, randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  identityDeviceChallenges,
  identityDirectoryAudit,
  identityDirectoryImports,
  identityDirectoryLookupRequests,
} from "../../../db/schema.js";
import {
  IDENTITY_LOOKUP_TTL_SECONDS,
  encryptIdentityLookupRequest,
  identityLookupApiConfig,
  sealIdentityLookupReceipt,
} from "../../../shared/identity-directory-lookup-crypto.mjs";
import {
  IDENTITY_DEVICE_CHALLENGE_SECONDS,
  identityDeviceFeatureEnabled,
  identityDeviceReadyPayload,
  parseIdentityDeviceRequestInput,
} from "../../../shared/identity-device-access.js";
import { HttpError } from "../../_shared/auth.js";
import {
  randomResponseKey,
  setChallengeReceiptCookie,
} from "../../_shared/identity-device-access.js";
import { requireConfiguredInstitution } from "../../_shared/institution-context.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { enforceIdentityOtpRequestLimits } from "../../_shared/support-rate-limits.js";
import { personalHash } from "../../_shared/support.js";

const JUSTIFICATION =
  "Vérification autonome d’une adresse connue afin d’ouvrir une session d’identité limitée.";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    if (!identityDeviceFeatureEnabled()) {
      throw new HttpError(503, "La vérification par email n’est pas encore activée.");
    }
    let input;
    try {
      input = parseIdentityDeviceRequestInput(req.body);
    } catch {
      throw new HttpError(400, "Saisissez une adresse email valide.");
    }
    const institution = await requireConfiguredInstitution();
    const [activeDirectory] = await db
      .select({ id: identityDirectoryImports.id })
      .from(identityDirectoryImports)
      .where(
        and(
          eq(identityDirectoryImports.institutionId, institution.id),
          eq(identityDirectoryImports.status, "active")
        )
      )
      .limit(1);
    if (!activeDirectory) {
      throw new HttpError(503, "La vérification par email n’est pas encore disponible.");
    }
    await enforceIdentityOtpRequestLimits({
      req,
      institutionId: institution.id,
      deviceId: input.deviceId,
      email: input.email,
    });

    let config;
    try {
      config = identityLookupApiConfig();
    } catch {
      throw new HttpError(503, "La vérification par email n’est pas encore disponible.");
    }
    const challengeId = randomUUID();
    const requestId = randomUUID();
    const responseKey = randomResponseKey();
    const now = new Date();
    const lookupExpiresAt = new Date(now.getTime() + IDENTITY_LOOKUP_TTL_SECONDS * 1000);
    const challengeExpiresAt = new Date(
      now.getTime() + IDENTITY_DEVICE_CHALLENGE_SECONDS * 1000
    );
    const envelope = encryptIdentityLookupRequest({
      value: {
        schema: 1,
        requestId,
        institutionId: institution.id,
        actorId: challengeId,
        searchType: "email",
        query: input.email,
        reasonCategory: "identity_verification",
        justification: JUSTIFICATION,
        responseKey: responseKey.toString("base64"),
        requestedAt: now.toISOString(),
        expiresAt: lookupExpiresAt.toISOString(),
      },
      requestId,
      institutionId: institution.id,
      actorId: challengeId,
      config,
    });
    const justificationHash = createHash("sha256").update(JUSTIFICATION).digest("hex");
    const deviceKeyHash = personalHash(
      `identity-device:${institution.id}:${input.deviceId}`
    );
    const contactHash = personalHash(
      `identity-device-contact:${institution.id}:${input.email}`
    );

    await db.transaction(async (tx) => {
      await tx.insert(identityDirectoryLookupRequests).values({
        id: requestId,
        institutionId: institution.id,
        actorId: null,
        publicActorId: challengeId,
        searchType: "email",
        reasonCategory: "identity_verification",
        justificationHash,
        requestSchema: envelope.schema,
        requestKeyVersion: envelope.keyVersion,
        requestWrappedKey: envelope.wrappedKey,
        requestIv: envelope.iv,
        requestAuthTag: envelope.authTag,
        requestCiphertext: envelope.ciphertext,
        expiresAt: lookupExpiresAt,
      });
      await tx.insert(identityDeviceChallenges).values({
        id: challengeId,
        institutionId: institution.id,
        lookupRequestId: requestId,
        deviceKeyHash,
        contactHash,
        rememberDevice: input.rememberDevice,
        expiresAt: challengeExpiresAt,
      });
      await tx.insert(identityDirectoryAudit).values({
        institutionId: institution.id,
        resourceType: "lookup_request",
        resourceId: requestId,
        action: "request_lookup",
        actorId: null,
        summary: {
          searchType: "email",
          reasonCategory: "identity_verification",
          publicSelfService: true,
          expiresAt: lookupExpiresAt.toISOString(),
        },
      });
      await tx.execute(sql`
        select pgmq.send(
          'identity_directory_lookup',
          ${JSON.stringify({
            schema: 1,
            request_id: requestId,
            institution_id: institution.id,
          })}::jsonb
        )
      `);
    });

    const receipt = sealIdentityLookupReceipt(
      {
        schema: 1,
        challengeId,
        requestId,
        institutionId: institution.id,
        responseKey: responseKey.toString("base64"),
        email: input.email,
        deviceId: input.deviceId,
        expiresAt: challengeExpiresAt.toISOString(),
      },
      config.receiptKey
    );
    setChallengeReceiptCookie(res, receipt, IDENTITY_DEVICE_CHALLENGE_SECONDS);
    res.statusCode = 202;
    return identityDeviceReadyPayload(challengeExpiresAt);
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
