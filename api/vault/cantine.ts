// Route réelle « cantine » du coffre de codes — LOT 4 du plan du 6 septembre
// 2026 (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`). Même forme
// que `api/vault/ent-inactif.ts` (LOT 3) et `api/vault/koxo.ts` : mince,
// toute la décision vit dans
// `api/_shared/code-vault-service-delivery-route.ts`
// (`handleServiceDeliveryVaultRequest`).
//
// Élève uniquement dans ce lot, jamais professeur : `decideVaultAccess`
// (§7) autorise un professeur sur sa propre cantine « selon disponibilité
// validée », mais aucune table du dépôt ne porte aujourd'hui cette
// disponibilité — ouvrir la route au rôle professeur en passant
// `cantineAvailabilityValidated: false` en dur refuserait silencieusement
// tout professeur pour toujours, ce qui n'est pas la même chose qu'une
// fonctionnalité absente : mieux vaut ne pas exposer le rôle plutôt que
// promettre un contrôle qui n'existe pas.
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

const CANTINE_ROLES = ["eleve"] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const user = await requireRole(req, CANTINE_ROLES);
    const input = parseServiceDeliveryRequestInput("cantine", req.body);
    const institution = await requireConfiguredInstitution();

    const actor: VaultActor = { profile: "eleve", personRef: user.id, institutionId: institution.id };
    const target: VaultAccessTarget = {
      service: "cantine",
      institutionId: institution.id,
      subjectKind: "self",
      subjectPersonRef: user.id,
      subjectClassRef: null,
    };

    const result = await db.transaction((tx) =>
      handleServiceDeliveryVaultRequest(tx, {
        journeyType: "cantine",
        actor,
        target,
        phase: input.phase,
        proofChannel: input.proofChannel,
        schoolYear: input.schoolYear,
        now: new Date(),
      })
    );

    if (result.outcome === "denied") {
      throw new HttpError(403, "Accès refusé au coffre de codes cantine.");
    }
    return result;
  });
}

export const config = { api: { bodyParser: { sizeLimit: "2kb" } } };
