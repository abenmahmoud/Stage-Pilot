import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { fichesGrandOral, eleves, classes } from "../../../db/schema.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { requireRole, HttpError } from "../../_shared/auth.js";
import {
  canReadGrandOralForUser,
  canSignGrandOralForUser,
  getGrandOralRoleForUser,
  getProfesseurIdForUser,
} from "../../_shared/access.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  await handleApi(res, async () => {
    const user = await requireRole(req, [
      "superadmin",
      "administration",
      "pp",
      "professeur",
    ]);
    const professeurId = await getProfesseurIdForUser(user);

    const ficheId = (req.query.id as string) || "";
    if (!ficheId || !/^[0-9a-fA-F-]{36}$/.test(ficheId)) {
      throw new HttpError(400, "Identifiant fiche invalide");
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const comment = typeof body.comment === "string" ? body.comment : null;

    const fiches = await db
      .select({
        id: fichesGrandOral.id,
        statut: fichesGrandOral.statut,
        profSpe1Id: fichesGrandOral.profSpe1Id,
        profSpe2Id: fichesGrandOral.profSpe2Id,
        signeProf1At: fichesGrandOral.signeProf1At,
        signeProf2At: fichesGrandOral.signeProf2At,
        eleveAuthUserId: eleves.authUserId,
        professeurPrincipalId: classes.professeurPrincipalId,
      })
      .from(fichesGrandOral)
      .innerJoin(eleves, eq(fichesGrandOral.eleveId, eleves.id))
      .leftJoin(classes, eq(eleves.classeId, classes.id))
      .where(eq(fichesGrandOral.id, ficheId))
      .limit(1);

    if (fiches.length === 0) throw new HttpError(404, "Fiche introuvable");

    const fiche = fiches[0];
    if (!canReadGrandOralForUser(fiche, user, professeurId)) {
      throw new HttpError(403, "Acces interdit a cette fiche Grand Oral");
    }

    const currentRole = getGrandOralRoleForUser(fiche, user, professeurId);
    if (!currentRole) {
      throw new HttpError(
        403,
        "Vous n'etes pas professeur de specialite sur cette fiche."
      );
    }
    if (!canSignGrandOralForUser(fiche, user, professeurId)) {
      if (fiche.statut === "brouillon") {
        throw new HttpError(
          400,
          "La fiche est encore en brouillon. L'eleve doit la soumettre avant validation."
        );
      }
      throw new HttpError(400, "Cette fiche n'est pas a valider a cette etape.");
    }

    const now = new Date();
    const updateData =
      currentRole === "prof_spe1"
        ? {
            statut: fiche.profSpe2Id ? "soumis_prof2" : "soumis_proviseur",
            commentaireProf1: comment,
            signeProf1At: now,
          }
        : {
            statut: "soumis_proviseur",
            commentaireProf2: comment,
            signeProf2At: now,
          };

    const [updated] = await db
      .update(fichesGrandOral)
      .set(updateData)
      .where(eq(fichesGrandOral.id, ficheId))
      .returning();

    return updated;
  });
}
