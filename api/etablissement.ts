import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { etablissement } from "../db/schema.js";
import { handleApi, methodNotAllowed } from "./_shared/response.js";
import { requireRole, requireUser } from "./_shared/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      // Lecture autorisée pour tous les utilisateurs connectés
      await requireUser(req);

      const rows = await db.select().from(etablissement).limit(1);
      if (rows.length === 0) {
        const [inserted] = await db.insert(etablissement).values({}).returning();
        return inserted;
      }
      return rows[0];
    });
  }

  if (req.method === "POST") {
    return handleApi(res, async () => {
      // Écriture réservée aux admins et au proviseur
      await requireRole(req, ["superadmin", "administration", "proviseur"]);

      const body = req.body as Record<string, unknown>;
      const rows = await db.select().from(etablissement).limit(1);

      if (rows.length === 0) {
        const [inserted] = await db
          .insert(etablissement)
          .values(body as typeof etablissement.$inferInsert)
          .returning();
        return inserted;
      }

      const [updated] = await db
        .update(etablissement)
        .set({
          nom: body.nom as string,
          adresse: body.adresse as string,
          codePostal: body.codePostal as string,
          ville: body.ville as string,
          telephone: body.telephone as string,
          email: body.email as string,
          uai: body.uai as string,
          nomProviseur: body.nomProviseur as string,
          civiliteProviseur: body.civiliteProviseur as string,
          anneeScolaire: body.anneeScolaire as string,
          dateStageDebut: body.dateStageDebut as string,
          dateStageFin: body.dateStageFin as string,
          dateLimiteConvention: body.dateLimiteConvention as string,
          dateGoDebut: body.dateGoDebut as string,
          dateGoFin: body.dateGoFin as string,
          updatedAt: new Date(),
        })
        .where(eq(etablissement.id, rows[0].id))
        .returning();

      return updated;
    });
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}
