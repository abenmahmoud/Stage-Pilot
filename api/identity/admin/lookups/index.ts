import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  identityDirectoryAudit,
  identityDirectoryImports,
  identityDirectoryLookupRequests,
} from "../../../../db/schema.js";
import {
  IDENTITY_LOOKUP_TTL_SECONDS,
  encryptIdentityLookupRequest,
  identityLookupApiConfig,
  sealIdentityLookupReceipt,
} from "../../../../shared/identity-directory-lookup-crypto.mjs";
import { parseIdentityLookupInput } from "../../../../shared/identity-directory-lookup.js";
import { HttpError } from "../../../_shared/auth.js";
import { requireIdentityDirectoryManager } from "../../../_shared/identity-directory.js";
import { registryInputError } from "../../../_shared/knowledge-registry.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

function apiConfig() {
  try {
    return identityLookupApiConfig();
  } catch {
    throw new HttpError(
      503,
      "La recherche sécurisée n’est pas encore activée sur cet environnement."
    );
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  return handleApi(res, async () => {
    const context = await requireIdentityDirectoryManager(req);
    const [activeDirectory] = await db
      .select({ id: identityDirectoryImports.id })
      .from(identityDirectoryImports)
      .where(
        and(
          eq(identityDirectoryImports.institutionId, context.institutionId),
          eq(identityDirectoryImports.status, "active")
        )
      )
      .limit(1);

    if (req.method === "GET") {
      let configured = true;
      try {
        identityLookupApiConfig();
      } catch {
        configured = false;
      }
      return {
        available: configured && Boolean(activeDirectory),
        configured,
        hasActiveDirectory: Boolean(activeDirectory),
        ttlSeconds: IDENTITY_LOOKUP_TTL_SECONDS,
      };
    }

    if (!activeDirectory) {
      throw new HttpError(409, "Activez d’abord une version contrôlée du répertoire.");
    }
    let input;
    try {
      input = parseIdentityLookupInput(req.body);
    } catch (error) {
      registryInputError(error);
    }

    const config = apiConfig();
    const requestId = randomUUID();
    const responseKey = randomBytes(32);
    const requestedAt = new Date();
    const expiresAt = new Date(requestedAt.getTime() + IDENTITY_LOOKUP_TTL_SECONDS * 1000);
    const envelope = encryptIdentityLookupRequest({
      value: {
        schema: 1,
        requestId,
        institutionId: context.institutionId,
        actorId: context.user.id,
        searchType: input.searchType,
        query: input.query,
        reasonCategory: input.reasonCategory,
        justification: input.justification,
        responseKey: responseKey.toString("base64"),
        requestedAt: requestedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
      requestId,
      institutionId: context.institutionId,
      actorId: context.user.id,
      config,
    });
    const justificationHash = createHash("sha256")
      .update(input.justification, "utf8")
      .digest("hex");

    await db.transaction(async (tx) => {
      await tx.execute(sql`
        select pg_advisory_xact_lock(
          hashtextextended(${`identity-lookup:${context.user.id}`}::text, 501731)
        )
      `);
      const tenMinutesAgo = new Date(requestedAt.getTime() - 10 * 60 * 1000);
      const [recent] = await tx
        .select({ value: count() })
        .from(identityDirectoryLookupRequests)
        .where(
          and(
            eq(identityDirectoryLookupRequests.institutionId, context.institutionId),
            eq(identityDirectoryLookupRequests.actorId, context.user.id),
            gte(identityDirectoryLookupRequests.createdAt, tenMinutesAgo)
          )
        );
      if (Number(recent?.value ?? 0) >= 20) {
        throw new HttpError(429, "Trop de consultations rapprochées. Réessayez plus tard.");
      }
      const [pending] = await tx
        .select({ value: count() })
        .from(identityDirectoryLookupRequests)
        .where(
          and(
            eq(identityDirectoryLookupRequests.institutionId, context.institutionId),
            eq(identityDirectoryLookupRequests.actorId, context.user.id),
            inArray(identityDirectoryLookupRequests.status, ["queued", "processing"])
          )
        );
      if (Number(pending?.value ?? 0) >= 3) {
        throw new HttpError(429, "Trois recherches sont déjà en cours pour ce compte.");
      }
      await tx.insert(identityDirectoryLookupRequests).values({
        id: requestId,
        institutionId: context.institutionId,
        actorId: context.user.id,
        searchType: input.searchType,
        reasonCategory: input.reasonCategory,
        justificationHash,
        requestSchema: envelope.schema,
        requestKeyVersion: envelope.keyVersion,
        requestWrappedKey: envelope.wrappedKey,
        requestIv: envelope.iv,
        requestAuthTag: envelope.authTag,
        requestCiphertext: envelope.ciphertext,
        expiresAt,
      });
      await tx.insert(identityDirectoryAudit).values({
        institutionId: context.institutionId,
        resourceType: "lookup_request",
        resourceId: requestId,
        action: "request_lookup",
        actorId: context.user.id,
        summary: {
          searchType: input.searchType,
          reasonCategory: input.reasonCategory,
          justificationHash,
          expiresAt: expiresAt.toISOString(),
        },
      });
      await tx.execute(sql`
        select pgmq.send(
          'identity_directory_lookup',
          ${JSON.stringify({
            schema: 1,
            request_id: requestId,
            institution_id: context.institutionId,
          })}::jsonb
        )
      `);
    });

    const receipt = sealIdentityLookupReceipt(
      {
        schema: 1,
        requestId,
        institutionId: context.institutionId,
        actorId: context.user.id,
        responseKey: responseKey.toString("base64"),
        expiresAt: expiresAt.toISOString(),
      },
      config.receiptKey
    );
    return { requestId, status: "queued", receipt, expiresAt: expiresAt.toISOString() };
  });
}
