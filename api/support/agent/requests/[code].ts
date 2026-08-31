import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  supportAttachments,
  supportAssistantRoutingReviews,
  supportCallbackTasks,
  supportContacts,
  supportEvents,
  supportMessages,
  supportRequests,
} from "../../../../db/schema.js";
import { HttpError, requireAal2 } from "../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";
import {
  assertSupportRequestAccess,
  assertSupportTransferAccess,
  requireSupportAgent,
} from "../../../_shared/support-agent-access.js";
import { enforceAgentWriteRateLimit } from "../../../_shared/support-rate-limits.js";
import {
  formatSupportRevision,
  parseSupportRevision,
  supportRevisionMatches,
} from "../../../../shared/support-concurrency.js";
import {
  deriveSupportDuplicateReview,
  SUPPORT_DUPLICATE_EVENT_TYPES,
} from "../../../../shared/support-duplicate-policy.js";
import { supportAssistantRoutingReviewEnabled } from "../../../../shared/support-assistant-routing-receipt.js";
import { createSupportRequestMutationConfirmation } from "../../../../shared/support-request-mutation-confirmation.js";
import { SUPPORT_AGENT_DETAIL_LIMITS } from "../../../../shared/support-agent-detail-payload-policy.js";

const STATUSES = new Set([
  "nouveau",
  "a_qualifier",
  "assigne",
  "en_cours",
  "attente_demandeur",
  "attente_interne",
  "resolu",
  "clos",
  "indesirable",
]);
const PRIORITIES = new Set(["p1", "p2", "p3", "p4"]);
const ASSIGNED_TEAMS = new Set([
  "referent_numerique",
  "ddfpt",
  "secretariat",
  "vie_scolaire",
  "intendance",
  "direction",
  "administration",
]);
const IDENTITY_STATUSES = new Set(["non_verifiee", "contact_verifie", "identite_confirmee"]);
const IDENTITY_METHODS = new Set(["email_magic_link", "phone_callback", "official_roster"]);
const SENSITIVE_CATEGORIES = new Set(["ent", "email_academique"]);

function publicCode(req: VercelRequest): string {
  const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
  if (!code || !/^BC-\d{4}-\d{6}$/.test(code)) {
    throw new HttpError(400, "Numéro de demande invalide");
  }
  return code;
}

