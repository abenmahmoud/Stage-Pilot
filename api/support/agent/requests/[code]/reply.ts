import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  supportAttachments,
  supportCallbackTasks,
  supportContacts,
  supportEvents,
  supportMagicTokens,
  supportMessages,
  supportRequests,
} from "../../../../../db/schema.js";
import { HttpError } from "../../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";
import {
  assertNoForbiddenSupportSecret,
  idempotencyKey,
  opaqueToken,
  sha256,
  SUPPORT_MAGIC_TOKEN_MINUTES,
} from "../../../../_shared/support.js";
import {
  assertSupportRequestAccess,
  requireSupportAgent,
} from "../../../../_shared/support-agent-access.js";
import { enforceAgentWriteRateLimit } from "../../../../_shared/support-rate-limits.js";
import {
  formatSupportRevision,
  parseSupportRevision,
  supportRevisionMatches,
} from "../../../../../shared/support-concurrency.js";
import {
  SUPPORT_IDENTITY_VERIFICATION_MESSAGE,
  normalizeSupportReplyText,
  supportTranslationTargetLanguage,
} from "../../../../../shared/support-reply-policy.js";
import {
  SupportTranslationFailure,
  verifySupportTranslationReceipt,
} from "../../../../_shared/support-translation.js";
import { createSupportAgentReplyConfirmation } from "../../../../../shared/support-agent-reply-confirmation.js";
import {
  isSupportAgentReplyInput,
  singleSupportAgentRouteValue,
} from "../../../../../shared/support-agent-mutation-input-policy.js";

