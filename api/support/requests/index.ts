import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  supportContacts,
  supportDeviceSessions,
  supportEvents,
  supportMessages,
  supportRequests,
  supportSessionRequests,
} from "../../../db/schema.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import {
  SUPPORT_SESSION_DAYS,
  idempotencyKey,
  opaqueToken,
  parseSupportRequest,
  personalHash,
  readSupportSessionToken,
  requestIpHash,
  setSupportSessionCookie,
  sha256,
} from "../../_shared/support.js";

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
      const input = parseSupportRequest(req.body);
      const idempotencyHash = sha256(idempotencyKey(req));
      const correlationId = randomUUID();
      const jobId = randomUUID();

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
          .where(eq(supportRequests.idempotencyKeyHash, idempotencyHash))
          .limit(1);

        if (existing) {
          await tx
            .insert(supportSessionRequests)
            .values({ sessionId: session.id, requestId: existing.id })
            .onConflictDoNothing();
          return { ...existing, sessionToken: session.rawToken, duplicate: true };
        }

        const [created] = await tx
          .insert(supportRequests)
          .values({
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
            sourceIpHash: requestIpHash(req),
            slaDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          })
          .onConflictDoNothing({ target: supportRequests.idempotencyKeyHash })
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
            .where(eq(supportRequests.idempotencyKeyHash, idempotencyHash))
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

        if (contacts.length > 0) await tx.insert(supportContacts).values(contacts);

        const [message] = await tx
          .insert(supportMessages)
          .values({
            requestId: created.id,
            direction: "inbound",
            channel: "web",
            authorLabel: `${input.requesterFirstName} ${input.requesterLastName}`,
            bodyText: input.description,
          })
          .returning({ id: supportMessages.id });

        await tx.insert(supportEvents).values({
          requestId: created.id,
          eventType: "request.created",
          actorType: "requester",
          actorId: session.id,
          toValue: { status: "nouveau", messageId: message.id },
          correlationId,
        });

        await tx
          .insert(supportSessionRequests)
          .values({ sessionId: session.id, requestId: created.id });

        await tx.execute(sql`
          select pgmq.send(
            'support_jobs',
            jsonb_build_object(
              'job_id', ${jobId},
              'job_type', 'notify_request_created',
              'request_id', ${created.id},
              'message_id', ${message.id},
              'idempotency_key', ${`request-created:${created.id}`},
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
            isNull(supportDeviceSessions.revokedAt)
          )
        )
        .orderBy(desc(supportRequests.createdAt));

      return { requests };
    });
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}

export const config = { api: { bodyParser: { sizeLimit: "64kb" } } };
