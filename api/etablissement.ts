import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { etablissement } from "../db/schema.js";
import { parseEtablissementInput } from "../shared/etablissement-input.js";
import { handleApi, methodNotAllowed } from "./_shared/response.js";
import { HttpError, requireRole, requireUser } from "./_shared/auth.js";

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

      let input;
      try {
        input = parseEtablissementInput(req.body);
      } catch (error) {
        throw new HttpError(400, error instanceof Error ? error.message : "Paramètres invalides.");
      }
      const rows = await db.select().from(etablissement).limit(1);

      if (rows.length === 0) {
        const [inserted] = await db
          .insert(etablissement)
          .values(input)
          .returning();
        return inserted;
      }

      const [updated] = await db
        .update(etablissement)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(etablissement.id, rows[0].id))
        .returning();

      return updated;
    });
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}

export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };
