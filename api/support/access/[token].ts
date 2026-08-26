import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  supportContacts,
  supportDeviceSessions,
  supportEvents,
  supportMagicTokens,
  supportRequests,
  supportSessionRequests,
} from "../../../db/schema.js";
import { HttpError } from "../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import {
  SUPPORT_SESSION_DAYS,
  enforceSupportRateLimit,
  opaqueToken,
  personalHash,
  readSupportSessionToken,
  requestIpHash,
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
    await enforceSupportRateLimit({
      scope: "magic_token_network",
      keyHash: requestIpHash(req) ?? personalHash("network:unknown"),
      limit: 1000,
      windowSeconds: 10 * 60,
    });

    const existingSessionToken = readSupportSessionToken(req);
    const newSessionToken = existingSessionToken ?? opaqueToken();
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

      const now = new Date();
      await tx
        .insert(supportSessionRequests)
        .values({ sessionId: session.id, requestId: magic.requestId })
        .onConflictDoNothing();

      let targetContactId = magic.contactId;
      if (!targetContactId) {
        const legacyContacts = await tx
          .select({ id: supportContacts.id })
          .from(supportContacts)
          .where(
            and(
              eq(supportContacts.requestId, magic.requestId),
              eq(supportContacts.channel, "email"),
              isNull(supportContacts.disabledAt)
            )
          )
          .limit(2);
        if (legacyContacts.length === 1) targetContactId = legacyContacts[0].id;
      }

      const verifiedContacts = targetContactId
        ? await tx
            .update(supportContacts)
            .set({
              isVerified: true,
              verificationSource: "email_magic_link",
              verifiedAt: now,
            })
            .where(
              and(
                eq(supportContacts.id, targetContactId),
                eq(supportContacts.requestId, magic.requestId),
                eq(supportContacts.channel, "email"),
                eq(supportContacts.isVerified, false),
                isNull(supportContacts.disabledAt)
              )
            )
            .returning({ id: supportContacts.id })
        : [];

      if (verifiedContacts.length > 0) {
        await tx.insert(supportEvents).values({
          requestId: magic.requestId,
          eventType: "identity.contact_verified",
          actorType: "requester",
          actorId: session.id,
          toValue: { identityStatus: "contact_verifie", method: "email_magic_link" },
          correlationId: randomUUID(),
        });
      }

      await tx
        .update(supportMagicTokens)
        .set({ usedAt: now, attemptCount: 1 })
        .where(eq(supportMagicTokens.id, magic.id));
      return { publicCode: magic.publicCode };
    });

    if (!existingSessionToken) setSupportSessionCookie(res, newSessionToken);
    return { request: result };
  });
}

export const config = { api: { bodyParser: false } };
