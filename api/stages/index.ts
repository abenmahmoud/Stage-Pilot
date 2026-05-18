import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { stages, eleves, classes } from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireRole } from "../_shared/auth.js";
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

    const allStages = await db
      .select({
        id: stages.id,
        eleveId: stages.eleveId,
        eleveNom: eleves.nom,
        elevePrenom: eleves.prenom,
        classeNom: classes.nom,
        classeNiveau: classes.niveau,
        professeurPrincipalId: classes.professeurPrincipalId,
        professeurReferentId: stages.professeurReferentId,
        statut: stages.statut,
        entrepriseNom: stages.entrepriseNom,
        tuteurTelephone: stages.tuteurTelephone,
      })
      .from(stages)
      .innerJoin(eleves, eq(stages.eleveId, eleves.id))
      .leftJoin(classes, eq(eleves.classeId, classes.id));

    const stagesList = allStages
      .filter((s) => isStageModuleActive(s.classeNiveau, s.statut))
      .filter((s) => canReadStageForUser(s, user, professeurId))
      .map((s) => ({
        ...s,
        professeurReferent: null,
      }));

    const total = stagesList.length;
    const avecStage = stagesList.filter(
      (s) => !["a_completer", "dispense", "accueil_lycee"].includes(s.statut)
    ).length;
    const sansStage = stagesList.filter((s) => s.statut === "a_completer").length;
    const conventionsGenerees = stagesList.filter((s) =>
      [
        "convention_generee",
        "convention_signee",
        "stage_en_cours",
        "stage_termine",
      ].includes(s.statut)
    ).length;
    const conventionsSignees = stagesList.filter((s) =>
      ["convention_signee", "stage_en_cours", "stage_termine"].includes(s.statut)
    ).length;

    return {
      stages: stagesList,
      stats: {
        total,
        avecStage,
        sansStage,
        conventionsGenerees,
        conventionsSignees,
      },
    };
  });
}
