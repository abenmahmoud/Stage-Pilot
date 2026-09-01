import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  supportContacts,
  supportDeviceSessions,
  supportEvents,
  supportRequests,
  supportSessionRequests,
} from "../../db/schema.js";
import { SUPPORT_SESSION_DAYS, sha256 } from "./support.js";
import { HttpError } from "./auth.js";

type SupportTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type VerificationSource = "email_magic_link" | "email_one_time_code";

export async function openSupportAccessSession(input: {
  tx: SupportTransaction;
  institutionId: string;
  requestId: string;
  contactId: string | null;
  existingSessionToken: string | null;
  newSessionToken: string;
  label: string;
  verificationSource: VerificationSource;
  now: Date;
}): Promise<void> {
  const unavailable = () => input.verificationSource === "email_one_time_code"
    ? new HttpError(401, "Le code est incorrect, expiré ou déjà utilisé.")
    : new HttpError(410, "Ce lien de suivi est expiré ou déjà utilisé");
  if (!input.contactId) throw unavailable();

  // Keep contact revocation and access issuance ordered within the exchange.
  const [contact] = await input.tx
    .select({ id: supportContacts.id })
    .from(supportContacts)
    .innerJoin(supportRequests, eq(supportRequests.id, supportContacts.requestId))
    .where(and(
      eq(supportContacts.id, input.contactId),
      eq(supportContacts.requestId, input.requestId),
      eq(supportRequests.institutionId, input.institutionId),
      eq(supportContacts.channel, "email"),
      eq(supportContacts.usageScope, "support"),
      isNull(supportContacts.disabledAt)
    ))
    .limit(1)
    .for("update", { of: supportContacts });
  if (!contact) throw unavailable();

  const [session] = await input.tx
    .insert(supportDeviceSessions)
    .values({
      sessionHash: sha256(input.newSessionToken),
      label: input.label,
      expiresAt: new Date(input.now.getTime() + SUPPORT_SESSION_DAYS * 24 * 60 * 60 * 1000),
    })
    .returning({ id: supportDeviceSessions.id });

  if (input.existingSessionToken) {
    const [previousSession] = await input.tx
      .select({ id: supportDeviceSessions.id })
      .from(supportDeviceSessions)
      .where(
        and(
          eq(supportDeviceSessions.sessionHash, sha256(input.existingSessionToken)),
          gt(supportDeviceSessions.expiresAt, input.now),
          isNull(supportDeviceSessions.revokedAt)
        )
      )
      .limit(1)
      .for("update");
    if (previousSession) {
      const previousGrants = await input.tx
        .select({ requestId: supportSessionRequests.requestId })
        .from(supportSessionRequests)
        .innerJoin(supportRequests, eq(supportRequests.id, supportSessionRequests.requestId))
        .where(
          and(
            eq(supportSessionRequests.sessionId, previousSession.id),
            eq(supportRequests.institutionId, input.institutionId)
          )
        );
      if (previousGrants.length > 0) {
        await input.tx
          .insert(supportSessionRequests)
          .values(previousGrants.map((grant) => ({
            sessionId: session.id,
            requestId: grant.requestId,
          })))
          .onConflictDoNothing();
      }
      await input.tx
        .update(supportDeviceSessions)
        .set({ revokedAt: input.now })
        .where(
          and(
            eq(supportDeviceSessions.id, previousSession.id),
            isNull(supportDeviceSessions.revokedAt)
          )
        );
    }
  }

  await input.tx
    .insert(supportSessionRequests)
    .values({ sessionId: session.id, requestId: input.requestId })
    .onConflictDoNothing();

  const verifiedContacts = await input.tx
    .update(supportContacts)
    .set({
      isVerified: true,
      verificationSource: input.verificationSource,
      verifiedAt: input.now,
    })
    .where(
      and(
        eq(supportContacts.id, contact.id),
        eq(supportContacts.requestId, input.requestId),
        eq(supportContacts.channel, "email"),
        eq(supportContacts.usageScope, "support"),
        eq(supportContacts.isVerified, false),
        isNull(supportContacts.disabledAt)
      )
    )
    .returning({ id: supportContacts.id });

  if (verifiedContacts.length > 0) {
    await input.tx.insert(supportEvents).values({
      requestId: input.requestId,
      eventType: "identity.contact_verified",
      actorType: "requester",
      actorId: session.id,
      toValue: {
        identityStatus: "contact_verifie",
        method: input.verificationSource,
      },
      correlationId: randomUUID(),
    });
  }
}
