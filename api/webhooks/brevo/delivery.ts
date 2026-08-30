import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { supportDeliveryEvents, supportMessages, supportRequests } from "../../../db/schema.js";
import { HttpError, secretMatches } from "../../_shared/auth.js";
import { requireConfiguredInstitution } from "../../_shared/institution-context.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

type DeliveryPayload = {
  event?: string;
  id?: number | string;
  ts_event?: number;
  ts?: number;
  "message-id"?: string;
};

const DELIVERY_STATUS: Record<string, string> = {
  delivered: "delivered",
  opened: "opened",
  click: "clicked",
  deferred: "deferred",
  soft_bounce: "soft_bounce",
  hard_bounce: "hard_bounce",
  blocked: "blocked",
  spam: "spam",
  invalid: "invalid",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  return handleApi(res, async () => {
    const expected = process.env.BREVO_WEBHOOK_SECRET;
    const provided = req.headers["x-brevo-webhook-secret"];
    const value = Array.isArray(provided) ? provided[0] : provided;
    if (!secretMatches(expected, value)) throw new HttpError(401, "Webhook refusé");
    const institution = await requireConfiguredInstitution();

    const payloads = (Array.isArray(req.body) ? req.body : [req.body]) as DeliveryPayload[];
    let recorded = 0;
    for (const payload of payloads.slice(0, 100)) {
      const providerMessageId = payload["message-id"];
      const eventType = payload.event;
      if (!providerMessageId || !eventType) continue;
      const [message] = await db
        .select({ id: supportMessages.id })
        .from(supportMessages)
        .innerJoin(supportRequests, eq(supportRequests.id, supportMessages.requestId))
        .where(and(
          eq(supportRequests.institutionId, institution.id),
          eq(supportMessages.providerMessageId, providerMessageId)
        ))
        .limit(1);
      if (!message) continue;
      const providerEventId = String(payload.id ?? `${providerMessageId}:${eventType}:${payload.ts_event ?? payload.ts ?? 0}`);
      const [created] = await db
        .insert(supportDeliveryEvents)
        .values({
          institutionId: institution.id,
          messageId: message.id,
          provider: "brevo",
          providerEventId,
          eventType,
          occurredAt: new Date((payload.ts_event ?? payload.ts ?? Math.floor(Date.now() / 1000)) * 1000),
          payloadRedacted: { event: eventType },
        })
        .onConflictDoNothing()
        .returning({ id: supportDeliveryEvents.id });
      if (!created) continue;
      recorded += 1;
      if (DELIVERY_STATUS[eventType]) {
        await db.update(supportMessages).set({ deliveryStatus: DELIVERY_STATUS[eventType] }).where(eq(supportMessages.id, message.id));
      }
    }
    return { received: payloads.length, recorded };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "256kb" } } };
