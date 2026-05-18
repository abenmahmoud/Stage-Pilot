import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, asc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { eleves, classes } from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireRole, HttpError } from "../_shared/auth.js";

/**
 * Liste les codes d'accès des élèves pour génération PDF d'étiquettes.
 *
 * Query params:
 *   - classe: filtrer par nom de classe (ex: "2E1") ou "all"
 *   - niveau: filtrer par niveau (seconde / premiere / terminale / all)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  await handleApi(res, async () => {
    await requireRole(req, ["superadmin", "administration"]);

    const classeFilter = (req.query.classe as string) || "all";
    const niveauFilter = (req.query.niveau as string) || "all";

    let rows = await db
      .select({
        id: eleves.id,
        nom: eleves.nom,
        prenom: eleves.prenom,
        codeAcces: eleves.codeAcces,
        classeNom: classes.nom,
        classeNiveau: classes.niveau,
      })
      .from(eleves)
      .leftJoin(classes, eq(eleves.classeId, classes.id))
      .orderBy(asc(classes.nom), asc(eleves.nom), asc(eleves.prenom));

    if (classeFilter !== "all") {
      rows = rows.filter((r) => r.classeNom === classeFilter);
    }
    if (niveauFilter !== "all") {
      rows = rows.filter((r) => r.classeNiveau === niveauFilter);
    }

    // Bloque les exports trop massifs sans filtre (sécurité)
    if (rows.length > 1500) {
      throw new HttpError(400, "Trop de résultats. Filtre par classe ou niveau.");
    }

    // Stats par classe pour l'UI
    const parClasse = new Map<string, number>();
    for (const r of rows) {
      const k = r.classeNom ?? "—";
      parClasse.set(k, (parClasse.get(k) ?? 0) + 1);
    }

    return {
      total: rows.length,
      eleves: rows,
      parClasse: Array.from(parClasse.entries()).map(([nom, nb]) => ({ nom, nb })),
    };
  });
}
