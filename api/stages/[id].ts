import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { stages, eleves, classes } from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireRole, HttpError } from "../_shared/auth.js";
import { isStageModuleActive } from "../_shared/modules.js";
import {
  canReadStageForUser,
  getProfesseurIdForUser,
} from "../_shared/access.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  await handleApi(res, async () => {
    const user = await requireRole(req, [
      "superadmin",
      "administration",
      "pp",
      "professeur",
      "proviseur",
    ]);
    const professeurId = await getProfesseurIdForUser(user);

    const eleveId = (req.query.id as string) || "";
    if (!eleveId || !/^[0-9a-fA-F-]{36}$/.test(eleveId)) {
      throw new HttpError(400, "Identifiant élève invalide");
    }

    const result = await db
      .select({
        id: stages.id,
        eleveNom: eleves.nom,
        elevePrenom: eleves.prenom,
        classeNom: classes.nom,
        classeNiveau: classes.niveau,
        professeurPrincipalId: classes.professeurPrincipalId,
        statut: stages.statut,
        professeurReferentId: stages.professeurReferentId,
        entrepriseNom: stages.entrepriseNom,
        entrepriseAdresse: stages.entrepriseAdresse,
        entrepriseTelephone: stages.entrepriseTelephone,
        entrepriseRepresentant: stages.entrepriseRepresentant,
        entrepriseQualite: stages.entrepriseQualite,
        entrepriseType: stages.entrepriseType,
        tuteurNomQualite: stages.tuteurNomQualite,
        tuteurEmail: stages.tuteurEmail,
        tuteurTelephone: stages.tuteurTelephone,
        dateDebut: stages.dateDebut,
        dateFin: stages.dateFin,
      })
      .from(stages)
      .innerJoin(eleves, eq(stages.eleveId, eleves.id))
      .leftJoin(classes, eq(eleves.classeId, classes.id))
      .where(eq(stages.eleveId, eleveId))
      .limit(1);

    if (result.length === 0) {
      throw new HttpError(404, "Stage introuvable pour cet élève");
    }
    if (!isStageModuleActive(result[0].classeNiveau, result[0].statut)) {
      throw new HttpError(404, "Stage désactivé pour cet élève");
    }
    if (!canReadStageForUser(result[0], user, professeurId)) {
      throw new HttpError(403, "Accès interdit à ce dossier de stage");
    }

    return { ...result[0], professeurReferent: null };
  });
}
