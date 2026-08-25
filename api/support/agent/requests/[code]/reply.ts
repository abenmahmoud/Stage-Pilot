import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  supportCallbackTasks,
  supportContacts,
  supportEvents,
  supportMagicTokens,
  supportMessages,
  supportRequests,
} from "../../../../../db/schema.js";
import { HttpError, requireRole } from "../../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";
import { idempotencyKey, opaqueToken, sha256 } from "../../../../_shared/support.js";

const AGENT_ROLES = ["superadmin", "administration", "proviseur"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  return handleApi(res, async () => {
    const user = await requireRole(req, AGENT_ROLES);
    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    if (!code || !/^BC-\d{4}-\d{6}$/.test(code)) {
      throw new HttpError(400, "Numéro de demande invalide");
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.message !== "string") throw new HttpError(400, "Message requis");
    const messageText = body.message.replace(/[\u0000-\u001F]/g, "").trim();
    if (!messageText || messageText.length > 10000) throw new HttpError(400, "Message invalide");
    const idempotencyHash = sha256(idempotencyKey(req));
    const rawAccessToken = opaqueToken();

    const [request] = await db
      .select({ id: supportRequests.id, subject: supportRequests.subject })
      .from(supportRequests)
      .where(eq(supportRequests.publicCode, code))
      .limit(1);
    if (!request) throw new HttpError(404, "Demande introuvable");
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
          .select({ id: supportMessages.id, createdAt: supportMessages.createdAt })
          .from(supportMessages)
          .where(eq(supportMessages.clientIdempotencyKeyHash, idempotencyHash))
          .limit(1);
        if (!existing) throw new Error("Idempotent agent reply could not be recovered");
        return { ...existing, duplicate: true, channel: email ? "email" : "phone" };
      }

      if (email) {
        await tx.insert(supportMagicTokens).values({
          requestId: request.id,
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
              'access_token', ${rawAccessToken}::text,
              'idempotency_key', ${`requester-reply:${created.id}`}::text,
              'attempt', 0
            )
          )
        `);
      } else if (phone) {
        await tx.insert(supportCallbackTasks).values({
          requestId: request.id,
          phoneContactId: phone.id,
          assignedTo: user.id,
          dueAt: new Date(),
        });
      }

      await tx
        .update(supportRequests)
        .set({ status: "attente_demandeur", assignedTo: user.id })
        .where(eq(supportRequests.id, request.id));
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
