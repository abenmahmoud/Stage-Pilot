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
      .limit(1);
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

  let targetContactId = input.contactId;
  if (!targetContactId) {
    const legacyContacts = await input.tx
      .select({ id: supportContacts.id })
      .from(supportContacts)
      .where(
        and(
          eq(supportContacts.requestId, input.requestId),
          eq(supportContacts.channel, "email"),
          isNull(supportContacts.disabledAt)
        )
      )
      .limit(2);
    if (legacyContacts.length === 1) targetContactId = legacyContacts[0].id;
  }

  const verifiedContacts = targetContactId
    ? await input.tx
        .update(supportContacts)
        .set({
          isVerified: true,
          verificationSource: input.verificationSource,
          verifiedAt: input.now,
        })
        .where(
          and(
            eq(supportContacts.id, targetContactId),
            eq(supportContacts.requestId, input.requestId),
            eq(supportContacts.channel, "email"),
            eq(supportContacts.isVerified, false),
            isNull(supportContacts.disabledAt)
          )
        )
        .returning({ id: supportContacts.id })
    : [];

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
