import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { eleves, classes, importLogs } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";

export default async (req: Request) => {
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });

  const body = await req.json();
  const rows = body.rows as Array<{
    nom: string;
    prenom: string;
    classe: string;
    emailEleve?: string;
    emailFamille?: string;
    telephoneFamille?: string;
    dateNaissance?: string;
  }>;

  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ imported: 0, doublons: 0, erreurs: 0 });
  }

  let imported = 0;
  let doublons = 0;
  let erreurs = 0;

  for (const row of rows) {
    try {
      let classeRows = await db
        .select()
        .from(classes)
        .where(eq(classes.nom, row.classe))
        .limit(1);

      if (classeRows.length === 0) {
        const niveau = row.classe.toLowerCase().includes("term")
          ? "terminale"
          : row.classe.toLowerCase().includes("1")
            ? "premiere"
            : "seconde";

        const [newClasse] = await db
          .insert(classes)
          .values({ nom: row.classe, niveau })
          .returning();
        classeRows = [newClasse];
      }

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
        const code = `${row.nom.toUpperCase()}-${row.classe.replace(/\s+/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

        await db.insert(eleves).values({
          nom: row.nom,
          prenom: row.prenom,
          classeId: classeRows[0].id,
          emailEleve: row.emailEleve || null,
          emailFamille: row.emailFamille || null,
          telephoneFamille: row.telephoneFamille || null,
          dateNaissance: row.dateNaissance || null,
          codeAcces: code,
        });

        await db.insert(stages as any).values({
          eleveId: (await db.select({ id: eleves.id }).from(eleves).where(eq(eleves.codeAcces, code)).limit(1))[0].id,
          statut: "a_completer",
        } as any);

        imported++;
      }
    } catch {
      erreurs++;
    }
  }

  await db.insert(importLogs).values({
    type: "eleves",
    fichierNom: "csv_import",
    nbImportes: imported,
    nbDoublons: doublons,
    nbErreurs: erreurs,
  });

  return Response.json({ imported, doublons, erreurs });
};

export const config: Config = {
  path: "/api/import/eleves",
};
