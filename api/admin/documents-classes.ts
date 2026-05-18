import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  classes,
  eleves,
  fichesGrandOral,
  stages,
} from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireRole } from "../_shared/auth.js";

type DocumentType = "stage" | "grand_oral";

type PdfDocument = {
  id: string;
  type: DocumentType;
  eleveId: string;
  eleveNom: string;
  elevePrenom: string;
  classeId: string | null;
  classeNom: string | null;
  statut: string;
  pdfUrl: string;
  generatedAt: Date | null;
};

type ClasseDocuments = {
  id: string;
  nom: string;
  niveau: string;
  totalEleves: number;
  stageFinalises: number;
  goFinalises: number;
  documents: PdfDocument[];
};

function isUsablePdfUrl(value: string | null): value is string {
  return Boolean(value?.trim());
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  await handleApi(res, async () => {
    await requireRole(req, ["superadmin", "administration"]);

    const classeRows = await db
      .select({
        id: classes.id,
        nom: classes.nom,
        niveau: classes.niveau,
      })
      .from(classes)
      .orderBy(asc(classes.niveau), asc(classes.nom));

    const classeMap = new Map<string, ClasseDocuments>();
    for (const classe of classeRows) {
      classeMap.set(classe.id, {
        ...classe,
        totalEleves: 0,
        stageFinalises: 0,
        goFinalises: 0,
        documents: [],
      });
    }

    const eleveRows = await db
      .select({
        id: eleves.id,
        classeId: eleves.classeId,
      })
      .from(eleves);

    for (const eleve of eleveRows) {
      if (!eleve.classeId) continue;
      const classe = classeMap.get(eleve.classeId);
      if (classe) classe.totalEleves += 1;
    }

    const stageRows = await db
      .select({
        id: stages.id,
        statut: stages.statut,
        pdfUrl: stages.conventionPdfUrl,
        generatedAt: stages.conventionGenereeAt,
        eleveId: eleves.id,
        eleveNom: eleves.nom,
        elevePrenom: eleves.prenom,
        classeId: classes.id,
        classeNom: classes.nom,
      })
      .from(stages)
      .innerJoin(eleves, eq(stages.eleveId, eleves.id))
      .leftJoin(classes, eq(eleves.classeId, classes.id))
      .orderBy(asc(classes.nom), asc(eleves.nom), asc(eleves.prenom));

    for (const row of stageRows) {
      if (!isUsablePdfUrl(row.pdfUrl)) continue;
      if (!row.classeId) continue;
      const classe = classeMap.get(row.classeId);
      if (!classe) continue;

      classe.stageFinalises += 1;
      classe.documents.push({
        id: row.id,
        type: "stage",
        eleveId: row.eleveId,
        eleveNom: row.eleveNom,
        elevePrenom: row.elevePrenom,
        classeId: row.classeId,
        classeNom: row.classeNom,
        statut: row.statut,
        pdfUrl: row.pdfUrl,
        generatedAt: row.generatedAt,
      });
    }

    const goRows = await db
      .select({
        id: fichesGrandOral.id,
        statut: fichesGrandOral.statut,
        pdfUrl: fichesGrandOral.fichePdfUrl,
        generatedAt: fichesGrandOral.pdfGenereAt,
        eleveId: eleves.id,
        eleveNom: eleves.nom,
        elevePrenom: eleves.prenom,
        classeId: classes.id,
        classeNom: classes.nom,
      })
      .from(fichesGrandOral)
      .innerJoin(eleves, eq(fichesGrandOral.eleveId, eleves.id))
      .leftJoin(classes, eq(eleves.classeId, classes.id))
      .orderBy(asc(classes.nom), asc(eleves.nom), asc(eleves.prenom));

    for (const row of goRows) {
      if (!isUsablePdfUrl(row.pdfUrl)) continue;
      if (!row.classeId) continue;
      const classe = classeMap.get(row.classeId);
      if (!classe) continue;

      classe.goFinalises += 1;
      classe.documents.push({
        id: row.id,
        type: "grand_oral",
        eleveId: row.eleveId,
        eleveNom: row.eleveNom,
        elevePrenom: row.elevePrenom,
        classeId: row.classeId,
        classeNom: row.classeNom,
        statut: row.statut,
        pdfUrl: row.pdfUrl,
        generatedAt: row.generatedAt,
      });
    }

    const classesWithDocuments = Array.from(classeMap.values());
    const totalDocuments = classesWithDocuments.reduce(
      (sum, classe) => sum + classe.documents.length,
      0
    );

    return {
      totalClasses: classesWithDocuments.length,
      totalDocuments,
      classes: classesWithDocuments,
    };
  });
}
