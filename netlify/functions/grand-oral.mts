import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { fichesGrandOral, eleves, classes } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export default async (req: Request) => {
  if (req.method === "GET") {
    const allFiches = await db
      .select({
        id: fichesGrandOral.id,
        eleveId: fichesGrandOral.eleveId,
        eleveNom: eleves.nom,
        elevePrenom: eleves.prenom,
        classeNom: classes.nom,
        statut: fichesGrandOral.statut,
        question1: fichesGrandOral.question1,
        soumisAt: fichesGrandOral.soumisAt,
      })
      .from(fichesGrandOral)
      .innerJoin(eleves, eq(fichesGrandOral.eleveId, eleves.id))
      .leftJoin(classes, eq(eleves.classeId, classes.id));

    const fichesList = allFiches.map((f) => ({
      ...f,
      specialites: null,
      profSpe1: null,
      profSpe2: null,
    }));

    const total = fichesList.length;
    const brouillons = fichesList.filter((f) => f.statut === "brouillon").length;
    const finalises = fichesList.filter((f) => f.statut === "finalise").length;
    const enAttente = total - brouillons - finalises;

    return Response.json({
      fiches: fichesList,
      stats: { total, brouillons, enAttente, finalises },
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/grand-oral",
};
