import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, inArray, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  fichesGrandOral,
  eleves,
  classes,
  professeurs,
} from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireUser, HttpError } from "../_shared/auth.js";
import { isGrandOralModuleActive } from "../_shared/modules.js";

const ANNEE_SCOLAIRE = "2025-2026";

type FicheSelect = typeof fichesGrandOral.$inferSelect;

type ProfesseurLookup = {
  id: string;
  authUserId: string | null;
  nom: string;
  prenom: string;
  matieres: string | null;
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function profLabel(prof: ProfesseurLookup | undefined): string | null {
  if (!prof) return null;
  return `${prof.nom} ${prof.prenom}${prof.matieres ? ` - ${prof.matieres}` : ""}`;
}

async function loadProfesseursByReference(values: Array<string | null>) {
  const references = Array.from(new Set(values.filter(Boolean))) as string[];
  const map = new Map<string, ProfesseurLookup>();
  if (references.length === 0) return map;

  const rows = await db
    .select({
      id: professeurs.id,
      authUserId: professeurs.authUserId,
      nom: professeurs.nom,
      prenom: professeurs.prenom,
      matieres: professeurs.matieres,
    })
    .from(professeurs)
    .where(
      or(
        inArray(professeurs.id, references),
        inArray(professeurs.authUserId, references)
      )
    );

  for (const prof of rows) {
    map.set(prof.id, prof);
    if (prof.authUserId) map.set(prof.authUserId, prof);
  }

  return map;
}

async function serializeFiche(fiche: FicheSelect, moduleActif = true) {
  const profMap = await loadProfesseursByReference([
    fiche.profSpe1Id,
    fiche.profSpe2Id,
  ]);

  return {
    ...fiche,
    moduleActif,
    profSpe1: fiche.profSpe1Id ? profLabel(profMap.get(fiche.profSpe1Id)) : null,
    profSpe2: fiche.profSpe2Id ? profLabel(profMap.get(fiche.profSpe2Id)) : null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  await handleApi(res, async () => {
    const user = await requireUser(req);

    const eleveRows = await db
      .select({
        id: eleves.id,
        classeNiveau: classes.niveau,
      })
      .from(eleves)
      .leftJoin(classes, eq(eleves.classeId, classes.id))
      .where(eq(eleves.authUserId, user.id))
      .limit(1);

    if (eleveRows.length === 0) {
      return {
        id: null,
        statut: "brouillon",
        question1: "",
        question2: "",
        specialitesQuestion1: "",
        specialitesQuestion2: "",
        numeroCanditat: "",
        profSpe1Id: null,
        profSpe2Id: null,
        profSpe1: null,
        profSpe2: null,
        fichePdfUrl: null,
      };
    }

    const eleve = eleveRows[0];
    const ficheRows = await db
      .select()
      .from(fichesGrandOral)
      .where(eq(fichesGrandOral.eleveId, eleve.id))
      .limit(1);

    const existingFiche = ficheRows[0] ?? null;
    const moduleActif = isGrandOralModuleActive(
      eleve.classeNiveau,
      existingFiche?.statut
    );

    if (req.method === "GET") {
      if (!moduleActif) {
        return {
          moduleActif: false,
          id: existingFiche?.id ?? null,
          statut: "module_desactive",
          question1: "",
          question2: "",
          specialitesQuestion1: "",
          specialitesQuestion2: "",
          profSpe1Id: null,
          profSpe2Id: null,
          profSpe1: null,
          profSpe2: null,
          fichePdfUrl: null,
        };
      }

      if (!existingFiche) {
        return {
          moduleActif: true,
          id: null,
          statut: "brouillon",
          question1: "",
          question2: "",
          specialitesQuestion1: "",
          specialitesQuestion2: "",
          numeroCanditat: "",
          profSpe1Id: null,
          profSpe2Id: null,
          profSpe1: null,
          profSpe2: null,
          fichePdfUrl: null,
        };
      }
      return serializeFiche(existingFiche, true);
    }

    if (!moduleActif) {
      throw new HttpError(
        403,
        "Le module Grand Oral n'est pas activé pour cet élève."
      );
    }

    // POST
    const body = (req.body ?? {}) as Record<string, unknown>;
    const submit = body.submit === true;
    const question1 = normalizeText(body.question1);
    const question2 = normalizeText(body.question2);
    const specialitesQuestion1 = normalizeText(body.specialitesQuestion1);
    const specialitesQuestion2 = normalizeText(body.specialitesQuestion2);
    const numeroCanditat = normalizeText(body.numeroCanditat);

    if (existingFiche && existingFiche.statut !== "brouillon") {
      throw new HttpError(
        400,
        "La fiche est deja soumise. Elle n'est plus modifiable par l'eleve."
      );
    }

    if (
      submit &&
      (!question1 || !question2 || !specialitesQuestion1 || !specialitesQuestion2)
    ) {
      throw new HttpError(
        400,
        "Complete les specialites et les deux questions avant de soumettre."
      );
    }

    if (submit && !existingFiche?.profSpe1Id) {
      throw new HttpError(
        400,
        "L'administration doit d'abord affecter un professeur de specialite."
      );
    }

    const ficheData = {
      statut: (submit ? "soumis_prof1" : "brouillon") as string,
      question1,
      specialitesQuestion1,
      question2,
      specialitesQuestion2,
      numeroCanditat,
      updatedAt: new Date(),
      ...(submit ? { soumisAt: new Date() } : {}),
    };

    if (existingFiche) {
      const [updated] = await db
        .update(fichesGrandOral)
        .set(ficheData)
        .where(eq(fichesGrandOral.id, existingFiche.id))
        .returning();
      return serializeFiche(updated, true);
    }

    const [inserted] = await db
      .insert(fichesGrandOral)
      .values({
        ...ficheData,
        eleveId: eleve.id,
        anneeScolaire: ANNEE_SCOLAIRE,
      })
      .returning();
    return serializeFiche(inserted, true);
  });
}
