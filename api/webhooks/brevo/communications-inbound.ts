import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../../db/index.js";
import {
  communicationInboundWebhookEnabled,
  parseCommunicationBrevoInboundEnvelope,
  verifyCommunicationInboundBearerHeader,
} from "../../../shared/communication-brevo-inbound.js";
import { HttpError } from "../../_shared/auth.js";
import { persistCommunicationInboundReceipts } from "../../_shared/communication-inbound-persistence.js";
import { requireConfiguredInstitution } from "../../_shared/institution-context.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

function authorize(req: VercelRequest): void {
  if (!communicationInboundWebhookEnabled()) throw new HttpError(404, "Webhook indisponible");
  if (!verifyCommunicationInboundBearerHeader(
    req.headers.authorization,
    process.env.COMMUNICATION_INBOUND_WEBHOOK_TOKEN
  )) {
    throw new HttpError(401, "Webhook refusé");
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    authorize(req);
    const institution = await requireConfiguredInstitution();
    let receipts;
    try {
      receipts = parseCommunicationBrevoInboundEnvelope(
        req.body,
        process.env.COMMUNICATION_PROVIDER_MESSAGE_HMAC_SECRET ?? ""
      );
    } catch {
      throw new HttpError(400, "Lot entrant invalide");
    }

    return db.transaction((tx) => persistCommunicationInboundReceipts({
      tx,
      institutionId: institution.id,
      receipts,
    }));
  });
}

export const config = { api: { bodyParser: { sizeLimit: "3mb" } } };
