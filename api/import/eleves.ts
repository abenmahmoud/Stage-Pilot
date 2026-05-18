import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { eleves, classes, stages, importLogs } from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireRole } from "../_shared/auth.js";

type EleveRow = {
  nom: string;
  prenom: string;
  classe: string;
  emailEleve?: string;
  emailFamille?: string;
  telephoneFamille?: string;
  dateNaissance?: string;
};

function detectNiveau(classeNom: string): string {
  const lc = classeNom.toLowerCase();
  if (lc.includes("term")) return "terminale";
  if (lc.includes("1") || lc.includes("première") || lc.includes("premiere"))
    return "premiere";
  return "seconde";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  await handleApi(res, async () => {
    const user = await requireRole(req, ["superadmin", "administration"]);

    const body = (req.body ?? {}) as { rows?: EleveRow[] };
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
        // Récupérer ou créer la classe
        let classeRows = await db
          .select()
          .from(classes)
          .where(eq(classes.nom, row.classe))
          .limit(1);

        if (classeRows.length === 0) {
          const [newClasse] = await db
            .insert(classes)
            .values({ nom: row.classe, niveau: detectNiveau(row.classe) })
            .returning();
          classeRows = [newClasse];
        }

        // Doublon ?
        const existing = await db
          .select()
          .from(eleves)
          .where(
            and(
              eq(eleves.nom, row.nom),
              eq(eleves.prenom, row.prenom),
              eq(eleves.classeId, classeRows[0].id)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(eleves)
            .set({
              emailEleve: row.emailEleve || existing[0].emailEleve,
              emailFamille: row.emailFamille || existing[0].emailFamille,
              telephoneFamille: row.telephoneFamille || existing[0].telephoneFamille,
              dateNaissance: row.dateNaissance || existing[0].dateNaissance,
              updatedAt: new Date(),
            })
            .where(eq(eleves.id, existing[0].id));
          doublons++;
        } else {
          const code = `${row.nom.toUpperCase()}-${row.classe.replace(
            /\s+/g,
            ""
          )}-${Math.floor(1000 + Math.random() * 9000)}`;

          const [newEleve] = await db
            .insert(eleves)
            .values({
              nom: row.nom,
              prenom: row.prenom,
              classeId: classeRows[0].id,
              emailEleve: row.emailEleve || null,
              emailFamille: row.emailFamille || null,
              telephoneFamille: row.telephoneFamille || null,
              dateNaissance: row.dateNaissance || null,
              codeAcces: code,
            })
            .returning();

          // Créer un stage vide associé
          await db.insert(stages).values({
            eleveId: newEleve.id,
            statut: "a_completer",
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
      type: "eleves",
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
