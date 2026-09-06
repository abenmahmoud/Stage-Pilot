// Route réelle « ENT inactif » du coffre de codes — LOT 3 du plan du
// 6 septembre 2026 (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`).
// Volontairement mince : l'authentification et l'analyse de la requête
// vivent ici, toute la décision vit dans
// `api/_shared/code-vault-ent-inactif-route.ts` (`handleEntInactifVaultRequest`),
// testable sans passer par une vraie requête HTTP.
//
// Toujours un self-service (élève ou professeur sur son propre compte ENT) :
// la remise d'un code élève à un tiers (professeur principal, service) n'est
// pas un parcours « ENT inactif » (voir `decideVaultAccess`, `ent` est
// d'ailleurs interdit au professeur principal). Les autres parcours et
// profils sont hors périmètre de ce lot (plan §LOT 4).
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../db/index.js";
import type { VaultAccessTarget, VaultActor } from "../../shared/code-vault-policy.js";
import { HttpError, requireRole } from "../_shared/auth.js";
import {
  handleEntInactifVaultRequest,
  parseEntInactifRequestInput,
} from "../_shared/code-vault-ent-inactif-route.js";
import { requireConfiguredInstitution } from "../_shared/institution-context.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";

const ENT_INACTIF_ROLES = ["eleve", "professeur"] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const user = await requireRole(req, ENT_INACTIF_ROLES);
    const input = parseEntInactifRequestInput(req.body);
    const institution = await requireConfiguredInstitution();

    const actor: VaultActor =
      user.role === "professeur"
        ? { profile: "professeur", personRef: user.id, institutionId: institution.id }
        : { profile: "eleve", personRef: user.id, institutionId: institution.id };
    const target: VaultAccessTarget = {
      service: "ent",
      institutionId: institution.id,
      subjectKind: "self",
      subjectPersonRef: user.id,
      subjectClassRef: null,
    };

    const result = await db.transaction((tx) =>
      handleEntInactifVaultRequest(tx, {
        actor,
        target,
        phase: input.phase,
        proofChannel: input.proofChannel,
        schoolYear: input.schoolYear,
        now: new Date(),
      })
    );

    if (result.outcome === "denied") {
      throw new HttpError(403, "Accès refusé au coffre de codes ENT.");
    }
    return result;
  });
}

export const config = { api: { bodyParser: { sizeLimit: "2kb" } } };
