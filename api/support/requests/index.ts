import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { initialSupportStatus } from "../../../shared/support-routing.js";
import { supportDuplicateWindowStart } from "../../../shared/support-duplicate-policy.js";
import {
  supportContacts,
  supportCallbackTasks,
  supportDeviceSessions,
  supportEvents,
  supportMagicTokens,
  supportMessages,
  supportRequests,
  supportSessionRequests,
} from "../../../db/schema.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import {
  SUPPORT_MAGIC_TOKEN_MINUTES,
  SUPPORT_SESSION_DAYS,
  idempotencyKey,
  opaqueToken,
  parseSupportRequest,
  personalHash,
  readSupportSessionToken,
  setSupportSessionCookie,
  sha256,
} from "../../_shared/support.js";
import {
  enforceSupportRequestCreationLimits,
  enforceSupportRequestNetworkGuard,
  recordInvalidSupportRequest,
  supportDeviceRateKey,
} from "../../_shared/support-rate-limits.js";
import { requireConfiguredInstitution } from "../../_shared/institution-context.js";

type DeviceSession = { id: string; rawToken: string | null };

async function getOrCreateDeviceSession(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  req: VercelRequest
): Promise<DeviceSession> {
  const existingToken = readSupportSessionToken(req);
  if (existingToken) {
    const [existing] = await tx
      .select({ id: supportDeviceSessions.id })
      .from(supportDeviceSessions)
      .where(
        and(
            eq(supportDeviceSessions.sessionHash, sha256(existingToken)),
            gt(supportDeviceSessions.expiresAt, new Date()),
            isNull(supportDeviceSessions.revokedAt)
        )
      )
      .limit(1);
    if (existing) return { id: existing.id, rawToken: null };
  }

  const rawToken = opaqueToken();
  const [created] = await tx
    .insert(supportDeviceSessions)
    .values({
      sessionHash: sha256(rawToken),
      label: "Navigateur public",
      expiresAt: new Date(Date.now() + SUPPORT_SESSION_DAYS * 24 * 60 * 60 * 1000),
    })
    .returning({ id: supportDeviceSessions.id });

  return { id: created.id, rawToken };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    return handleApi(res, async () => {
      const deviceKey = supportDeviceRateKey(req);
      await enforceSupportRequestNetworkGuard(req);
      let input;
      try {
        input = parseSupportRequest(req.body);
      } catch (error) {
        await recordInvalidSupportRequest(deviceKey);
        throw error;
      }
      await enforceSupportRequestCreationLimits({ parsed: input, deviceKey });
      const institution = await requireConfiguredInstitution();
      const idempotencyHash = sha256(idempotencyKey(req));
      const correlationId = randomUUID();
      const requesterJobId = randomUUID();
      const agentJobId = randomUUID();
      const rawAccessToken = opaqueToken();

      const result = await db.transaction(async (tx) => {
        const session = await getOrCreateDeviceSession(tx, req);
        const [existing] = await tx
          .select({
            id: supportRequests.id,
            publicCode: supportRequests.publicCode,
            status: supportRequests.status,
            createdAt: supportRequests.createdAt,
          })
          .from(supportRequests)
          .where(and(
            eq(supportRequests.institutionId, institution.id),
            eq(supportRequests.idempotencyKeyHash, idempotencyHash)
          ))
          .limit(1);

        if (existing) {
          await tx
            .insert(supportSessionRequests)
            .values({ sessionId: session.id, requestId: existing.id })
            .onConflictDoNothing();
          return { ...existing, sessionToken: session.rawToken, duplicate: true };
        }

        const contactHashes = [input.email, input.phone]
          .filter((value): value is string => Boolean(value))
          .map((value) => personalHash(value));
        const [duplicateCandidate] = contactHashes.length > 0
          ? await tx
              .select({
                id: supportRequests.id,
              })
              .from(supportRequests)
              .innerJoin(supportContacts, eq(supportContacts.requestId, supportRequests.id))
              .where(and(
                eq(supportRequests.institutionId, institution.id),
                eq(supportRequests.category, input.category),
                gt(supportRequests.createdAt, supportDuplicateWindowStart()),
                ne(supportRequests.status, "indesirable"),
                inArray(supportContacts.normalizedHash, contactHashes)
              ))
              .orderBy(desc(supportRequests.createdAt))
              .limit(1)
          : [];

        const [created] = await tx
          .insert(supportRequests)
          .values({
            institutionId: institution.id,
            idempotencyKeyHash: idempotencyHash,
            requesterType: input.requesterType,
            requesterFirstName: input.requesterFirstName,
            requesterLastName: input.requesterLastName,
            beneficiaryType: input.beneficiaryType,
            beneficiaryFirstName: input.beneficiaryFirstName,
            beneficiaryLastName: input.beneficiaryLastName,
            subjectContext: input.subjectContext,
            category: input.category,
            subcategory: input.subcategory,
            subject: input.subject,
            description: input.description,
            preferredChannel: input.preferredChannel,
            fallbackAllowed: input.fallbackAllowed,
            status: initialSupportStatus(input.routing.confidence),
            priority: input.routing.priority,
            assignedTeam: input.routing.service,
            slaDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          })
          .onConflictDoNothing({
            target: [supportRequests.institutionId, supportRequests.idempotencyKeyHash],
          })
          .returning({
            id: supportRequests.id,
            publicCode: supportRequests.publicCode,
            status: supportRequests.status,
            createdAt: supportRequests.createdAt,
          });

        if (!created) {
          const [racedRequest] = await tx
            .select({
              id: supportRequests.id,
              publicCode: supportRequests.publicCode,
              status: supportRequests.status,
              createdAt: supportRequests.createdAt,
            })
            .from(supportRequests)
            .where(and(
              eq(supportRequests.institutionId, institution.id),
              eq(supportRequests.idempotencyKeyHash, idempotencyHash)
            ))
            .limit(1);
          if (!racedRequest) throw new Error("Idempotent request could not be recovered");
          await tx
            .insert(supportSessionRequests)
            .values({ sessionId: session.id, requestId: racedRequest.id })
            .onConflictDoNothing();
          return { ...racedRequest, sessionToken: session.rawToken, duplicate: true };
        }

        const contacts = [
          input.email
            ? {
                requestId: created.id,
                personType: "requester",
                channel: "email",
                value: input.email,
                normalizedHash: personalHash(input.email),
                isPrimary: input.preferredChannel === "email",
              }
            : null,
          input.phone
            ? {
                requestId: created.id,
                personType: "requester",
                channel: "phone",
                value: input.phone,
                normalizedHash: personalHash(input.phone),
                isPrimary: input.preferredChannel === "phone",
              }
            : null,
        ].filter((contact): contact is NonNullable<typeof contact> => Boolean(contact));

        const insertedContacts = contacts.length > 0
          ? await tx
              .insert(supportContacts)
              .values(contacts)
              .returning({ id: supportContacts.id, channel: supportContacts.channel })
          : [];
        const emailContact = insertedContacts.find((contact) => contact.channel === "email");
        const phoneContact = insertedContacts.find((contact) => contact.channel === "phone");

        const requesterLabel = `${input.requesterFirstName} ${input.requesterLastName}`;
        const transcript = input.conversation.length > 0
          ? input.conversation
          : [{ role: "requester" as const, content: input.description }];
        const transcriptCreatedAt = Date.now();
        const messageRows = transcript.map((turn, index) => ({
          id: randomUUID(),
          requestId: created.id,
          direction: turn.role === "requester" ? "inbound" : "outbound",
          channel: "web",
          authorLabel: turn.role === "requester" ? requesterLabel : "Assistant du lycée",
          bodyText: turn.content,
          deliveryStatus: "stored",
          createdAt: new Date(transcriptCreatedAt + index),
        }));
        await tx.insert(supportMessages).values(messageRows);
        const sourceMessage = [...messageRows]
          .reverse()
          .find((message) => message.direction === "inbound");
        if (!sourceMessage) throw new Error("Support request transcript has no requester message");

        await tx.insert(supportEvents).values({
          requestId: created.id,
          eventType: "request.created",
          actorType: "requester",
          actorId: session.id,
          toValue: {
            status: created.status,
            messageId: sourceMessage.id,
            messageCount: messageRows.length,
            conversationCaptured: input.conversation.length > 0,
            callbackRequested: input.callbackRequested,
          },
          correlationId,
        });

        if (duplicateCandidate) {
          await tx.insert(supportEvents).values({
            requestId: created.id,
            eventType: "request.duplicate_suspected",
            actorType: "system",
            toValue: {
              candidateRequestId: duplicateCandidate.id,
              reason: "same_contact_category_7_days",
            },
            correlationId,
          });
        }

        if (input.callbackRequested && phoneContact) {
          await tx.insert(supportCallbackTasks).values({
            requestId: created.id,
            phoneContactId: phoneContact.id,
            dueAt: new Date(),
          });
          await tx.insert(supportEvents).values({
            requestId: created.id,
            eventType: "callback.requested",
            actorType: "requester",
            actorId: session.id,
            toValue: { phoneContactId: phoneContact.id },
            correlationId,
          });
        }

        await tx
          .insert(supportSessionRequests)
          .values({ sessionId: session.id, requestId: created.id });

        if (emailContact) {
          await tx.insert(supportMagicTokens).values({
            requestId: created.id,
            contactId: emailContact.id,
            tokenHash: sha256(rawAccessToken),
            purpose: "support_access",
            expiresAt: new Date(Date.now() + SUPPORT_MAGIC_TOKEN_MINUTES * 60 * 1000),
          });

          await tx.execute(sql`
            select pgmq.send(
              'support_jobs',
              jsonb_build_object(
                'job_id', ${requesterJobId}::uuid,
                'job_type', 'notify_requester_request_created',
                'institution_id', ${institution.id}::uuid,
                'request_id', ${created.id}::uuid,
                'message_id', ${sourceMessage.id}::uuid,
                'contact_id', ${emailContact.id}::uuid,
                'access_token', ${rawAccessToken}::text,
                'idempotency_key', ${`requester-request-created:${created.id}`}::text,
                'attempt', 0
              )
            )
          `);
        }

        await tx.execute(sql`
          select pgmq.send(
            'support_jobs',
            jsonb_build_object(
              'job_id', ${agentJobId}::uuid,
              'job_type', 'notify_agent_request_created',
              'institution_id', ${institution.id}::uuid,
              'request_id', ${created.id}::uuid,
              'message_id', ${sourceMessage.id}::uuid,
              'idempotency_key', ${`agent-request-created:${created.id}`}::text,
              'attempt', 0
            )
          )
        `);

        return { ...created, sessionToken: session.rawToken, duplicate: false };
      });

      if (result.sessionToken) setSupportSessionCookie(res, result.sessionToken);
      res.status(result.duplicate ? 200 : 201);
      return {
        request: {
          publicCode: result.publicCode,
          status: result.status,
          createdAt: result.createdAt,
        },
        duplicate: result.duplicate,
      };
    });
  }

  if (req.method === "GET") {
    return handleApi(res, async () => {
      const token = readSupportSessionToken(req);
      if (!token) return { requests: [] };
      const institution = await requireConfiguredInstitution();

      const requests = await db
        .select({
          publicCode: supportRequests.publicCode,
          subject: supportRequests.subject,
          category: supportRequests.category,
          status: supportRequests.status,
          priority: supportRequests.priority,
          createdAt: supportRequests.createdAt,
          updatedAt: supportRequests.updatedAt,
        })
        .from(supportDeviceSessions)
        .innerJoin(
          supportSessionRequests,
          eq(supportSessionRequests.sessionId, supportDeviceSessions.id)
        )
        .innerJoin(supportRequests, eq(supportRequests.id, supportSessionRequests.requestId))
        .where(
          and(
            eq(supportDeviceSessions.sessionHash, sha256(token)),
            gt(supportDeviceSessions.expiresAt, new Date()),
            isNull(supportDeviceSessions.revokedAt),
            eq(supportRequests.institutionId, institution.id)
          )
        )
        .orderBy(desc(supportRequests.createdAt));

      return { requests };
    });
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}

export const config = { api: { bodyParser: { sizeLimit: "64kb" } } };
