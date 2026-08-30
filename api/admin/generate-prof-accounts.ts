import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { HttpError, requireAal2, requireRole } from "../_shared/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  await handleApi(res, async () => {
    await requireRole(req, ["superadmin", "administration"]);
    await requireAal2(req);
    throw new HttpError(
      410,
      "La génération de comptes à partir de codes d’accès a été retirée. Utilisez le parcours nominatif validé."
    );
  });
}

export const config = { api: { bodyParser: false } };
