import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { stages, eleves, classes, professeurs } from "../../db/schema.js";
import { eq, sql } from "drizzle-orm";

export default async (req: Request) => {
  if (req.method === "GET") {
    const allStages = await db
      .select({
        id: stages.id,
        eleveId: stages.eleveId,
        eleveNom: eleves.nom,
        elevePrenom: eleves.prenom,
        classeNom: classes.nom,
        statut: stages.statut,
        entrepriseNom: stages.entrepriseNom,
        tuteurTelephone: stages.tuteurTelephone,
      })
      .from(stages)
      .innerJoin(eleves, eq(stages.eleveId, eleves.id))
      .leftJoin(classes, eq(eleves.classeId, classes.id));

    const stagesList = allStages.map((s) => ({
      ...s,
      professeurReferent: null,
    }));

    const total = stagesList.length;
    const avecStage = stagesList.filter(
      (s) =>
        !["a_completer", "dispense", "accueil_lycee"].includes(s.statut)
    ).length;
    const sansStage = stagesList.filter(
      (s) => s.statut === "a_completer"
    ).length;
    const conventionsGenerees = stagesList.filter(
      (s) =>
        ["convention_generee", "convention_signee", "stage_en_cours", "stage_termine"].includes(s.statut)
    ).length;
    const conventionsSignees = stagesList.filter(
      (s) =>
        ["convention_signee", "stage_en_cours", "stage_termine"].includes(s.statut)
    ).length;

    return Response.json({
      stages: stagesList,
      stats: { total, avecStage, sansStage, conventionsGenerees, conventionsSignees },
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/stages",
};
