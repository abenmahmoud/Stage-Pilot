import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  supportMagicTokens,
  supportRequests,
} from "../../../db/schema.js";
import { HttpError } from "../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import {
  opaqueToken,
  readSupportSessionToken,
  setSupportSessionCookie,
  sha256,
} from "../../_shared/support.js";
import { openSupportAccessSession } from "../../_shared/support-access-session.js";
import { enforceMagicTokenNetworkGuard } from "../../_shared/support-rate-limits.js";
import { requireConfiguredInstitution } from "../../_shared/institution-context.js";
import { isSupportMagicAccessPayload } from "../../../shared/support-magic-access-payload-policy.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  return handleApi(res, async () => {
    if (Array.isArray(req.query.token)) {
      throw new HttpError(400, "Lien de suivi invalide");
    }
    const rawMagicToken = req.query.token;
    if (!rawMagicToken || !/^[A-Za-z0-9_-]{40,60}$/.test(rawMagicToken)) {
      throw new HttpError(400, "Lien de suivi invalide");
    }
    await enforceMagicTokenNetworkGuard(req);
    const institution = await requireConfiguredInstitution();

    const existingSessionToken = readSupportSessionToken(req);
    const newSessionToken = opaqueToken();
    const result = await db.transaction(async (tx) => {
      const [magic] = await tx
        .select({
          id: supportMagicTokens.id,
          requestId: supportMagicTokens.requestId,
          contactId: supportMagicTokens.contactId,
          publicCode: supportRequests.publicCode,
        })
        .from(supportMagicTokens)
        .innerJoin(supportRequests, eq(supportRequests.id, supportMagicTokens.requestId))
        .where(
          and(
            eq(supportMagicTokens.tokenHash, sha256(rawMagicToken)),
            eq(supportMagicTokens.purpose, "support_access"),
            gt(supportMagicTokens.expiresAt, new Date()),
            isNull(supportMagicTokens.usedAt),
            eq(supportRequests.institutionId, institution.id)
          )
        )
        .limit(1);
      if (!magic) throw new HttpError(410, "Ce lien de suivi est expiré ou déjà utilisé");

      const now = new Date();
      const [consumed] = await tx
        .update(supportMagicTokens)
        .set({
          usedAt: now,
          attemptCount: sql`${supportMagicTokens.attemptCount} + 1`,
        })
        .where(
          and(
            eq(supportMagicTokens.id, magic.id),
            gt(supportMagicTokens.expiresAt, now),
            isNull(supportMagicTokens.usedAt)
          )
        )
        .returning({ id: supportMagicTokens.id });
      if (!consumed) {
        throw new HttpError(410, "Ce lien de suivi est expiré ou déjà utilisé");
      }

      await openSupportAccessSession({
        tx,
        institutionId: institution.id,
        requestId: magic.requestId,
        contactId: magic.contactId,
        existingSessionToken,
        newSessionToken,
        label: "Lien sécurisé",
        verificationSource: "email_magic_link",
        now,
      });

      return { publicCode: magic.publicCode };
    });

    const payload = { request: result };
    if (!isSupportMagicAccessPayload(payload, result.publicCode)) {
      throw new HttpError(503, "La confirmation du lien de suivi est invalide.");
    }
    setSupportSessionCookie(res, newSessionToken);
    return payload;
  });
}

export const config = { api: { bodyParser: false } };
