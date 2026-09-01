import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { initialSupportStatus } from "../../../shared/support-routing.js";
import { supportDuplicateWindowStart } from "../../../shared/support-duplicate-policy.js";
import { createSupportRequestPersistenceConfirmation } from "../../../shared/support-request-confirmation.js";
import {
  supportAgentCreateRequestActionEnabled,
  supportAssistantRoutingReviewEnabled,
  verifySupportAssistantRoutingReceipt,
} from "../../../shared/support-assistant-routing-receipt.js";
import {
  supportAssistantRoutingReviews,
  supportContacts,
  supportCallbackTasks,
  supportDeviceSessions,
  supportEvents,
  supportMessages,
  supportRequests,
  supportSessionRequests,
} from "../../../db/schema.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { HttpError } from "../../_shared/auth.js";
import { supportSessionContactPredicate } from "../../_shared/support-session-contact.js";
import {
  completeSupportCreateRequestAction,
  startSupportCreateRequestAction,
} from "../../_shared/support-create-request-action.js";
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
import { SUPPORT_PUBLIC_LIST_LIMITS } from "../../../shared/support-public-list-payload-policy.js";
import { supportNormalizationProvenance } from "../../_shared/support-normalization.js";

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
      const routingReviewEnabled = supportAssistantRoutingReviewEnabled();
      const createRequestActionEnabled = supportAgentCreateRequestActionEnabled();
      const verifiedRoutingReceipt = (routingReviewEnabled || createRequestActionEnabled)
        ? verifySupportAssistantRoutingReceipt({
            receipt: input.assistantRoutingReceipt,
            institutionId: institution.id,
            category: input.category,
            service: input.routing.service,
            expectedRequesterRefHash: deviceKey,
            secret: process.env.SUPPORT_HASH_SECRET,
          })
        : null;
      input.subjectContext = {
        ...input.subjectContext,
        ...supportNormalizationProvenance({
          request: input,
          receipt: input.assistantNormalizationReceipt,
          institutionId: institution.id,
          requesterRefHash: deviceKey,
          secret: process.env.SUPPORT_HASH_SECRET,
        }),
      };
      if (
        input.assistantRoutingReceipt
        && (routingReviewEnabled || createRequestActionEnabled)
        && !verifiedRoutingReceipt
      ) {
        throw new HttpError(
          400,
          "La préparation de l’assistant a expiré ou ne correspond plus à cette demande."
        );
      }
      const actionGrant = createRequestActionEnabled
        ? verifiedRoutingReceipt?.actionGrant ?? null
        : null;
      const routingReviewReceipt = routingReviewEnabled ? verifiedRoutingReceipt : null;
      const idempotencyHash = sha256(idempotencyKey(req));
      const correlationId = randomUUID();
      const requesterJobId = randomUUID();
      const agentJobId = randomUUID();
      const rawAccessToken = opaqueToken();
      const accessTokenExpiresAt = new Date(
        Date.now() + SUPPORT_MAGIC_TOKEN_MINUTES * 60 * 1000
      ).toISOString();

      const result = await db.transaction(async (tx) => {
        const session = await getOrCreateDeviceSession(tx, req);
        const createRequestAction = actionGrant
          ? await startSupportCreateRequestAction({
              tx,
              institutionId: institution.id,
              grant: actionGrant,
              supportInput: input,
              requesterRefHash: deviceKey ?? "",
              requestIdempotencyHash: idempotencyHash,
            })
          : null;
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
            // A service deadline must come from a validated local policy. Until
            // that policy exists, a new request must not receive an invented SLA.
            slaDueAt: null,
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
            .innerJoin(
              supportSessionRequests,
              eq(supportSessionRequests.requestId, supportRequests.id)
            )
            .where(and(
              eq(supportRequests.institutionId, institution.id),
              eq(supportRequests.idempotencyKeyHash, idempotencyHash),
              eq(supportSessionRequests.sessionId, session.id)
            ))
            .limit(1);
          // Idempotency prevents duplicate writes; it must never grant access.
          if (!racedRequest) {
            throw new HttpError(409, "Cet envoi ne peut pas être repris depuis cet appareil. Ouvrez le suivi déjà enregistré ou le lien reçu par email. Si vous ne les retrouvez pas, contactez le lycée.");
          }
          const agentAction = createRequestAction
            ? await completeSupportCreateRequestAction({
                tx,
                action: createRequestAction,
                request: racedRequest,
                duplicate: true,
              })
            : null;
          return { ...racedRequest, sessionToken: session.rawToken, duplicate: true, agentAction };
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

        const [attachedRoutingReview] = routingReviewReceipt
          ? await tx
              .insert(supportAssistantRoutingReviews)
              .values({
                institutionId: institution.id,
                requestId: created.id,
                receiptHash: routingReviewReceipt.receiptHash,
                usedAi: routingReviewReceipt.usedAi,
                model: routingReviewReceipt.model,
                initialCategory: input.category,
                initialService: input.routing.service,
              })
              .onConflictDoNothing()
              .returning({ id: supportAssistantRoutingReviews.id })
          : [];

        await tx.execute(sql`
          with inserted_event as (
            insert into public.support_events (
              request_id,
              event_type,
              actor_type,
              actor_id,
              to_value,
              correlation_id
            ) values (
              ${created.id}::uuid,
              'request.created',
              'requester',
              ${session.id}::text,
              jsonb_build_object(
                'status', ${created.status}::text,
                'messageId', ${sourceMessage.id}::uuid,
                'messageCount', ${messageRows.length}::integer,
                'conversationCaptured', ${input.conversation.length > 0}::boolean,
                'callbackRequested', ${input.callbackRequested}::boolean,
                'assistantRoutingAttached', ${Boolean(attachedRoutingReview)}::boolean
              ),
              ${correlationId}::uuid
            )
            returning id
          )
          insert into public.support_session_requests (session_id, request_id)
          select ${session.id}::uuid, ${created.id}::uuid
          from inserted_event
        `);

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

        if (emailContact) {
          await tx.execute(sql`
            with inserted_magic_token as (
              insert into public.support_magic_tokens (
                request_id,
                contact_id,
                token_hash,
                purpose,
                expires_at
              ) values (
                ${created.id}::uuid,
                ${emailContact.id}::uuid,
                ${sha256(rawAccessToken)}::text,
                'support_access',
                ${accessTokenExpiresAt}::timestamptz
              )
              returning id
            )
            select
              pgmq.send(
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
              ) as requester_job_id,
              pgmq.send(
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
              ) as agent_job_id
            from inserted_magic_token
          `);
        } else {
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
        }

        const agentAction = createRequestAction
          ? await completeSupportCreateRequestAction({
              tx,
              action: createRequestAction,
              request: created,
              duplicate: false,
            })
          : null;
        return { ...created, sessionToken: session.rawToken, duplicate: false, agentAction };
      });

      if (result.sessionToken) setSupportSessionCookie(res, result.sessionToken);
      const confirmation = createSupportRequestPersistenceConfirmation({
        publicCode: result.publicCode,
        confirmedAt: new Date(),
      });
      res.status(result.duplicate ? 200 : 201);
      return {
        request: {
          publicCode: result.publicCode,
          status: result.status,
          createdAt: result.createdAt,
        },
        confirmation,
        agentAction: result.agentAction,
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
        .leftJoin(supportContacts, eq(supportContacts.id, supportDeviceSessions.accessContactId))
        .where(
          and(
            eq(supportDeviceSessions.sessionHash, sha256(token)),
            gt(supportDeviceSessions.expiresAt, new Date()),
            isNull(supportDeviceSessions.revokedAt),
            eq(supportRequests.institutionId, institution.id),
            supportSessionContactPredicate()
          )
        )
        .orderBy(desc(supportRequests.createdAt))
        .limit(SUPPORT_PUBLIC_LIST_LIMITS.requests + 1);

      if (requests.length > SUPPORT_PUBLIC_LIST_LIMITS.requests) {
        throw new HttpError(
          409,
          "Trop de demandes sont liées à cet appareil pour afficher une liste complète. Aucune liste partielle n’a été affichée."
        );
      }

      return { requests };
    });
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}

export const config = { api: { bodyParser: { sizeLimit: "64kb" } } };
