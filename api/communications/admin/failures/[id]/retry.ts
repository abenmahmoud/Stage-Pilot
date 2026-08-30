import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../../../../db/index.js";
import { isCommunicationWebhookSecret } from "../../../../../shared/communication-webhook-auth.js";
import type { CommunicationManualRetryActorRole } from "../../../../../shared/communication-job-manual-retry.js";
import { HttpError } from "../../../../_shared/auth.js";
import { persistCommunicationManualRetry } from "../../../../_shared/communication-job-manual-retry-persistence.js";
import { requireCommunicationSender } from "../../../../_shared/communications.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

const BODY_FIELDS = new Set(["operatorConfirmedReady"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function retryJobId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new HttpError(400, "Travail invalide.");
  return value;
}

function confirmedBody(value: unknown): true {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Confirmation requise.");
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !BODY_FIELDS.has(key)) || body.operatorConfirmedReady !== true) {
    throw new HttpError(400, "Confirmez que la cause a été corrigée.");
  }
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const context = await requireCommunicationSender(req);
    const jobId = retryJobId(req);
    confirmedBody(req.body);
    const idempotencySecret = process.env.COMMUNICATION_MANUAL_RETRY_HMAC_SECRET;
    if (!isCommunicationWebhookSecret(idempotencySecret)) {
      throw new HttpError(503, "La reprise des communications n’est pas configurée.");
    }
    const result = await db.transaction((tx) => persistCommunicationManualRetry({
      tx,
      institutionId: context.institutionId,
      originalJobId: jobId,
      actorUserId: context.user.id,
      actorRole: context.user.role as CommunicationManualRetryActorRole,
      authenticatorLevel: "aal2",
      operatorConfirmedReady: true,
      idempotencySecret,
    }));
    if (!result.allowed) throw new HttpError(409, "Ce travail ne peut pas être relancé.");
    res.status(result.created ? 201 : 200);
    return result;
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
