import type { VercelRequest, VercelResponse } from "@vercel/node";
import { receiveDepotAnnuaire } from "../_shared/depot-annuaire.js";
import { receiveDepotCodes } from "../_shared/depot-codes.js";
import { receiveDepotAttributs } from "../_shared/depot-attributs.js";
import {
  handleDepotEdtJson,
  receiveDepotEdtMultipart,
} from "../_shared/depot-edt.js";
import {
  depotIngressType,
  requireDepotActorId,
  requireDepotBearer,
} from "../_shared/depot-ingress.js";
import { readDepotJson, readDepotMultipart } from "../_shared/depot-multipart.js";
import { requireConfiguredInstitution } from "../_shared/institution-context.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    requireDepotBearer(req);
    const type = depotIngressType(req);
    const institution = await requireConfiguredInstitution();
    const actorId = requireDepotActorId();
    const contentType = Array.isArray(req.headers["content-type"])
      ? req.headers["content-type"][0]
      : req.headers["content-type"];
    if (type === "edt" && contentType?.split(";", 1)[0]?.trim().toLowerCase() === "application/json") {
      const result = await handleDepotEdtJson({
        institutionId: institution.id,
        actorId,
        body: await readDepotJson(req),
      });
      res.status("upload" in result ? 201 : result.duplicate ? 200 : 202);
      return { ok: true, type, ...result };
    }
    const payload = await readDepotMultipart(req);
    if (type === "edt") {
      const result = await receiveDepotEdtMultipart({
        institutionId: institution.id,
        actorId,
        payload,
      });
      res.status(result.duplicate ? 200 : 202);
      return { ok: true, type, ...result };
    }
    if (type === "codes") {
      const result = await receiveDepotCodes({ institutionId: institution.id, payload });
      res.status(202);
      return { ok: true, type, status: "stored", ...result };
    }
    if (type === "attributs") {
      const result = await receiveDepotAttributs({
        institutionId: institution.id,
        actorId,
        payload,
      });
      res.status(result.duplicate ? 200 : 202);
      return { ok: true, type, ...result };
    }
    const result = await receiveDepotAnnuaire({
      institutionId: institution.id,
      actorId,
      payload,
    });
    res.status(result.duplicate ? 200 : 202);
    return { ok: true, type, ...result };
  });
}

export const config = { api: { bodyParser: false } };
