// GET /api/flash/validation/screen-access — LOT 5 du plan de publication
// publique (T071E).
//
// Jusqu'ici la porte de `/admin/informations-flash/valider` reposait sur le
// rôle applicatif (`RoleRoute allowedRoles={CONTENT_MANAGER_ROLES}`,
// src/App.tsx) : un compte `administration`/`proviseur` sans le service
// `referent_numerique`/`ddfpt` voyait quand même l'écran, avec les boutons
// désactivés côté serveur mais aucun refus d'accès à la porte. §13 dit que
// c'est le service, jamais le rôle, qui ouvre la validation — déjà appliqué
// à la file (`assertFlashValidationQueueAccess`) et aux trois routes qui
// mutent une version (`assertFlashValidationAccess`). Cette route ne fait que
// remonter la même décision au client, pour que la porte de l'écran
// lui-même en dépende. Le serveur reste seul à décider : aucun `serviceCodes`
// brut ni rôle n'est renvoyé, seulement `allowed`/`grantedByService`.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { requireFlashActor } from "../../_shared/flash-access.js";
import { grantedFlashValidationService } from "../../../shared/flash-validation-access.js";
import { toFlashValidationScreenAccessPayload } from "../../_shared/flash-response.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  return handleApi(res, async () => {
    const actor = await requireFlashActor(req);
    const granted = grantedFlashValidationService(actor.user.role, actor.serviceCodes);
    return toFlashValidationScreenAccessPayload(granted);
  });
}
