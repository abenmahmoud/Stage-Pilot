import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  eleves,
  professeurs,
  classes,
  stages,
  fichesGrandOral,
} from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireRole } from "../_shared/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  await handleApi(res, async () => {
    await requireRole(req, ["superadmin", "administration"]);

    const [eleveCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(eleves);
    const [profCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(professeurs);
    const [classeCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(classes);

    const allStages = await db.select({ statut: stages.statut }).from(stages);
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

    return {
      totalEleves: Number(eleveCount.count),
      totalProfs: Number(profCount.count),
      totalClasses: Number(classeCount.count),
      stagesComplete,
      stagesSansStage,
      goFinalise,
      goEnAttente,
    };
  });
}