function sameAttachmentIds(expected: string[], actual: string[]): boolean {
  if (expected.length !== actual.length) return false;
  const expectedSorted = [...expected].sort();
  const actualSorted = [...actual].sort();
  return expectedSorted.every((value, index) => value === actualSorted[index]);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  return handleApi(res, async () => {
    const { user, access, institutionId } = await requireSupportAgent(req);
    const code = singleSupportAgentRouteValue(req.query.code);
    if (!code || !/^BC-\d{4}-\d{6}$/.test(code)) {
      throw new HttpError(400, "Numéro de demande invalide");
    }
    if (!isSupportAgentReplyInput(req.body)) {
      throw new HttpError(400, "Réponse agent invalide");
    }
    const body = req.body;
    let messageText = normalizeSupportReplyText(body.message);
    if (!messageText) throw new HttpError(400, "Message invalide");
    assertNoForbiddenSupportSecret(messageText);
    const rawAttachmentIds = body.attachmentIds ?? [];
    if (!Array.isArray(rawAttachmentIds) || rawAttachmentIds.length > 5) {
      throw new HttpError(400, "La liste des pièces jointes est invalide");
    }
    const attachmentIds = rawAttachmentIds.map((value) => {
      if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) {
        throw new HttpError(400, "Une pièce jointe est invalide");
      }
      return value;
    });
    if (new Set(attachmentIds).size !== attachmentIds.length) {
      throw new HttpError(400, "Une pièce jointe est présente plusieurs fois");
    }
    const idempotencyHash = sha256(idempotencyKey(req));
    const rawAccessToken = opaqueToken();

    const [request] = await db
      .select({
        id: supportRequests.id,
        subject: supportRequests.subject,
        category: supportRequests.category,
        subjectContext: supportRequests.subjectContext,
        assignedTeam: supportRequests.assignedTeam,
        updatedAt: supportRequests.updatedAt,
      })
      .from(supportRequests)
      .where(and(
        eq(supportRequests.institutionId, institutionId),
        eq(supportRequests.publicCode, code)
      ))
      .limit(1);
    if (!request) throw new HttpError(404, "Demande introuvable");
    assertSupportRequestAccess(access, request.assignedTeam);
    const [existingReply] = await db
      .select({
        id: supportMessages.id,
        requestId: supportMessages.requestId,
        createdAt: supportMessages.createdAt,
        channel: supportMessages.channel,
        bodyText: supportMessages.bodyText,
      })
      .from(supportMessages)
      .where(and(
        eq(supportMessages.requestId, request.id),
        eq(supportMessages.clientIdempotencyKeyHash, idempotencyHash)
      ))
      .limit(1);
    if (existingReply) {
      const existingAttachments = await db
        .select({ id: supportAttachments.id })
        .from(supportAttachments)
        .where(and(
          eq(supportAttachments.requestId, request.id),
          eq(supportAttachments.messageId, existingReply.id)
        ));
      const [existingEvent] = await db
        .select({
          createdAt: supportEvents.createdAt,
          correlationId: supportEvents.correlationId,
        })
        .from(supportEvents)
        .where(and(
          eq(supportEvents.requestId, request.id),
          eq(
            supportEvents.eventType,
            existingReply.channel === "email" ? "reply.queued" : "callback.created"
          ),
          sql`${supportEvents.toValue}->>'messageId' = ${existingReply.id}`
        ))
        .orderBy(desc(supportEvents.createdAt))
        .limit(1);
      if (
        existingReply.requestId !== request.id
        || !["email", "phone"].includes(existingReply.channel)
        || existingReply.bodyText !== messageText
        || !sameAttachmentIds(attachmentIds, existingAttachments.map((attachment) => attachment.id))
      ) {
        throw new HttpError(409, "Cette clé d’envoi a déjà été utilisée pour un autre dossier");
      }
      if (!existingEvent?.correlationId) {
        throw new HttpError(409, "La réponse enregistrée n'a pas de confirmation exploitable");
      }
      res.status(200);
      return {
        confirmation: createSupportAgentReplyConfirmation({
          publicCode: code,
          messageId: existingReply.id,
          channel: existingReply.channel === "email" ? "email" : "phone",
          duplicate: true,
          messageCreatedAt: existingReply.createdAt,
          confirmedAt: existingEvent.createdAt,
          correlationId: existingEvent.correlationId,
        }),
      };
    }
    await enforceAgentWriteRateLimit(user.id);
    const expectedRevision = parseSupportRevision(body.expectedUpdatedAt);
    if (!expectedRevision) {
      throw new HttpError(400, "La version du dossier est requise");
    }
    if (!supportRevisionMatches(request.updatedAt, expectedRevision)) {
      throw new HttpError(409, "Ce dossier a été modifié par un autre agent. Il vient d’être actualisé.");
    }
    const identityContext = (request.subjectContext ?? {}) as Record<string, unknown>;
    let translatedReply: { sourceMessage: string; targetLanguage: string } | null = null;
    if (body.translation !== undefined) {
      if (!body.translation || typeof body.translation !== "object" || Array.isArray(body.translation)) {
        throw new HttpError(400, "Validation de traduction invalide");
      }
      const translation = body.translation as Record<string, unknown>;
      const sourceMessage = normalizeSupportReplyText(translation.sourceMessage, 5_000);
      const targetLanguage = supportTranslationTargetLanguage(translation.targetLanguage);
      if (
        translation.validated !== true
        || typeof translation.receipt !== "string"
        || translation.receipt.length > 2_000
        || !sourceMessage
        || !targetLanguage
      ) {
        throw new HttpError(400, "La traduction doit être vérifiée avant l’envoi");
      }
      assertNoForbiddenSupportSecret(sourceMessage);
      let validReceipt = false;
      try {
        validReceipt = verifySupportTranslationReceipt({
          receipt: translation.receipt,
          requestId: request.id,
          userId: user.id,
          sourceMessage,
          translatedMessage: messageText,
          targetLanguage,
        });
      } catch (error) {
        if (error instanceof SupportTranslationFailure && error.code === "not_configured") {
          throw new HttpError(503, error.message);
        }
        throw error;
      }
      if (!validReceipt) {
        throw new HttpError(409, "La traduction a expiré ou a été modifiée. Préparez-la de nouveau.");
      }
      translatedReply = { sourceMessage, targetLanguage };
    }
    if (
      ["ent", "email_academique"].includes(request.category) &&
      identityContext.identityStatus !== "identite_confirmee"
    ) {
      if (attachmentIds.length > 0) {
        throw new HttpError(409, "Aucun document ne peut être transmis avant la confirmation d’identité");
      }
      if (body.safeTemplate !== "identity_verification") {
        throw new HttpError(409, "Avant la confirmation d’identité, utilisez uniquement le message sécurisé de vérification");
      }
      if (translatedReply) {
        if (translatedReply.sourceMessage !== SUPPORT_IDENTITY_VERIFICATION_MESSAGE) {
          throw new HttpError(409, "Seule la traduction du message sécurisé peut être envoyée avant la confirmation d’identité");
        }
      } else {
        messageText = SUPPORT_IDENTITY_VERIFICATION_MESSAGE;
      }
    }
    const contacts = await db
      .select({ id: supportContacts.id, channel: supportContacts.channel })
      .from(supportContacts)
      .where(
        and(
          eq(supportContacts.requestId, request.id),
          eq(supportContacts.usageScope, "support"),
          isNull(supportContacts.disabledAt)
        )
      );
    const email = contacts.find((contact) => contact.channel === "email");
    const phone = contacts.find((contact) => contact.channel === "phone");
    if (!email && !phone) throw new HttpError(409, "Aucun moyen de réponse n'est disponible");

    const correlationId = randomUUID();
    const jobId = randomUUID();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`
        select pg_advisory_xact_lock(hashtextextended(${request.id}::text, 0))
      `);
      const [created] = await tx
        .insert(supportMessages)
        .values({
          requestId: request.id,
          direction: "outbound",
          channel: email ? "email" : "phone",
          authorUserId: user.id,
          authorLabel: "Équipe du lycée",
          bodyText: messageText,
          clientIdempotencyKeyHash: idempotencyHash,
          deliveryStatus: email ? "queued" : "callback_required",
          validatedBy: user.id,
          validatedAt: new Date(),
        })
        .onConflictDoNothing({
          target: [supportMessages.requestId, supportMessages.clientIdempotencyKeyHash],
        })
        .returning({ id: supportMessages.id, createdAt: supportMessages.createdAt });
      if (!created) {
        const [existing] = await tx
          .select({
            id: supportMessages.id,
            requestId: supportMessages.requestId,
            createdAt: supportMessages.createdAt,
            channel: supportMessages.channel,
            bodyText: supportMessages.bodyText,
          })
          .from(supportMessages)
          .where(and(
            eq(supportMessages.requestId, request.id),
            eq(supportMessages.clientIdempotencyKeyHash, idempotencyHash)
          ))
          .limit(1);
        if (!existing) throw new Error("Idempotent agent reply could not be recovered");
        const existingAttachments = await tx
          .select({ id: supportAttachments.id })
          .from(supportAttachments)
          .where(and(
            eq(supportAttachments.requestId, request.id),
            eq(supportAttachments.messageId, existing.id)
          ));
        const [existingEvent] = await tx
          .select({
            createdAt: supportEvents.createdAt,
            correlationId: supportEvents.correlationId,
          })
          .from(supportEvents)
          .where(and(
            eq(supportEvents.requestId, request.id),
            eq(
              supportEvents.eventType,
              existing.channel === "email" ? "reply.queued" : "callback.created"
            ),
            sql`${supportEvents.toValue}->>'messageId' = ${existing.id}`
          ))
          .orderBy(desc(supportEvents.createdAt))
          .limit(1);
        if (
          existing.requestId !== request.id
          || existing.channel !== (email ? "email" : "phone")
          || existing.bodyText !== messageText
          || !sameAttachmentIds(attachmentIds, existingAttachments.map((attachment) => attachment.id))
        ) {
          throw new HttpError(409, "Cette clé d’envoi a déjà été utilisée pour un autre dossier");
        }
        if (!existingEvent?.correlationId) {
          throw new HttpError(409, "La réponse enregistrée n'a pas de confirmation exploitable");
        }
        return {
          ...existing,
          duplicate: true,
          channel: email ? "email" as const : "phone" as const,
          attachmentCount: existingAttachments.length,
          confirmedAt: existingEvent.createdAt,
          correlationId: existingEvent.correlationId,
        };
      }

      if (attachmentIds.length > 0) {
        const releasedAttachments = await tx
          .update(supportAttachments)
          .set({
            messageId: created.id,
            releasedAt: new Date(),
            releasedBy: user.id,
          })
          .where(and(
            eq(supportAttachments.requestId, request.id),
            inArray(supportAttachments.id, attachmentIds),
            eq(supportAttachments.direction, "agent"),
            eq(supportAttachments.uploadedByUser, user.id),
            eq(supportAttachments.scanStatus, "clean"),
            isNull(supportAttachments.messageId),
            isNull(supportAttachments.releasedAt)
          ))
          .returning({ id: supportAttachments.id });
        if (releasedAttachments.length !== attachmentIds.length) {
          throw new HttpError(409, "Un document n’est pas vérifié, n’appartient pas à ce dossier ou a déjà été envoyé");
        }
      }

      let callbackId: string | null = null;
      if (email) {
        await tx.insert(supportMagicTokens).values({
          requestId: request.id,
          contactId: email.id,
          tokenHash: sha256(rawAccessToken),
          purpose: "support_access",
          expiresAt: new Date(Date.now() + SUPPORT_MAGIC_TOKEN_MINUTES * 60 * 1000),
        });
        await tx.execute(sql`
          select pgmq.send(
            'support_jobs',
            jsonb_build_object(
              'job_id', ${jobId}::uuid,
              'job_type', 'send_requester_reply',
              'institution_id', ${institutionId}::uuid,
              'request_id', ${request.id}::uuid,
              'message_id', ${created.id}::uuid,
              'contact_id', ${email.id}::uuid,
              'access_token', ${rawAccessToken}::text,
              'idempotency_key', ${`requester-reply:${created.id}`}::text,
              'attempt', 0
            )
          )
        `);
      } else if (phone) {
        const [activeCallback] = await tx
          .select({ id: supportCallbackTasks.id })
          .from(supportCallbackTasks)
          .where(
            and(
              eq(supportCallbackTasks.requestId, request.id),
              eq(supportCallbackTasks.phoneContactId, phone.id),
              inArray(supportCallbackTasks.status, ["todo", "in_progress"])
            )
          )
          .limit(1);
        if (activeCallback) {
          callbackId = activeCallback.id;
        } else {
          const [createdCallback] = await tx.insert(supportCallbackTasks).values({
            requestId: request.id,
            phoneContactId: phone.id,
            assignedTo: user.id,
            status: "in_progress",
            dueAt: new Date(),
          }).returning({ id: supportCallbackTasks.id });
          callbackId = createdCallback?.id ?? null;
          if (!callbackId) {
            throw new HttpError(409, "Le rappel n'a pas pu être confirmé");
          }
        }
      }

      const teamCondition = request.assignedTeam === null
        ? isNull(supportRequests.assignedTeam)
        : eq(supportRequests.assignedTeam, request.assignedTeam);
      const [updatedRequest] = await tx
        .update(supportRequests)
        .set({ status: "attente_demandeur", assignedTo: user.id })
        .where(
          and(
            eq(supportRequests.institutionId, institutionId),
            eq(supportRequests.id, request.id),
            sql`date_trunc('milliseconds', ${supportRequests.updatedAt}) = ${formatSupportRevision(expectedRevision)}::timestamptz`,
            teamCondition
          )
        )
        .returning({ id: supportRequests.id });
      if (!updatedRequest) {
        throw new HttpError(409, "Ce dossier a été modifié ou transféré par un autre agent. Il vient d’être actualisé.");
      }
      const [replyEvent] = await tx.insert(supportEvents).values({
        requestId: request.id,
        eventType: email ? "reply.queued" : "callback.created",
        actorType: "agent",
        actorId: user.id,
        toValue: {
          messageId: created.id,
          callbackId,
          channel: email ? "email" : "phone",
          translated: Boolean(translatedReply),
          targetLanguage: translatedReply?.targetLanguage ?? null,
          translationHumanValidated: Boolean(translatedReply),
          attachmentCount: attachmentIds.length,
        },
        correlationId,
      }).returning({ createdAt: supportEvents.createdAt });
      if (!replyEvent) {
        throw new HttpError(409, "La réponse n'a pas été confirmée par le journal du dossier");
      }
      return {
        ...created,
        duplicate: false,
        channel: email ? "email" as const : "phone" as const,
        attachmentCount: attachmentIds.length,
        confirmedAt: replyEvent.createdAt,
        correlationId,
      };
    });

    res.status(result.duplicate ? 200 : 201);
    return {
      confirmation: createSupportAgentReplyConfirmation({
        publicCode: code,
        messageId: result.id,
        channel: result.channel,
        duplicate: result.duplicate,
        messageCreatedAt: result.createdAt,
        confirmedAt: result.confirmedAt,
        correlationId: result.correlationId,
      }),
    };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "24kb" } } };
