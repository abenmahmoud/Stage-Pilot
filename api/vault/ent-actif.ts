// Route réelle « ENT actif » du coffre de codes — LOT 1 du plan du
// 6 septembre 2026 (`docs/operations/PLAN_ENT_ACTIF_ET_DETTE_2026-09-06.md`).
// Même montage que `api/vault/ent-inactif.ts` (LOT 3 du plan de branchement) :
// mince, l'authentification et l'analyse de la requête vivent ici, toute la
// décision vit dans `api/_shared/code-vault-ent-actif-route.ts`
// (`handleEntActifVaultRequest`), testable sans passer par une vraie requête
// HTTP.
//
// Toujours un self-service (élève ou professeur qui a oublié le mot de
// passe de son propre compte ENT déjà actif) : cette route ne remet jamais
// de code (voir l'en-tête de `code-vault-ent-actif-route.ts`), elle guide
// une réinitialisation et, en cas d'échec, ouvre un ticket vers le référent
// numérique.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../db/index.js";
import type { VaultAccessTarget, VaultActor } from "../../shared/code-vault-policy.js";
import { HttpError, requireRole } from "../_shared/auth.js";
import {
  handleEntActifVaultRequest,
  parseEntActifRequestInput,
} from "../_shared/code-vault-ent-actif-route.js";
import { requireConfiguredInstitution } from "../_shared/institution-context.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";

const ENT_ACTIF_ROLES = ["eleve", "professeur"] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const user = await requireRole(req, ENT_ACTIF_ROLES);
    const input = parseEntActifRequestInput(req.body);
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
      handleEntActifVaultRequest(tx, {
        actor,
        target,
        outcome: input.outcome,
      })
    );

    if (result.outcome === "denied") {
      throw new HttpError(403, "Accès refusé au coffre de codes ENT.");
    }
    return result;
  });
}

export const config = { api: { bodyParser: { sizeLimit: "2kb" } } };
