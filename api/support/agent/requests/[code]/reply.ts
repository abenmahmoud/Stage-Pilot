import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  supportCallbackTasks,
  supportContacts,
  supportEvents,
  supportMagicTokens,
  supportMessages,
  supportRequests,
} from "../../../../../db/schema.js";
import { HttpError } from "../../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";
import { idempotencyKey, opaqueToken, sha256 } from "../../../../_shared/support.js";
import {
  assertSupportRequestAccess,
  requireSupportAgent,
} from "../../../../_shared/support-agent-access.js";
import {
  parseSupportRevision,
  supportRevisionMatches,
} from "../../../../../shared/support-concurrency.js";

const IDENTITY_VERIFICATION_MESSAGE = "Bonjour, pour protéger vos accès, nous devons d’abord confirmer votre identité avec une source officielle du lycée. Ne transmettez aucun mot de passe ni aucun code reçu par SMS. Nous revenons vers vous dès que la vérification est terminée.";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  return handleApi(res, async () => {
    const { user, access } = await requireSupportAgent(req);
    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    if (!code || !/^BC-\d{4}-\d{6}$/.test(code)) {
      throw new HttpError(400, "Numéro de demande invalide");
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.message !== "string") throw new HttpError(400, "Message requis");
    let messageText = body.message.replace(/[\u0000-\u001F]/g, "").trim();
    if (!messageText || messageText.length > 10000) throw new HttpError(400, "Message invalide");
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
      .where(eq(supportRequests.publicCode, code))
      .limit(1);
    if (!request) throw new HttpError(404, "Demande introuvable");
    assertSupportRequestAccess(access, request.assignedTeam);
    const [existingReply] = await db
      .select({
        id: supportMessages.id,
        requestId: supportMessages.requestId,
        createdAt: supportMessages.createdAt,
        channel: supportMessages.channel,
      })
      .from(supportMessages)
      .where(eq(supportMessages.clientIdempotencyKeyHash, idempotencyHash))
      .limit(1);
    if (existingReply) {
      if (existingReply.requestId !== request.id) {
        throw new HttpError(409, "Cette clé d’envoi a déjà été utilisée pour un autre dossier");
      }
      res.status(200);
      return {
        message: {
          id: existingReply.id,
          createdAt: existingReply.createdAt,
          channel: existingReply.channel,
          duplicate: true,
        },
      };
    }
    const expectedRevision = parseSupportRevision(body.expectedUpdatedAt);
    if (!expectedRevision) {
      throw new HttpError(400, "La version du dossier est requise");
    }
    if (!supportRevisionMatches(request.updatedAt, expectedRevision)) {
      throw new HttpError(409, "Ce dossier a été modifié par un autre agent. Il vient d’être actualisé.");
    }
    const identityContext = (request.subjectContext ?? {}) as Record<string, unknown>;
    if (
      ["ent", "email_academique"].includes(request.category) &&
      identityContext.identityStatus !== "identite_confirmee"
    ) {
      if (body.safeTemplate !== "identity_verification") {
        throw new HttpError(409, "Avant la confirmation d’identité, utilisez uniquement le message sécurisé de vérification");
      }
      messageText = IDENTITY_VERIFICATION_MESSAGE;
    }
    const contacts = await db
      .select({ id: supportContacts.id, channel: supportContacts.channel })
      .from(supportContacts)
      .where(eq(supportContacts.requestId, request.id));
    const email = contacts.find((contact) => contact.channel === "email");
    const phone = contacts.find((contact) => contact.channel === "phone");
    if (!email && !phone) throw new HttpError(409, "Aucun moyen de réponse n'est disponible");

    const correlationId = randomUUID();
    const jobId = randomUUID();
    const result = await db.transaction(async (tx) => {
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
        .onConflictDoNothing({ target: supportMessages.clientIdempotencyKeyHash })
        .returning({ id: supportMessages.id, createdAt: supportMessages.createdAt });
      if (!created) {
        const [existing] = await tx
          .select({
            id: supportMessages.id,
            requestId: supportMessages.requestId,
            createdAt: supportMessages.createdAt,
          })
          .from(supportMessages)
          .where(eq(supportMessages.clientIdempotencyKeyHash, idempotencyHash))
          .limit(1);
        if (!existing) throw new Error("Idempotent agent reply could not be recovered");
        if (existing.requestId !== request.id) {
          throw new HttpError(409, "Cette clé d’envoi a déjà été utilisée pour un autre dossier");
        }
        return { ...existing, duplicate: true, channel: email ? "email" : "phone" };
      }

      if (email) {
        await tx.insert(supportMagicTokens).values({
          requestId: request.id,
          contactId: email.id,
          tokenHash: sha256(rawAccessToken),
          purpose: "support_access",
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        await tx.execute(sql`
          select pgmq.send(
            'support_jobs',
            jsonb_build_object(
              'job_id', ${jobId}::uuid,
              'job_type', 'send_requester_reply',
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
        if (!activeCallback) {
          await tx.insert(supportCallbackTasks).values({
            requestId: request.id,
            phoneContactId: phone.id,
            assignedTo: user.id,
            status: "in_progress",
            dueAt: new Date(),
          });
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
            eq(supportRequests.id, request.id),
            sql`date_trunc('milliseconds', ${supportRequests.updatedAt}) = ${expectedRevision}`,
            teamCondition
          )
        )
        .returning({ id: supportRequests.id });
      if (!updatedRequest) {
        throw new HttpError(409, "Ce dossier a été modifié ou transféré par un autre agent. Il vient d’être actualisé.");
      }
      await tx.insert(supportEvents).values({
        requestId: request.id,
        eventType: email ? "reply.queued" : "callback.created",
        actorType: "agent",
        actorId: user.id,
        toValue: { messageId: created.id, channel: email ? "email" : "phone" },
        correlationId,
      });
      return { ...created, duplicate: false, channel: email ? "email" : "phone" };
    });

    res.status(result.duplicate ? 200 : 201);
    return { message: result };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "24kb" } } };
