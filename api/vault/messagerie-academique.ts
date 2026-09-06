// Route réelle « messagerie académique » du coffre de codes — LOT 4 du plan
// du 6 septembre 2026 (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`).
// Volontairement mince, comme les autres routes du coffre : la décision vit
// dans `api/_shared/code-vault-messagerie-academique-route.ts`
// (`handleMessagerieAcademiqueVaultRequest`).
//
// Rappel du plan : ce parcours ne remet aucun code, il confirme seulement
// l'email académique déjà au dossier — jamais de cible distincte de
// l'appelant (voir l'en-tête du module partagé).
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../db/index.js";
import type { VaultActor } from "../../shared/code-vault-policy.js";
import { requireRole } from "../_shared/auth.js";
import {
  handleMessagerieAcademiqueVaultRequest,
  parseMessagerieAcademiqueRequestInput,
} from "../_shared/code-vault-messagerie-academique-route.js";
import { requireConfiguredInstitution } from "../_shared/institution-context.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";

const MESSAGERIE_ACADEMIQUE_ROLES = ["eleve", "professeur"] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const user = await requireRole(req, MESSAGERIE_ACADEMIQUE_ROLES);
    const input = parseMessagerieAcademiqueRequestInput(req.body);
    const institution = await requireConfiguredInstitution();

    const actor: VaultActor =
      user.role === "professeur"
        ? { profile: "professeur", personRef: user.id, institutionId: institution.id }
        : { profile: "eleve", personRef: user.id, institutionId: institution.id };

    return db.transaction((tx) =>
      handleMessagerieAcademiqueVaultRequest(tx, {
        institutionId: institution.id,
        actor,
        phase: input.phase,
        emailVerifiable: input.emailVerifiable,
      })
    );
  });
}

export const config = { api: { bodyParser: { sizeLimit: "2kb" } } };
