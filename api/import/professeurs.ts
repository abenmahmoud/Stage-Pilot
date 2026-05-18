import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../db/index.js";
import { professeurs, importLogs } from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireRole } from "../_shared/auth.js";

type ProfRow = {
  nom: string;
  prenom: string;
  email?: string;
  matieres?: string;
};

function normaliseCleNom(nom: string, prenom: string): string {
  return `${nom.trim().toUpperCase()}|${prenom.trim().toUpperCase()}`;
}

function slugNom(nom: string): string {
  const slug = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
  return slug || "PROF";
}

function genererCodeProf(nom: string, usedCodes: Set<string>): string {
  const base = slugNom(nom);

  for (let attempt = 0; attempt < 50; attempt++) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    const code = `${base}-PROF-${rand}`;
    if (!usedCodes.has(code)) {
      usedCodes.add(code);
      return code;
    }
  }

  throw new Error("Impossible de générer un code d'accès unique");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  await handleApi(res, async () => {
    const user = await requireRole(req, ["superadmin", "administration"]);

    const body = (req.body ?? {}) as { rows?: ProfRow[] };
    const rows = body.rows ?? [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return { imported: 0, doublons: 0, erreurs: 0, detailErreurs: [] };
    }

    let imported = 0;
    let doublons = 0;
    let erreurs = 0;
    const erreursDetails: Array<{ ligne: number; raison: string }> = [];

    const existants = await db.select().from(professeurs);
    const existantsParEmail = new Map(
      existants
        .filter((p) => p.email)
        .map((p) => [(p.email as string).toLowerCase(), p])
    );
    const existantsParNom = new Map(
      existants.map((p) => [normaliseCleNom(p.nom, p.prenom), p])
    );
    const usedCodes = new Set(
      existants
        .map((p) => p.codeAcces)
        .filter((code): code is string => Boolean(code))
    );

    const profsAcreer: Array<typeof professeurs.$inferInsert> = [];
    const seenNomsInBatch = new Set<string>();
    const seenEmailsInBatch = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const nom = row.nom?.trim();
        const prenom = row.prenom?.trim();
        if (!nom || !prenom) {
          erreurs++;
          erreursDetails.push({ ligne: i + 1, raison: "Nom ou prénom manquant" });
          continue;
        }

        const email = row.email?.trim() || null;
        const emailLower = email?.toLowerCase() ?? null;
        const cleNom = normaliseCleNom(nom, prenom);

        if (
          (emailLower &&
            (existantsParEmail.has(emailLower) ||
              seenEmailsInBatch.has(emailLower))) ||
          existantsParNom.has(cleNom) ||
          seenNomsInBatch.has(cleNom)
        ) {
          doublons++;
          continue;
        }

        seenNomsInBatch.add(cleNom);
        if (emailLower) seenEmailsInBatch.add(emailLower);

        profsAcreer.push({
          nom,
          prenom,
          email,
          matieres: row.matieres?.trim() || null,
          codeAcces: genererCodeProf(nom, usedCodes),
        });
      } catch (err) {
        erreurs++;
        erreursDetails.push({
          ligne: i + 1,
          raison: err instanceof Error ? err.message : "Erreur inconnue",
        });
      }
    }

    const BATCH_SIZE = 50;
    for (let i = 0; i < profsAcreer.length; i += BATCH_SIZE) {
      const batch = profsAcreer.slice(i, i + BATCH_SIZE);
      const inserted = await db
        .insert(professeurs)
        .values(batch)
        .returning({ id: professeurs.id });
      imported += inserted.length;
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

    return {
      imported,
      doublons,
      erreurs,
      detailErreurs: erreursDetails.slice(0, 10),
    };
  });
}
