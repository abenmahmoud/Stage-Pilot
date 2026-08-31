import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  identityDirectoryAudit,
  identityDirectoryLookupRequests,
} from "../../../../db/schema.js";
import {
  decryptIdentityLookupResult,
  identityLookupApiConfig,
  openIdentityLookupReceipt,
} from "../../../../shared/identity-directory-lookup-crypto.mjs";
import { parseIdentityLookupResult } from "../../../../shared/identity-directory-lookup.js";
import {
  isIdentityLookupStatusPayload,
  type IdentityLookupStatusPayload,
} from "../../../../shared/identity-directory-lookup-payload-policy.js";
import { HttpError } from "../../../_shared/auth.js";
import { requireIdentityDirectoryManager } from "../../../_shared/identity-directory.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value || !UUID.test(value)) throw new HttpError(400, "Recherche invalide.");
  return value;
}

function receiptHeader(req: VercelRequest): string {
  const value = req.headers["x-identity-lookup-receipt"];
  const receipt = Array.isArray(value) ? value[0] : value;
  if (!receipt) throw new HttpError(401, "Reçu de recherche manquant.");
  return receipt;
}

function receiptClaim(value: unknown): string {
  if (typeof value !== "string" || value.length < 3 || value.length > 500) {
    throw new HttpError(401, "Reçu de recherche invalide.");
  }
  return value;
}

function verifiedPayload(value: unknown, requestId: string): IdentityLookupStatusPayload {
  if (!isIdentityLookupStatusPayload(value, requestId)) {
    throw new HttpError(503, "L’état de la consultation sécurisée est invalide.");
  }
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  return handleApi(res, async () => {
    const context = await requireIdentityDirectoryManager(req);
    const id = routeId(req);
    let config;
    let claims: Record<string, unknown>;
    try {
      config = identityLookupApiConfig();
      claims = openIdentityLookupReceipt(receiptHeader(req), config.receiptKey);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(401, "Reçu de recherche invalide ou altéré.");
    }
    const claimRequestId = receiptClaim(claims.requestId);
    const claimInstitutionId = receiptClaim(claims.institutionId);
    const claimActorId = receiptClaim(claims.actorId);
    const claimExpiresAt = receiptClaim(claims.expiresAt);
    const responseKey = receiptClaim(claims.responseKey);
    if (
      claimRequestId !== id ||
      claimInstitutionId !== context.institutionId ||
      claimActorId !== context.user.id ||
      !Number.isFinite(Date.parse(claimExpiresAt))
    ) {
      throw new HttpError(403, "Ce reçu n’appartient pas à cette session agent.");
    }
    const now = new Date();
    if (new Date(claimExpiresAt) <= now) {
      throw new HttpError(410, "Cette recherche a expiré. Lancez une nouvelle consultation.");
    }

    let [lookup] = await db
      .select()
      .from(identityDirectoryLookupRequests)
      .where(
        and(
          eq(identityDirectoryLookupRequests.id, id),
          eq(identityDirectoryLookupRequests.institutionId, context.institutionId),
          eq(identityDirectoryLookupRequests.actorId, context.user.id)
        )
      )
      .limit(1);
    if (!lookup) throw new HttpError(404, "Recherche introuvable.");

    if (lookup.expiresAt <= now && ["queued", "processing", "completed"].includes(lookup.status)) {
      await db.transaction(async (tx) => {
        const [expired] = await tx
          .update(identityDirectoryLookupRequests)
          .set({
            status: "expired",
            completedAt: now,
            requestSchema: null,
            requestKeyVersion: null,
            requestWrappedKey: null,
            requestIv: null,
            requestAuthTag: null,
            requestCiphertext: null,
            resultSchema: null,
            resultIv: null,
            resultAuthTag: null,
            resultCiphertext: null,
            resultCount: null,
            matchedImportId: null,
            errorCode: "lookup_expired",
          })
          .where(
            and(
              eq(identityDirectoryLookupRequests.id, id),
              eq(identityDirectoryLookupRequests.institutionId, context.institutionId),
              eq(identityDirectoryLookupRequests.actorId, context.user.id),
              inArray(identityDirectoryLookupRequests.status, ["queued", "processing", "completed"])
            )
          )
          .returning({ id: identityDirectoryLookupRequests.id });
        if (expired) {
          await tx.insert(identityDirectoryAudit).values({
            institutionId: context.institutionId,
            resourceType: "lookup_request",
            resourceId: id,
            action: "expire_lookup",
            actorId: context.user.id,
            summary: { previousStatus: lookup.status },
          });
        }
      });
      lookup = { ...lookup, status: "expired" };
    }

    if (lookup.status === "completed") {
      if (
        lookup.resultSchema !== 1 ||
        !lookup.resultIv ||
        !lookup.resultAuthTag ||
        !lookup.resultCiphertext
      ) {
        throw new HttpError(503, "Le résultat sécurisé est incomplet.");
      }
      let result;
      try {
        result = parseIdentityLookupResult(
          decryptIdentityLookupResult({
            envelope: {
              schema: lookup.resultSchema,
              iv: lookup.resultIv,
              authTag: lookup.resultAuthTag,
              ciphertext: lookup.resultCiphertext,
            },
            responseKey,
            requestId: id,
            institutionId: context.institutionId,
            actorId: context.user.id,
          })
        );
      } catch {
        throw new HttpError(503, "Le résultat sécurisé ne peut pas être vérifié.");
      }
      await db.transaction(async (tx) => {
        const [firstRead] = await tx
          .update(identityDirectoryLookupRequests)
          .set({ readAt: now })
          .where(
            and(
              eq(identityDirectoryLookupRequests.id, id),
              eq(identityDirectoryLookupRequests.institutionId, context.institutionId),
              eq(identityDirectoryLookupRequests.actorId, context.user.id),
              isNull(identityDirectoryLookupRequests.readAt)
            )
          )
          .returning({ id: identityDirectoryLookupRequests.id });
        if (firstRead) {
          await tx.insert(identityDirectoryAudit).values({
            institutionId: context.institutionId,
            resourceType: "lookup_request",
            resourceId: id,
            action: "read_lookup",
            actorId: context.user.id,
            summary: { searchType: lookup.searchType },
          });
        }
      });
      return verifiedPayload({
        requestId: id,
        status: "completed",
        result,
        expiresAt: lookup.expiresAt.toISOString(),
      }, id);
    }

    if (lookup.status === "not_found") {
      return verifiedPayload({ requestId: id, status: "not_found", expiresAt: lookup.expiresAt.toISOString() }, id);
    }
    if (lookup.status === "ambiguous") {
      return verifiedPayload({ requestId: id, status: "ambiguous", expiresAt: lookup.expiresAt.toISOString() }, id);
    }
    if (lookup.status === "failed") {
      return verifiedPayload({ requestId: id, status: "failed", expiresAt: lookup.expiresAt.toISOString() }, id);
    }
    if (lookup.status === "expired") {
      return verifiedPayload({ requestId: id, status: "expired", expiresAt: lookup.expiresAt.toISOString() }, id);
    }
    return verifiedPayload({ requestId: id, status: lookup.status, expiresAt: lookup.expiresAt.toISOString() }, id);
  });
}
