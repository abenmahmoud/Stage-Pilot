import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { eleves, professeurs, classes, stages, fichesGrandOral } from "../../db/schema.js";
import { sql } from "drizzle-orm";

export default async (req: Request) => {
  if (req.method !== "GET")
    return new Response("Method not allowed", { status: 405 });

  const [eleveCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(eleves);
  const [profCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(professeurs);
  const [classeCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(classes);

  const allStages = await db
    .select({ statut: stages.statut })
    .from(stages);
  const stagesComplete = allStages.filter((s) =>
    ["convention_signee", "stage_en_cours", "stage_termine"].includes(s.statut)
  ).length;
  const stagesSansStage = allStages.filter(
    (s) => s.statut === "a_completer"
  ).length;

  const allFiches = await db
    .select({ statut: fichesGrandOral.statut })
    .from(fichesGrandOral);
  const goFinalise = allFiches.filter((f) => f.statut === "finalise").length;
  const goEnAttente = allFiches.filter(
    (f) => !["brouillon", "finalise"].includes(f.statut)
  ).length;

  return Response.json({
    totalEleves: Number(eleveCount.count),
    totalProfs: Number(profCount.count),
    totalClasses: Number(classeCount.count),
    stagesComplete,
    stagesSansStage,
    goFinalise,
    goEnAttente,
  });
};

export const config: Config = {
  path: "/api/admin/stats",
};
