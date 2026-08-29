import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  supportEvents,
  supportMessages,
  supportRequests,
} from "../../../../../db/schema.js";
import { HttpError } from "../../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";
import {
  assertNoForbiddenSupportSecret,
  idempotencyKey,
  sha256,
} from "../../../../_shared/support.js";
import {
  assertSupportRequestAccess,
  requireSupportAgent,
} from "../../../../_shared/support-agent-access.js";


export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  return handleApi(res, async () => {
    const { user, access } = await requireSupportAgent(req);
    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    if (!code || !/^BC-\d{4}-\d{6}$/.test(code)) {
      throw new HttpError(400, "Numéro de demande invalide");
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.note !== "string") throw new HttpError(400, "Note requise");
    const note = body.note
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .trim();
    if (!note || note.length > 5000) throw new HttpError(400, "Note invalide");
    assertNoForbiddenSupportSecret(note);

    const [request] = await db
      .select({ id: supportRequests.id, assignedTeam: supportRequests.assignedTeam })
      .from(supportRequests)
      .where(eq(supportRequests.publicCode, code))
      .limit(1);
    if (!request) throw new HttpError(404, "Demande introuvable");
    assertSupportRequestAccess(access, request.assignedTeam);

    const idempotencyHash = sha256(idempotencyKey(req));
    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(supportMessages)
        .values({
          requestId: request.id,
          direction: "internal",
          channel: "system",
          authorUserId: user.id,
          authorLabel: "Note interne",
          bodyText: note,
          clientIdempotencyKeyHash: idempotencyHash,
          deliveryStatus: "stored",
          validatedBy: user.id,
          validatedAt: new Date(),
        })
        .onConflictDoNothing({ target: supportMessages.clientIdempotencyKeyHash })
        .returning({ id: supportMessages.id, createdAt: supportMessages.createdAt });
      if (!created) {
        const [existing] = await tx
          .select({ id: supportMessages.id, createdAt: supportMessages.createdAt })
          .from(supportMessages)
          .where(
            and(
              eq(supportMessages.clientIdempotencyKeyHash, idempotencyHash),
              eq(supportMessages.requestId, request.id)
            )
          )
          .limit(1);
        if (!existing) throw new Error("Idempotent internal note could not be recovered");
        return { ...existing, duplicate: true };
      }
      await tx.insert(supportEvents).values({
        requestId: request.id,
        eventType: "note.created",
        actorType: "agent",
        actorId: user.id,
        toValue: { messageId: created.id },
        correlationId: randomUUID(),
      });
      return { ...created, duplicate: false };
    });

    res.status(result.duplicate ? 200 : 201);
    return { note: result };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "12kb" } } };
