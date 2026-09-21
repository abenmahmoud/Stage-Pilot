import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clearEquipmentExternalSession } from "../../_shared/equipment-external-session.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    clearEquipmentExternalSession(res);
    return { ok: true };
  });
}

export const config = { api: { bodyParser: false } };
