import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { professeurs, importLogs } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export default async (req: Request) => {
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });

  const body = await req.json();
  const rows = body.rows as Array<{
    nom: string;
    prenom: string;
    email: string;
    matieres?: string;
  }>;

  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ imported: 0, doublons: 0, erreurs: 0 });
  }

  let imported = 0;
  let doublons = 0;
  let erreurs = 0;

  for (const row of rows) {
    try {
      const existing = await db
        .select()
        .from(professeurs)
        .where(eq(professeurs.email, row.email))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(professeurs)
          .set({
            nom: row.nom,
            prenom: row.prenom,
            matieres: row.matieres || existing[0].matieres,
          })
          .where(eq(professeurs.id, existing[0].id));
        doublons++;
      } else {
        await db.insert(professeurs).values({
          nom: row.nom,
          prenom: row.prenom,
          email: row.email,
          matieres: row.matieres || null,
        });
        imported++;
      }
    } catch {
      erreurs++;
    }
  }

  await db.insert(importLogs).values({
    type: "professeurs",
    fichierNom: "csv_import",
    nbImportes: imported,
    nbDoublons: doublons,
    nbErreurs: erreurs,
  });

  return Response.json({ imported, doublons, erreurs });
};

export const config: Config = {
  path: "/api/import/professeurs",
};
