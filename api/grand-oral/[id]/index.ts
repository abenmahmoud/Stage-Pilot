import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { fichesGrandOral, eleves, classes } from "../../../db/schema.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { requireUser, HttpError } from "../../_shared/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  await handleApi(res, async () => {
    await requireUser(req);

    const ficheId = (req.query.id as string) || "";
    if (!ficheId || !/^[0-9a-fA-F-]{36}$/.test(ficheId)) {
      throw new HttpError(400, "Identifiant fiche invalide");
    }

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

    if (result.length === 0) throw new HttpError(404, "Fiche introuvable");
    return { ...result[0], profSpe1: null, profSpe2: null };
  });
}
