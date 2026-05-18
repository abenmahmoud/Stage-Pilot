import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc, eq, isNotNull } from "drizzle-orm";
import { db } from "../../db/index.js";
import { classes, professeurs } from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireRole, HttpError } from "../_shared/auth.js";

type UpdateBody = {
  classeId?: string;
  ppId?: string | null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "PUT") {
    return methodNotAllowed(res, ["GET", "PUT"]);
  }

  await handleApi(res, async () => {
    await requireRole(req, ["superadmin", "administration"]);

    if (req.method === "GET") {
      const classeRows = await db
        .select({
          id: classes.id,
          nom: classes.nom,
          niveau: classes.niveau,
          ppAuthUserId: classes.professeurPrincipalId,
          ppProfesseurId: professeurs.id,
          ppNom: professeurs.nom,
          ppPrenom: professeurs.prenom,
        })
        .from(classes)
        .leftJoin(
          professeurs,
          eq(classes.professeurPrincipalId, professeurs.authUserId)
        )
        .orderBy(asc(classes.niveau), asc(classes.nom));

      const profRows = await db
        .select({
          id: professeurs.id,
          authUserId: professeurs.authUserId,
          nom: professeurs.nom,
          prenom: professeurs.prenom,
          matieres: professeurs.matieres,
        })
        .from(professeurs)
        .where(isNotNull(professeurs.authUserId))
        .orderBy(asc(professeurs.nom), asc(professeurs.prenom));

      return {
        classes: classeRows,
        professeurs: profRows,
      };
    }

    const body = (req.body ?? {}) as UpdateBody;
    const classeId = body.classeId?.trim();
    const ppId = body.ppId?.trim() || null;

    if (!classeId) {
      throw new HttpError(400, "Classe manquante.");
    }

    let ppAuthUserId: string | null = null;
    if (ppId) {
      const [prof] = await db
        .select({
          authUserId: professeurs.authUserId,
        })
        .from(professeurs)
        .where(eq(professeurs.id, ppId))
        .limit(1);

      if (!prof || !prof.authUserId) {
        throw new HttpError(
          400,
          "Ce professeur n'a pas encore de compte auth. Génère d'abord les comptes professeurs."
        );
      }

      ppAuthUserId = prof.authUserId;
    }

    const [updated] = await db
      .update(classes)
      .set({ professeurPrincipalId: ppAuthUserId })
      .where(eq(classes.id, classeId))
      .returning({ id: classes.id });

    if (!updated) {
      throw new HttpError(404, "Classe introuvable.");
    }

    return { ok: true };
  });
}