function assertCompleteSupportDetailCollection(
  rowCount: number,
  limit: number,
  label: string
): void {
  if (rowCount > limit) {
    throw new HttpError(
      409,
      `Le dossier contient trop de ${label} pour un chargement complet. Aucun historique partiel n’a été affiché.`
    );
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!req.method || !["GET", "PATCH"].includes(req.method)) {
    return methodNotAllowed(res, ["GET", "PATCH"]);
  }

  return handleApi(res, async () => {
    const { user, access, institutionId } = await requireSupportAgent(req);
    const routingReviewEnabled = supportAssistantRoutingReviewEnabled();
    const code = publicCode(req);
    const [request] = await db
      .select()
      .from(supportRequests)
      .where(and(
        eq(supportRequests.institutionId, institutionId),
        eq(supportRequests.publicCode, code)
      ))
      .limit(1);
    if (!request) throw new HttpError(404, "Demande introuvable");
    assertSupportRequestAccess(access, request.assignedTeam);

    if (req.method === "PATCH") {
      await enforceAgentWriteRateLimit(user.id);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const expectedRevision = parseSupportRevision(body.expectedUpdatedAt);
      if (!expectedRevision) {
        throw new HttpError(400, "La version du dossier est requise");
      }
      if (!supportRevisionMatches(request.updatedAt, expectedRevision)) {
        throw new HttpError(409, "Ce dossier a été modifié par un autre agent. Il vient d’être actualisé.");
      }
      if (
        body.assignToMe === true &&
        request.assignedTo !== null &&
        request.assignedTo !== user.id
      ) {
        throw new HttpError(409, "Cette demande est déjà prise en charge par un autre agent");
      }
      const currentContext = (request.subjectContext ?? {}) as Record<string, unknown>;
      const currentIdentityStatus = typeof currentContext.identityStatus === "string" && IDENTITY_STATUSES.has(currentContext.identityStatus)
        ? currentContext.identityStatus
        : "non_verifiee";
      const nextStatus = typeof body.status === "string" ? body.status : request.status;
      const nextPriority = typeof body.priority === "string" ? body.priority : request.priority;
      const nextIdentityStatus = typeof body.identityStatus === "string" ? body.identityStatus : currentIdentityStatus;
      const nextAssignedTeam = body.assignedTeam === undefined
        ? request.assignedTeam
        : body.assignedTeam === null || body.assignedTeam === ""
          ? null
          : typeof body.assignedTeam === "string"
            ? body.assignedTeam
            : request.assignedTeam;
      const duplicateDecision = body.duplicateDecision === undefined
        ? null
        : body.duplicateDecision === "confirmed" || body.duplicateDecision === "dismissed"
          ? body.duplicateDecision
          : "invalid";
      const routingDecision = body.routingDecision === undefined
        ? null
        : body.routingDecision === "confirmed"
          ? body.routingDecision
          : "invalid";
      if (!STATUSES.has(nextStatus)) throw new HttpError(400, "Statut invalide");
      if (!PRIORITIES.has(nextPriority)) throw new HttpError(400, "Priorité invalide");
      if (!IDENTITY_STATUSES.has(nextIdentityStatus)) throw new HttpError(400, "Niveau de vérification invalide");
      if (duplicateDecision === "invalid") throw new HttpError(400, "Décision de doublon invalide");
      if (routingDecision === "invalid") throw new HttpError(400, "Décision de classement invalide");
      if (routingDecision === "confirmed" && !routingReviewEnabled) {
        throw new HttpError(503, "La validation du classement n’est pas encore activée");
      }
      if (
        body.assignedTeam !== undefined &&
        body.assignedTeam !== null &&
        typeof body.assignedTeam !== "string"
      ) {
        throw new HttpError(400, "Service destinataire invalide");
      }
      if (nextAssignedTeam && !ASSIGNED_TEAMS.has(nextAssignedTeam)) {
        throw new HttpError(400, "Service destinataire invalide");
      }
      if (body.assignedTeam !== undefined) {
        assertSupportTransferAccess(access, request.assignedTeam, nextAssignedTeam);
      }
      if (routingDecision === "confirmed") {
        await requireAal2(req);
      }

      const currentClosureReason = typeof currentContext.closureReason === "string"
        ? currentContext.closureReason
        : null;
      const closingNow = nextStatus === "clos" && request.status !== "clos";
      let closureReason = currentClosureReason;
      if (closingNow || (nextStatus === "clos" && !closureReason)) {
        if (typeof body.closureReason !== "string") {
          throw new HttpError(400, "Indiquez le motif de clôture");
        }
        closureReason = body.closureReason
          .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
          .trim();
        if (!closureReason || closureReason.length > 500) {
          throw new HttpError(400, "Le motif de clôture est invalide");
        }
      }

      const requestedIdentityMethod = typeof body.identityMethod === "string" ? body.identityMethod : typeof currentContext.identityMethod === "string" ? currentContext.identityMethod : null;
      const nextIdentityMethod = nextIdentityStatus === "non_verifiee" ? null : requestedIdentityMethod;
      if (nextIdentityMethod && !IDENTITY_METHODS.has(nextIdentityMethod)) {
        throw new HttpError(400, "Méthode de vérification invalide");
      }
      if (nextIdentityStatus !== "non_verifiee" && !nextIdentityMethod) {
        throw new HttpError(400, "Indiquez la méthode de vérification");
      }
      if (
        nextIdentityStatus === "contact_verifie" &&
        nextIdentityMethod === "email_magic_link"
      ) {
        const [verifiedEmail] = await db
          .select({ id: supportContacts.id })
          .from(supportContacts)
          .where(
            and(
              eq(supportContacts.requestId, request.id),
              eq(supportContacts.channel, "email"),
              eq(supportContacts.isVerified, true)
            )
          )
          .limit(1);
        if (!verifiedEmail) {
          throw new HttpError(409, "Le lien email doit être utilisé avant de déclarer ce contact vérifié");
        }
      }
      if (
        nextIdentityStatus === "identite_confirmee" &&
        (nextIdentityMethod !== "official_roster" || (!request.studentId && !request.professeurId))
      ) {
        throw new HttpError(409, "Rapprochez d’abord la demande d’un élève ou professeur présent dans une liste officielle");
      }
      if (
        nextIdentityStatus === "identite_confirmee" &&
        currentIdentityStatus !== "identite_confirmee"
      ) {
        await requireAal2(req);
      }
      if (
        SENSITIVE_CATEGORIES.has(request.category) &&
        ["resolu", "clos"].includes(nextStatus) &&
        nextIdentityStatus !== "identite_confirmee"
      ) {
        throw new HttpError(409, "Confirmez l’identité avec une liste officielle avant de résoudre cette demande sensible");
      }

      const now = new Date();
      const duplicateEvents = duplicateDecision
        ? await db
            .select({
              eventType: supportEvents.eventType,
              toValue: supportEvents.toValue,
              createdAt: supportEvents.createdAt,
            })
            .from(supportEvents)
            .where(and(
              eq(supportEvents.requestId, request.id),
              inArray(supportEvents.eventType, [...SUPPORT_DUPLICATE_EVENT_TYPES])
            ))
            .orderBy(desc(supportEvents.createdAt))
            .limit(10)
        : [];
      const duplicateReview = deriveSupportDuplicateReview(duplicateEvents);
      if (duplicateDecision && !duplicateReview) {
        throw new HttpError(409, "Aucun doublon potentiel n’est associé à ce dossier");
      }
      if (duplicateDecision && duplicateReview) {
        const [candidate] = await db
          .select({ assignedTeam: supportRequests.assignedTeam })
          .from(supportRequests)
          .where(and(
            eq(supportRequests.institutionId, institutionId),
            eq(supportRequests.id, duplicateReview.candidateRequestId)
          ))
          .limit(1);
        if (!candidate) throw new HttpError(409, "Le dossier rapproché n’existe plus");
        assertSupportRequestAccess(access, candidate.assignedTeam);
      }
      const teamChanged = nextAssignedTeam !== request.assignedTeam;
      if (routingDecision === "confirmed" && teamChanged) {
        throw new HttpError(400, "Confirmez le classement sans changer de service, ou transférez la demande pour enregistrer une correction");
      }
      const nextAssignedTo = body.assignToMe === true
        ? user.id
        : teamChanged
          ? null
          : request.assignedTo;
      const identityChanged =
        nextIdentityStatus !== currentIdentityStatus ||
        nextIdentityMethod !== (typeof currentContext.identityMethod === "string" ? currentContext.identityMethod : null);
      const revisionCondition = sql`date_trunc('milliseconds', ${supportRequests.updatedAt}) = ${formatSupportRevision(expectedRevision)}::timestamptz`;
      const updateCondition = body.assignToMe === true && request.assignedTo === null
        ? and(
            eq(supportRequests.institutionId, institutionId),
            eq(supportRequests.id, request.id),
            revisionCondition,
            isNull(supportRequests.assignedTo)
          )
        : and(
            eq(supportRequests.institutionId, institutionId),
            eq(supportRequests.id, request.id),
            revisionCondition
          );
      const mutationResult = await db.transaction(async (tx) => {
        const [pendingRoutingReview] = routingReviewEnabled
          ? await tx
              .select({
                id: supportAssistantRoutingReviews.id,
                initialCategory: supportAssistantRoutingReviews.initialCategory,
                initialService: supportAssistantRoutingReviews.initialService,
                usedAi: supportAssistantRoutingReviews.usedAi,
              })
              .from(supportAssistantRoutingReviews)
              .where(and(
                eq(supportAssistantRoutingReviews.institutionId, institutionId),
                eq(supportAssistantRoutingReviews.requestId, request.id),
                eq(supportAssistantRoutingReviews.status, "pending")
              ))
              .limit(1)
          : [];
        if (routingDecision === "confirmed" && !pendingRoutingReview) {
          throw new HttpError(409, "Ce classement a déjà été traité ou n’est plus disponible");
        }
        const [saved] = await tx
          .update(supportRequests)
          .set({
            status: nextStatus,
            priority: nextPriority,
            subjectContext: {
              ...currentContext,
              identityStatus: nextIdentityStatus,
              identityMethod: nextIdentityMethod,
              identityVerifiedAt: nextIdentityStatus === "non_verifiee"
                ? null
                : identityChanged
                  ? now.toISOString()
                  : currentContext.identityVerifiedAt ?? now.toISOString(),
              identityVerifiedBy: nextIdentityStatus === "non_verifiee"
                ? null
                : identityChanged
                  ? user.id
                  : currentContext.identityVerifiedBy ?? user.id,
              ...(nextStatus === "clos"
                ? {
                    closureReason,
                    closureBy: closingNow ? user.id : currentContext.closureBy,
                    closureAt: closingNow ? now.toISOString() : currentContext.closureAt,
                  }
                : request.status === "clos"
                  ? { reopenedBy: user.id, reopenedAt: now.toISOString() }
                  : {}),
            },
            assignedTo: nextAssignedTo,
            assignedTeam: nextAssignedTeam,
            resolvedAt:
              nextStatus === "resolu" || nextStatus === "clos"
                ? request.resolvedAt ?? now
                : request.resolvedAt,
            closedAt: nextStatus === "clos" ? now : null,
          })
          .where(updateCondition)
          .returning();
        if (!saved) {
          throw new HttpError(409, "Ce dossier a été modifié ou pris en charge par un autre agent. Il vient d’être actualisé.");
        }
        const mutationCorrelationId = randomUUID();
        const [mutationEvent] = await tx.insert(supportEvents).values({
          requestId: request.id,
          eventType: "request.updated",
          actorType: "agent",
          actorId: user.id,
          fromValue: {
            status: request.status,
            priority: request.priority,
            identityStatus: currentIdentityStatus,
            assignedTo: request.assignedTo,
            assignedTeam: request.assignedTeam,
          },
          toValue: {
            status: nextStatus,
            priority: nextPriority,
            identityStatus: nextIdentityStatus,
            identityMethod: nextIdentityMethod,
            assignedTo: saved.assignedTo,
            assignedTeam: saved.assignedTeam,
            closureReason: nextStatus === "clos" ? closureReason : null,
          },
          correlationId: mutationCorrelationId,
        }).returning({ createdAt: supportEvents.createdAt });
        if (!mutationEvent) {
          throw new HttpError(409, "La modification n'a pas été confirmée par le journal du dossier");
        }
        if (duplicateDecision && duplicateReview) {
          await tx.insert(supportEvents).values({
            requestId: request.id,
            eventType: duplicateDecision === "confirmed"
              ? "request.duplicate_confirmed"
              : "request.duplicate_dismissed",
            actorType: "agent",
            actorId: user.id,
            fromValue: { status: duplicateReview.status },
            toValue: {
              status: duplicateDecision,
              candidateRequestId: duplicateReview.candidateRequestId,
              reason: duplicateReview.reason,
            },
            correlationId: randomUUID(),
          });
        }
        if (pendingRoutingReview && (routingDecision === "confirmed" || teamChanged)) {
          const reviewStatus = teamChanged ? "corrected" : "confirmed";
          const [reviewed] = await tx
            .update(supportAssistantRoutingReviews)
            .set({
              status: reviewStatus,
              reviewedBy: user.id,
              reviewedAt: now,
            })
            .where(and(
              eq(supportAssistantRoutingReviews.id, pendingRoutingReview.id),
              eq(supportAssistantRoutingReviews.institutionId, institutionId),
              eq(supportAssistantRoutingReviews.status, "pending")
            ))
            .returning({ id: supportAssistantRoutingReviews.id });
          if (!reviewed) {
            throw new HttpError(409, "Ce classement vient d’être traité par un autre agent");
          }
          await tx.insert(supportEvents).values({
            requestId: request.id,
            eventType: reviewStatus === "confirmed"
              ? "request.routing_confirmed"
              : "request.routing_corrected",
            actorType: "agent",
            actorId: user.id,
            fromValue: {
              category: pendingRoutingReview.initialCategory,
              assignedTeam: pendingRoutingReview.initialService,
              usedAi: pendingRoutingReview.usedAi,
            },
            toValue: {
              category: saved.category,
              assignedTeam: saved.assignedTeam,
              decision: reviewStatus,
            },
            correlationId: randomUUID(),
          });
        }
        return {
          request: saved,
          confirmedAt: mutationEvent.createdAt,
          correlationId: mutationCorrelationId,
        };
      });
      return {
        confirmation: createSupportRequestMutationConfirmation({
          publicCode: code,
          previousRevision: expectedRevision,
          revision: mutationResult.request.updatedAt,
          confirmedAt: mutationResult.confirmedAt,
          correlationId: mutationResult.correlationId,
        }),
      };
    }

    const [contacts, messages, attachments, callbacks, duplicateEvents, routingReviews] = await Promise.all([
      db
        .select({
          id: supportContacts.id,
          channel: supportContacts.channel,
          value: supportContacts.value,
          isPrimary: supportContacts.isPrimary,
          isVerified: supportContacts.isVerified,
        })
        .from(supportContacts)
        .where(and(eq(supportContacts.requestId, request.id), eq(supportContacts.usageScope, "support")))
        .limit(SUPPORT_AGENT_DETAIL_LIMITS.contacts + 1),
      db
        .select({
          id: supportMessages.id,
          direction: supportMessages.direction,
          channel: supportMessages.channel,
          authorLabel: supportMessages.authorLabel,
          bodyText: supportMessages.bodyText,
          deliveryStatus: supportMessages.deliveryStatus,
          createdAt: supportMessages.createdAt,
        })
        .from(supportMessages)
        .where(eq(supportMessages.requestId, request.id))
        .orderBy(asc(supportMessages.createdAt))
        .limit(SUPPORT_AGENT_DETAIL_LIMITS.messages + 1),
      db
        .select({
          id: supportAttachments.id,
          messageId: supportAttachments.messageId,
          direction: supportAttachments.direction,
          originalName: supportAttachments.originalName,
          sizeBytes: supportAttachments.sizeBytes,
          scanStatus: supportAttachments.scanStatus,
          uploadedByUser: supportAttachments.uploadedByUser,
          releasedAt: supportAttachments.releasedAt,
          createdAt: supportAttachments.createdAt,
        })
        .from(supportAttachments)
        .where(eq(supportAttachments.requestId, request.id))
        .limit(SUPPORT_AGENT_DETAIL_LIMITS.attachments + 1),
      db
        .select({
          id: supportCallbackTasks.id,
          phoneContactId: supportCallbackTasks.phoneContactId,
          assignedTo: supportCallbackTasks.assignedTo,
          dueAt: supportCallbackTasks.dueAt,
          status: supportCallbackTasks.status,
          outcome: supportCallbackTasks.outcome,
          completedAt: supportCallbackTasks.completedAt,
          createdAt: supportCallbackTasks.createdAt,
        })
        .from(supportCallbackTasks)
        .where(eq(supportCallbackTasks.requestId, request.id))
        .orderBy(asc(supportCallbackTasks.createdAt))
        .limit(SUPPORT_AGENT_DETAIL_LIMITS.callbacks + 1),
      db
        .select({
          eventType: supportEvents.eventType,
          toValue: supportEvents.toValue,
          createdAt: supportEvents.createdAt,
        })
        .from(supportEvents)
        .where(and(
          eq(supportEvents.requestId, request.id),
          inArray(supportEvents.eventType, [...SUPPORT_DUPLICATE_EVENT_TYPES])
        ))
        .orderBy(desc(supportEvents.createdAt))
        .limit(10),
      routingReviewEnabled
        ? db
            .select({
              status: supportAssistantRoutingReviews.status,
              usedAi: supportAssistantRoutingReviews.usedAi,
              initialCategory: supportAssistantRoutingReviews.initialCategory,
              initialService: supportAssistantRoutingReviews.initialService,
              createdAt: supportAssistantRoutingReviews.createdAt,
              reviewedAt: supportAssistantRoutingReviews.reviewedAt,
            })
            .from(supportAssistantRoutingReviews)
            .where(and(
              eq(supportAssistantRoutingReviews.institutionId, institutionId),
              eq(supportAssistantRoutingReviews.requestId, request.id)
            ))
            .limit(1)
        : Promise.resolve([]),
    ]);

    assertCompleteSupportDetailCollection(
      contacts.length,
      SUPPORT_AGENT_DETAIL_LIMITS.contacts,
      "contacts"
    );
    assertCompleteSupportDetailCollection(
      messages.length,
      SUPPORT_AGENT_DETAIL_LIMITS.messages,
      "messages"
    );
    assertCompleteSupportDetailCollection(
      attachments.length,
      SUPPORT_AGENT_DETAIL_LIMITS.attachments,
      "pièces jointes"
    );
    assertCompleteSupportDetailCollection(
      callbacks.length,
      SUPPORT_AGENT_DETAIL_LIMITS.callbacks,
      "rappels"
    );

    const duplicateReview = deriveSupportDuplicateReview(duplicateEvents);
    const [duplicateCandidate] = duplicateReview
      ? await db
          .select({
            id: supportRequests.id,
            publicCode: supportRequests.publicCode,
            assignedTeam: supportRequests.assignedTeam,
          })
          .from(supportRequests)
          .where(and(
            eq(supportRequests.institutionId, institutionId),
            eq(supportRequests.id, duplicateReview.candidateRequestId)
          ))
          .limit(1)
      : [];
    const canViewDuplicateCandidate = Boolean(
      duplicateCandidate && (
        access.canViewAll ||
        access.serviceCodes.some((serviceCode) => serviceCode === duplicateCandidate.assignedTeam)
      )
    );

    const identityContext = (request.subjectContext ?? {}) as Record<string, unknown>;
    const contextIdentityStatus = typeof identityContext.identityStatus === "string" && IDENTITY_STATUSES.has(identityContext.identityStatus)
      ? identityContext.identityStatus
      : null;
    const identityStatus = contextIdentityStatus === "identite_confirmee"
      ? "identite_confirmee"
      : contextIdentityStatus === "contact_verifie" || contacts.some((contact) => contact.isVerified)
        ? "contact_verifie"
        : "non_verifiee";
    return {
      request: {
        publicCode: request.publicCode,
        requesterType: request.requesterType,
        requesterFirstName: request.requesterFirstName,
        requesterLastName: request.requesterLastName,
        beneficiaryType: request.beneficiaryType,
        beneficiaryFirstName: request.beneficiaryFirstName,
        beneficiaryLastName: request.beneficiaryLastName,
        subjectContext: request.subjectContext,
        category: request.category,
        subject: request.subject,
        description: request.description,
        status: request.status,
        priority: request.priority,
        assignedTo: request.assignedTo,
        assignedTeam: request.assignedTeam,
        slaDueAt: request.slaDueAt,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        identityStatus,
        identityMethod: typeof identityContext.identityMethod === "string" ? identityContext.identityMethod : contacts.some((contact) => contact.isVerified) ? "email_magic_link" : null,
        identityVerifiedAt: typeof identityContext.identityVerifiedAt === "string" ? identityContext.identityVerifiedAt : null,
      },
      contacts,
      messages,
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        messageId: attachment.messageId,
        direction: attachment.direction,
        originalName: attachment.originalName,
        sizeBytes: attachment.sizeBytes,
        scanStatus: attachment.scanStatus,
        releasedAt: attachment.releasedAt,
        createdAt: attachment.createdAt,
        canAttachToReply:
          attachment.direction === "agent"
          && attachment.uploadedByUser === user.id
          && attachment.messageId === null
          && attachment.releasedAt === null
          && attachment.scanStatus === "clean",
        canRemoveDraft:
          attachment.direction === "agent"
          && attachment.uploadedByUser === user.id
          && attachment.messageId === null
          && attachment.releasedAt === null
          && ["clean", "blocked", "scan_error", "removal_pending"].includes(attachment.scanStatus),
      })),
      callbacks: callbacks.map((callback) => ({
        id: callback.id,
        phoneContactId: callback.phoneContactId,
        dueAt: callback.dueAt,
        status: callback.status,
        outcome: callback.outcome,
        completedAt: callback.completedAt,
        createdAt: callback.createdAt,
        assigned: callback.assignedTo !== null,
        assignedToCurrentAgent: callback.assignedTo === user.id,
      })),
      duplicateReview: duplicateReview ? {
        status: duplicateReview.status,
        reason: duplicateReview.reason,
        decidedAt: duplicateReview.decidedAt,
        candidatePublicCode: canViewDuplicateCandidate ? duplicateCandidate?.publicCode ?? null : null,
      } : null,
      routingReview: routingReviews[0] ?? null,
      access,
    };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "8kb" } } };
