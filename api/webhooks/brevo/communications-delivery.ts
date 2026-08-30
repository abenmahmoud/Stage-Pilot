import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { communicationDeliveries, communicationEvents } from "../../../db/schema.js";
import {
  communicationDeliveryWebhookEnabled,
  parseCommunicationBrevoDeliveryEvent,
  verifyCommunicationDeliveryBearerHeader,
  type CommunicationDeliveryEvent,
} from "../../../shared/communication-delivery-event.js";
import { planCommunicationDeliveryTransition } from "../../../shared/communication-delivery-transition.js";
import { HttpError } from "../../_shared/auth.js";
import { requireConfiguredInstitution } from "../../_shared/institution-context.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

function authorize(req: VercelRequest): void {
  if (!communicationDeliveryWebhookEnabled()) {
    throw new HttpError(404, "Webhook indisponible");
  }
  if (!verifyCommunicationDeliveryBearerHeader(
    req.headers.authorization,
    process.env.COMMUNICATION_DELIVERY_WEBHOOK_TOKEN
  )) {
    throw new HttpError(401, "Webhook refusé");
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  return handleApi(res, async () => {
    authorize(req);
    const institution = await requireConfiguredInstitution();
    let event: CommunicationDeliveryEvent;
    try {
      event = parseCommunicationBrevoDeliveryEvent(
        req.body,
        process.env.COMMUNICATION_PROVIDER_MESSAGE_HMAC_SECRET ?? ""
      );
    } catch {
      throw new HttpError(400, "Événement de livraison invalide");
    }

    return db.transaction(async (tx) => {
      const [delivery] = await tx
        .select({
          id: communicationDeliveries.id,
          communicationId: communicationDeliveries.communicationId,
          status: communicationDeliveries.status,
          deliveredAt: communicationDeliveries.deliveredAt,
        })
        .from(communicationDeliveries)
        .where(and(
          eq(communicationDeliveries.institutionId, institution.id),
          eq(communicationDeliveries.providerMessageRef, event.providerMessageRef)
        ))
        .limit(1)
        .for("update");
      if (!delivery) {
        return { accepted: true, matched: false, duplicate: false, applied: false };
      }

      const transition = planCommunicationDeliveryTransition(delivery.status, event.status);
      const [receipt] = await tx
        .insert(communicationEvents)
        .values({
          institutionId: institution.id,
          communicationId: delivery.communicationId,
          resourceType: "delivery",
          resourceId: delivery.id,
          eventType: `delivery.${event.status}`,
          actorType: "provider",
          externalEventHash: event.eventHash,
          summary: {
            provider: event.provider,
            status: event.status,
            occurredAt: event.occurredAt,
            transition: transition.reason,
          },
        })
        .onConflictDoNothing()
        .returning({ id: communicationEvents.id });
      if (!receipt) {
        return { accepted: true, matched: true, duplicate: true, applied: false };
      }

      if (transition.apply) {
        await tx
          .update(communicationDeliveries)
          .set({
            status: transition.nextStatus,
            deliveredAt: transition.deliveredAtAction === "set_if_empty"
              ? delivery.deliveredAt ?? new Date(event.occurredAt)
              : delivery.deliveredAt,
            updatedAt: new Date(),
          })
          .where(and(
            eq(communicationDeliveries.id, delivery.id),
            eq(communicationDeliveries.institutionId, institution.id)
          ));
      }

      return {
        accepted: true,
        matched: true,
        duplicate: false,
        applied: transition.apply,
      };
    });
  });
}

export const config = { api: { bodyParser: { sizeLimit: "64kb" } } };
