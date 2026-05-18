import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { fichesGrandOral, eleves, classes } from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireRole } from "../_shared/auth.js";
import { isGrandOralModuleActive } from "../_shared/modules.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  await handleApi(res, async () => {
    await requireRole(req, [
      "superadmin",
      "administration",
      "pp",
      "professeur",
      "proviseur",
    ]);

    const allFiches = await db
      .select({
        id: fichesGrandOral.id,
        eleveId: fichesGrandOral.eleveId,
        eleveNom: eleves.nom,
        elevePrenom: eleves.prenom,
        classeNom: classes.nom,
        classeNiveau: classes.niveau,
        statut: fichesGrandOral.statut,
        question1: fichesGrandOral.question1,
        soumisAt: fichesGrandOral.soumisAt,
      })
      .from(fichesGrandOral)
      .innerJoin(eleves, eq(fichesGrandOral.eleveId, eleves.id))
      .leftJoin(classes, eq(eleves.classeId, classes.id));

    const fichesList = allFiches
      .filter((f) => isGrandOralModuleActive(f.classeNiveau, f.statut))
      .map((f) => ({
        ...f,
        specialites: null,
        profSpe1: null,
        profSpe2: null,
      }));

    const total = fichesList.length;
    const brouillons = fichesList.filter((f) => f.statut === "brouillon").length;
    const finalises = fichesList.filter((f) => f.statut === "finalise").length;
    const enAttente = total - brouillons - finalises;

    return {
      fiches: fichesList,
      stats: { total, brouillons, enAttente, finalises },
    };
  });
}
