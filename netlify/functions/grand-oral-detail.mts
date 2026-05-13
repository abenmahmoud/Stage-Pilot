import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { fichesGrandOral, eleves, classes, professeurs } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export default async (req: Request, context: { params: { id: string } }) => {
  const ficheId = parseInt(context.params.id);
  if (isNaN(ficheId)) return new Response("Invalid ID", { status: 400 });

  if (req.method === "GET") {
    const result = await db
      .select({
        id: fichesGrandOral.id,
        eleveNom: eleves.nom,
        elevePrenom: eleves.prenom,
        classeNom: classes.nom,
        numeroCanditat: fichesGrandOral.numeroCanditat,
        statut: fichesGrandOral.statut,
        question1: fichesGrandOral.question1,
        specialitesQuestion1: fichesGrandOral.specialitesQuestion1,
        question2: fichesGrandOral.question2,
        specialitesQuestion2: fichesGrandOral.specialitesQuestion2,
        commentaireProf1: fichesGrandOral.commentaireProf1,
        commentaireProf2: fichesGrandOral.commentaireProf2,
        signeProf1At: fichesGrandOral.signeProf1At,
        signeProf2At: fichesGrandOral.signeProf2At,
        cachetApposeAt: fichesGrandOral.cachetApposeAt,
      })
      .from(fichesGrandOral)
      .innerJoin(eleves, eq(fichesGrandOral.eleveId, eleves.id))
      .leftJoin(classes, eq(eleves.classeId, classes.id))
      .where(eq(fichesGrandOral.id, ficheId))
      .limit(1);

    if (result.length === 0) {
      return new Response("Not found", { status: 404 });
    }

    return Response.json({ ...result[0], profSpe1: null, profSpe2: null });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/grand-oral/:id",
};
