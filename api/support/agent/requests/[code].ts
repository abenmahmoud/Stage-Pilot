import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  supportAttachments,
  supportContacts,
  supportEvents,
  supportMessages,
  supportRequests,
} from "../../../../db/schema.js";
import { HttpError } from "../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";
import {
  assertSupportRequestAccess,
  assertSupportTransferAccess,
  requireSupportAgent,
} from "../../../_shared/support-agent-access.js";
import {
  parseSupportRevision,
  supportRevisionMatches,
} from "../../../../shared/support-concurrency.js";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!req.method || !["GET", "PATCH"].includes(req.method)) {
    return methodNotAllowed(res, ["GET", "PATCH"]);
  }

  return handleApi(res, async () => {
    const { user, access } = await requireSupportAgent(req);
    const code = publicCode(req);
    const [request] = await db
      .select()
      .from(supportRequests)
      .where(eq(supportRequests.publicCode, code))
      .limit(1);
    if (!request) throw new HttpError(404, "Demande introuvable");
    assertSupportRequestAccess(access, request.assignedTeam);

    if (req.method === "PATCH") {
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
      if (!STATUSES.has(nextStatus)) throw new HttpError(400, "Statut invalide");
      if (!PRIORITIES.has(nextPriority)) throw new HttpError(400, "Priorité invalide");
      if (!IDENTITY_STATUSES.has(nextIdentityStatus)) throw new HttpError(400, "Niveau de vérification invalide");
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
        SENSITIVE_CATEGORIES.has(request.category) &&
        ["resolu", "clos"].includes(nextStatus) &&
        nextIdentityStatus !== "identite_confirmee"
      ) {
        throw new HttpError(409, "Confirmez l’identité avec une liste officielle avant de résoudre cette demande sensible");
      }

      const now = new Date();
      const teamChanged = nextAssignedTeam !== request.assignedTeam;
      const nextAssignedTo = body.assignToMe === true
        ? user.id
        : teamChanged
          ? null
          : request.assignedTo;
      const identityChanged =
        nextIdentityStatus !== currentIdentityStatus ||
        nextIdentityMethod !== (typeof currentContext.identityMethod === "string" ? currentContext.identityMethod : null);
      const revisionCondition = sql`date_trunc('milliseconds', ${supportRequests.updatedAt}) = ${expectedRevision}`;
      const updateCondition = body.assignToMe === true && request.assignedTo === null
        ? and(
            eq(supportRequests.id, request.id),
            revisionCondition,
            isNull(supportRequests.assignedTo)
          )
        : and(
            eq(supportRequests.id, request.id),
            revisionCondition
          );
      const [updated] = await db.transaction(async (tx) => {
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
        await tx.insert(supportEvents).values({
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
          correlationId: randomUUID(),
        });
        return [saved];
      });
      return { request: updated };
    }

    const [contacts, messages, attachments] = await Promise.all([
      db
        .select({
          id: supportContacts.id,
          channel: supportContacts.channel,
          value: supportContacts.value,
          isPrimary: supportContacts.isPrimary,
          isVerified: supportContacts.isVerified,
        })
        .from(supportContacts)
        .where(and(eq(supportContacts.requestId, request.id), eq(supportContacts.usageScope, "support"))),
      db
        .select()
        .from(supportMessages)
        .where(eq(supportMessages.requestId, request.id))
        .orderBy(asc(supportMessages.createdAt)),
      db
        .select({
          id: supportAttachments.id,
          originalName: supportAttachments.originalName,
          documentType: supportAttachments.documentType,
          concernsLabel: supportAttachments.concernsLabel,
          detectedMime: supportAttachments.detectedMime,
          sizeBytes: supportAttachments.sizeBytes,
          scanStatus: supportAttachments.scanStatus,
          createdAt: supportAttachments.createdAt,
        })
        .from(supportAttachments)
        .where(eq(supportAttachments.requestId, request.id)),
    ]);

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
        ...request,
        identityStatus,
        identityMethod: typeof identityContext.identityMethod === "string" ? identityContext.identityMethod : contacts.some((contact) => contact.isVerified) ? "email_magic_link" : null,
        identityVerifiedAt: typeof identityContext.identityVerifiedAt === "string" ? identityContext.identityVerifiedAt : null,
      },
      contacts,
      messages,
      attachments,
      access,
    };
  });
}
