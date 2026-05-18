import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { professeurs } from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireRole, HttpError } from "../_shared/auth.js";

function splitMatieres(value: string | null): string[] {
  if (!value) return ["—"];
  const parts = value
    .split(/[,;/|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : ["—"];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  await handleApi(res, async () => {
    await requireRole(req, ["superadmin", "administration"]);

    const matiereFilter = (req.query.matiere as string) || "all";

    let rows = await db
      .select({
        id: professeurs.id,
        nom: professeurs.nom,
        prenom: professeurs.prenom,
        codeAcces: professeurs.codeAcces,
        matieres: professeurs.matieres,
        email: professeurs.email,
      })
      .from(professeurs)
      .orderBy(asc(professeurs.nom), asc(professeurs.prenom));

    if (matiereFilter !== "all") {
      rows = rows.filter((r) => splitMatieres(r.matieres).includes(matiereFilter));
    }

    if (rows.length > 500) {
      throw new HttpError(400, "Trop de résultats. Filtre par matière.");
    }

    const parMatiere = new Map<string, number>();
    for (const r of rows) {
      for (const matiere of splitMatieres(r.matieres)) {
        parMatiere.set(matiere, (parMatiere.get(matiere) ?? 0) + 1);
      }
    }

    return {
      total: rows.length,
      profs: rows,
      parMatiere: Array.from(parMatiere.entries()).map(([nom, nb]) => ({
        nom,
        nb,
      })),
    };
  });
}
