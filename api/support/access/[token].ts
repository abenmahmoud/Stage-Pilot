import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  supportDeviceSessions,
  supportMagicTokens,
  supportRequests,
  supportSessionRequests,
} from "../../../db/schema.js";
import { HttpError } from "../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import {
  SUPPORT_SESSION_DAYS,
  opaqueToken,
  readSupportSessionToken,
  setSupportSessionCookie,
  sha256,
} from "../../_shared/support.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  return handleApi(res, async () => {
    const rawMagicToken = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token;
    if (!rawMagicToken || !/^[A-Za-z0-9_-]{40,60}$/.test(rawMagicToken)) {
      throw new HttpError(400, "Lien de suivi invalide");
    }

    const existingSessionToken = readSupportSessionToken(req);
    const newSessionToken = existingSessionToken ?? opaqueToken();
    const result = await db.transaction(async (tx) => {
      const [magic] = await tx
        .select({
          id: supportMagicTokens.id,
          requestId: supportMagicTokens.requestId,
          publicCode: supportRequests.publicCode,
        })
        .from(supportMagicTokens)
        .innerJoin(supportRequests, eq(supportRequests.id, supportMagicTokens.requestId))
        .where(
          and(
            eq(supportMagicTokens.tokenHash, sha256(rawMagicToken)),
            eq(supportMagicTokens.purpose, "support_access"),
            gt(supportMagicTokens.expiresAt, new Date()),
            isNull(supportMagicTokens.usedAt)
          )
        )
        .limit(1);
      if (!magic) throw new HttpError(410, "Ce lien de suivi est expiré ou déjà utilisé");

      let [session] = await tx
        .select({ id: supportDeviceSessions.id })
        .from(supportDeviceSessions)
        .where(
          and(
            eq(supportDeviceSessions.sessionHash, sha256(newSessionToken)),
            gt(supportDeviceSessions.expiresAt, new Date()),
            isNull(supportDeviceSessions.revokedAt)
          )
        )
        .limit(1);
      if (!session) {
        [session] = await tx
          .insert(supportDeviceSessions)
          .values({
            sessionHash: sha256(newSessionToken),
            label: "Lien sécurisé",
            expiresAt: new Date(Date.now() + SUPPORT_SESSION_DAYS * 24 * 60 * 60 * 1000),
          })
          .returning({ id: supportDeviceSessions.id });
      }

      await tx
        .insert(supportSessionRequests)
        .values({ sessionId: session.id, requestId: magic.requestId })
        .onConflictDoNothing();
      await tx
        .update(supportMagicTokens)
        .set({ usedAt: new Date(), attemptCount: 1 })
        .where(eq(supportMagicTokens.id, magic.id));
      return { publicCode: magic.publicCode };
    });

    if (!existingSessionToken) setSupportSessionCookie(res, newSessionToken);
    return { request: result };
  });
}

export const config = { api: { bodyParser: false } };
