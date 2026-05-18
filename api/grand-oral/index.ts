import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { fichesGrandOral, eleves, classes } from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireRole } from "../_shared/auth.js";
import { isGrandOralModuleActive } from "../_shared/modules.js";
import {
  canReadGrandOralForUser,
  getProfesseurIdForUser,
} from "../_shared/access.js";

const ANNEE_SCOLAIRE = "2025-2026";

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

    const allRows = await db
      .select({
        id: fichesGrandOral.id,
        eleveId: eleves.id,
        eleveNom: eleves.nom,
        elevePrenom: eleves.prenom,
        eleveAuthUserId: eleves.authUserId,
        classeNom: classes.nom,
        classeNiveau: classes.niveau,
        professeurPrincipalId: classes.professeurPrincipalId,
        statut: fichesGrandOral.statut,
        profSpe1Id: fichesGrandOral.profSpe1Id,
        profSpe2Id: fichesGrandOral.profSpe2Id,
        question1: fichesGrandOral.question1,
        soumisAt: fichesGrandOral.soumisAt,
      })
      .from(eleves)
      .leftJoin(classes, eq(eleves.classeId, classes.id))
      .leftJoin(
        fichesGrandOral,
        and(
          eq(fichesGrandOral.eleveId, eleves.id),
          eq(fichesGrandOral.anneeScolaire, ANNEE_SCOLAIRE)
        )
      )
      .orderBy(asc(classes.nom), asc(eleves.nom), asc(eleves.prenom));

    const fichesList = allRows
      .filter((f) => isGrandOralModuleActive(f.classeNiveau, f.statut))
      .filter((f) => canReadGrandOralForUser(f, user, professeurId))
      .map((f) => ({
        ...f,
        statut: f.statut ?? "brouillon",
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
