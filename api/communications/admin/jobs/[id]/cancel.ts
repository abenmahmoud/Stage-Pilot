import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../../../../db/index.js";
import { HttpError } from "../../../../_shared/auth.js";
import { requireCommunicationDirection } from "../../../../_shared/communications.js";
import { persistCommunicationJobCancellation } from "../../../../_shared/communication-job-cancellation-persistence.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

const BODY_FIELDS = new Set(["operatorConfirmedCancellation"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cancellationJobId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new HttpError(400, "Travail invalide.");
  return value;
}

function confirmedBody(value: unknown): true {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Confirmation requise.");
  const body = value as Record<string, unknown>;
  if (
    Object.keys(body).some((key) => !BODY_FIELDS.has(key)) ||
    body.operatorConfirmedCancellation !== true
  ) {
    throw new HttpError(400, "Confirmez l’annulation de ce travail.");
  }
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const context = await requireCommunicationDirection(req);
    const jobId = cancellationJobId(req);
    confirmedBody(req.body);
    const result = await db.transaction((tx) => persistCommunicationJobCancellation({
      tx,
      institutionId: context.institutionId,
      jobId,
      actorUserId: context.user.id,
      actorRole: context.user.role as "superadmin" | "proviseur",
      authenticatorLevel: "aal2",
      operatorConfirmedCancellation: true,
    }));
    if (!result.allowed) throw new HttpError(409, "Ce travail ne peut pas être annulé.");
    return result;
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
