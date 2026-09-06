// Route réelle « Koxo » du coffre de codes — LOT 4 du plan du 6 septembre
// 2026 (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`). Même forme
// que `api/vault/ent-inactif.ts` (LOT 3) : mince, toute la décision vit dans
// `api/_shared/code-vault-service-delivery-route.ts`
// (`handleServiceDeliveryVaultRequest`).
//
// Toujours un self-service (élève, ou professeur sur son propre code Koxo) :
// la remise déléguée (professeur principal → élève) reste hors périmètre de
// ce lot (voir l'en-tête de `code-vault-service-delivery-route.ts`).
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../db/index.js";
import type { VaultAccessTarget, VaultActor } from "../../shared/code-vault-policy.js";
import { HttpError, requireRole } from "../_shared/auth.js";
import {
  handleServiceDeliveryVaultRequest,
  parseServiceDeliveryRequestInput,
} from "../_shared/code-vault-service-delivery-route.js";
import { requireConfiguredInstitution } from "../_shared/institution-context.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";

const KOXO_ROLES = ["eleve", "professeur"] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const user = await requireRole(req, KOXO_ROLES);
    const input = parseServiceDeliveryRequestInput("koxo", req.body);
    const institution = await requireConfiguredInstitution();

    const actor: VaultActor =
      user.role === "professeur"
        ? { profile: "professeur", personRef: user.id, institutionId: institution.id }
        : { profile: "eleve", personRef: user.id, institutionId: institution.id };
    const target: VaultAccessTarget = {
      service: "koxo",
      institutionId: institution.id,
      subjectKind: "self",
      subjectPersonRef: user.id,
      subjectClassRef: null,
    };

    const result = await db.transaction((tx) =>
      handleServiceDeliveryVaultRequest(tx, {
        journeyType: "koxo",
        actor,
        target,
        phase: input.phase,
        proofChannel: input.proofChannel,
        schoolYear: input.schoolYear,
        now: new Date(),
      })
    );

    if (result.outcome === "denied") {
      throw new HttpError(403, "Accès refusé au coffre de codes Koxo.");
    }
    return result;
  });
}

export const config = { api: { bodyParser: { sizeLimit: "2kb" } } };
