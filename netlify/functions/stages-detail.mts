import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { stages, eleves, classes } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export default async (req: Request, context: { params: { id: string } }) => {
  const eleveId = parseInt(context.params.id);
  if (isNaN(eleveId)) return new Response("Invalid ID", { status: 400 });

  const result = await db
    .select({
      id: stages.id,
      eleveNom: eleves.nom,
      elevePrenom: eleves.prenom,
      classeNom: classes.nom,
      statut: stages.statut,
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
    return new Response("Not found", { status: 404 });
  }

  return Response.json({ ...result[0], professeurReferent: null });
};

export const config: Config = {
  path: "/api/stages/:id",
};
