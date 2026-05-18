import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { fichesGrandOral } from "../../../db/schema.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { requireRole, HttpError } from "../../_shared/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  await handleApi(res, async () => {
    await requireRole(req, ["superadmin", "administration", "pp", "professeur"]);

    const ficheId = (req.query.id as string) || "";
    if (!ficheId || !/^[0-9a-fA-F-]{36}$/.test(ficheId)) {
      throw new HttpError(400, "Identifiant fiche invalide");
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const comment = typeof body.comment === "string" ? body.comment : null;

    const fiches = await db
      .select()
      .from(fichesGrandOral)
      .where(eq(fichesGrandOral.id, ficheId))
      .limit(1);

    if (fiches.length === 0) throw new HttpError(404, "Fiche introuvable");

    const fiche = fiches[0];
    const now = new Date();

    let updateData: Record<string, unknown> = {};

    if (fiche.statut === "soumis_prof1") {
      updateData = {
        statut: fiche.profSpe2Id ? "soumis_prof2" : "soumis_proviseur",
        commentaireProf1: comment,
        signeProf1At: now,
      };
    } else if (fiche.statut === "soumis_prof2") {
      updateData = {
        statut: "soumis_proviseur",
        commentaireProf2: comment,
        signeProf2At: now,
      };
    } else {
      throw new HttpError(
        400,
        `Statut '${fiche.statut}' incompatible avec signature prof`
      );
    }

    const [updated] = await db
      .update(fichesGrandOral)
      .set(updateData)
      .where(eq(fichesGrandOral.id, ficheId))
      .returning();

    return updated;
  });
}
