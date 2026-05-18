import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { professeurs, importLogs } from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireRole } from "../_shared/auth.js";

type ProfRow = {
  nom: string;
  prenom: string;
  email: string;
  matieres?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  await handleApi(res, async () => {
    const user = await requireRole(req, ["superadmin", "administration"]);

    const body = (req.body ?? {}) as { rows?: ProfRow[] };
    const rows = body.rows ?? [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return { imported: 0, doublons: 0, erreurs: 0 };
    }

    let imported = 0;
    let doublons = 0;
    let erreurs = 0;
    const erreursDetails: Array<{ ligne: number; raison: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
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
      } catch (err) {
        erreurs++;
        erreursDetails.push({
          ligne: i + 1,
          raison: err instanceof Error ? err.message : "Erreur inconnue",
        });
      }
    }

    await db.insert(importLogs).values({
      type: "professeurs",
      fichierNom: "csv_import",
      nbImportes: imported,
      nbDoublons: doublons,
      nbErreurs: erreurs,
      detailErreurs: erreursDetails.length > 0 ? erreursDetails : null,
      importePar: user.email,
    });

    return { imported, doublons, erreurs };
  });
}
