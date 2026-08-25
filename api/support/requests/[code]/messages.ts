import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, sql } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import { supportEvents, supportMessages } from "../../../../db/schema.js";
import { HttpError } from "../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";
import {
  idempotencyKey,
  requireSupportAccess,
  sha256,
} from "../../../_shared/support.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  return handleApi(res, async () => {
    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    if (!code || !/^BC-\d{4}-\d{6}$/.test(code)) {
      throw new HttpError(400, "Numéro de demande invalide");
    }
    const access = await requireSupportAccess(req, code);
    const messageIdempotencyHash = sha256(idempotencyKey(req));
    const body = req.body as Record<string, unknown>;
    if (typeof body?.message !== "string") throw new HttpError(400, "Message requis");
    const text = body.message
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .trim();
    if (!text || text.length > 5000) throw new HttpError(400, "Message invalide");

    const correlationId = randomUUID();
    const jobId = randomUUID();
    const message = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(supportMessages)
        .values({
          requestId: access.requestId,
          direction: "inbound",
          channel: "web",
          authorLabel: "Demandeur",
          bodyText: text,
          clientIdempotencyKeyHash: messageIdempotencyHash,
        })
        .onConflictDoNothing({ target: supportMessages.clientIdempotencyKeyHash })
        .returning({ id: supportMessages.id, createdAt: supportMessages.createdAt });

      if (!created) {
        const [existing] = await tx
          .select({ id: supportMessages.id, createdAt: supportMessages.createdAt })
          .from(supportMessages)
          .where(eq(supportMessages.clientIdempotencyKeyHash, messageIdempotencyHash))
          .limit(1);
        if (!existing) throw new Error("Idempotent message could not be recovered");
        return { ...existing, duplicate: true };
      }

      await tx.insert(supportEvents).values({
        requestId: access.requestId,
        eventType: "message.received",
        actorType: "requester",
        actorId: access.sessionId,
        toValue: { messageId: created.id, channel: "web" },
        correlationId,
      });

      await tx.execute(sql`
        select pgmq.send(
          'support_jobs',
          jsonb_build_object(
            'job_id', ${jobId},
            'job_type', 'notify_agent_message_received',
            'request_id', ${access.requestId},
            'message_id', ${created.id},
            'idempotency_key', ${`message-received:${created.id}`},
            'attempt', 0
          )
        )
      `);

      return { ...created, duplicate: false };
    });

    res.status(message.duplicate ? 200 : 201);
    return { message: { id: message.id, createdAt: message.createdAt }, duplicate: message.duplicate };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };
