import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, eq, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  classes,
  eleves,
  fichesGrandOral,
  professeurs,
  stages,
} from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireRole, HttpError } from "../_shared/auth.js";
import {
  MODULE_DESACTIVE,
  isGrandOralModuleActive,
  isStageModuleActive,
  stageStatusWhenActivated,
} from "../_shared/modules.js";

const ANNEE_SCOLAIRE = "2025-2026";

type UpdateBody = {
  eleveId?: string;
  professeurReferentId?: string | null;
  profSpe1Id?: string | null;
  profSpe2Id?: string | null;
  stageActif?: boolean;
  grandOralActif?: boolean;
};

function normalizeId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

type ProfesseurOption = {
  id: string;
  authUserId: string | null;
  nom: string;
  prenom: string;
  matieres: string | null;
};

function normalizeReferentForUi(
  value: string | null,
  professeursRows: ProfesseurOption[]
): string | null {
  if (!value) return null;
  const professeur = professeursRows.find(
    (prof) => prof.id === value || prof.authUserId === value
  );
  return professeur ? professeur.authUserId ?? professeur.id : value;
}

function normalizeGrandOralProfForUi(
  value: string | null,
  professeursRows: ProfesseurOption[]
): string | null {
  if (!value) return null;
  const professeur = professeursRows.find(
    (prof) => prof.id === value || prof.authUserId === value
  );
  return professeur ? professeur.id : value;
}

async function resolveProfesseurCandidates(
  value: string | null,
  notFoundMessage: string
): Promise<string[]> {
  if (!value) return [""];

  const [professeur] = await db
    .select({
      id: professeurs.id,
      authUserId: professeurs.authUserId,
    })
    .from(professeurs)
    .where(or(eq(professeurs.id, value), eq(professeurs.authUserId, value)))
    .limit(1);

  if (!professeur) {
    throw new HttpError(400, notFoundMessage);
  }

  return Array.from(
    new Set([professeur.authUserId, professeur.id].filter(Boolean))
  ) as string[];
}

async function resolveStageReferentCandidates(
  value: string | null
): Promise<string[] | null> {
  return resolveProfesseurCandidates(
    value,
    "Un des professeurs selectionnes est introuvable."
  );
}

async function resolveGrandOralProfCandidates(
  value: string | null
): Promise<string[]> {
  return resolveProfesseurCandidates(
    value,
    "Un des professeurs de specialite selectionnes est introuvable."
  );
}

async function updateStageWithReferentFallback(
  stageId: string,
  updateData: Partial<typeof stages.$inferInsert>,
  professeurReferentCandidates: string[] | null
): Promise<void> {
  if (!professeurReferentCandidates) {
    await db.update(stages).set(updateData).where(eq(stages.id, stageId));
    return;
  }

  let lastError: unknown = null;
  for (const candidate of professeurReferentCandidates) {
    try {
      await db
        .update(stages)
        .set({
          ...updateData,
          professeurReferentId: candidate || null,
        })
        .where(eq(stages.id, stageId));
      return;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw new HttpError(
      400,
      `Affectation du professeur impossible : ${lastError.message}`
    );
  }
  throw new HttpError(400, "Affectation du professeur impossible.");
}

async function insertStageWithReferentFallback(
  insertData: typeof stages.$inferInsert,
  professeurReferentCandidates: string[] | null
): Promise<void> {
  if (!professeurReferentCandidates) {
    await db.insert(stages).values(insertData);
    return;
  }

  let lastError: unknown = null;
  for (const candidate of professeurReferentCandidates) {
    try {
      await db.insert(stages).values({
        ...insertData,
        professeurReferentId: candidate || null,
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw new HttpError(
      400,
      `Affectation du professeur impossible : ${lastError.message}`
    );
  }
  throw new HttpError(400, "Affectation du professeur impossible.");
}

async function updateGrandOralWithProfFallback(
  ficheId: string,
  updateData: Partial<typeof fichesGrandOral.$inferInsert>,
  profSpe1Candidates: string[],
  profSpe2Candidates: string[]
): Promise<void> {
  let lastError: unknown = null;

  for (const profSpe1Candidate of profSpe1Candidates) {
    for (const profSpe2Candidate of profSpe2Candidates) {
      try {
        await db
          .update(fichesGrandOral)
          .set({
            ...updateData,
            profSpe1Id: profSpe1Candidate || null,
            profSpe2Id: profSpe2Candidate || null,
          })
          .where(eq(fichesGrandOral.id, ficheId));
        return;
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (lastError instanceof Error) {
    throw new HttpError(
      400,
      `Affectation Grand Oral impossible : ${lastError.message}`
    );
  }
  throw new HttpError(400, "Affectation Grand Oral impossible.");
}

async function insertGrandOralWithProfFallback(
  insertData: typeof fichesGrandOral.$inferInsert,
  profSpe1Candidates: string[],
  profSpe2Candidates: string[]
): Promise<void> {
  let lastError: unknown = null;

  for (const profSpe1Candidate of profSpe1Candidates) {
    for (const profSpe2Candidate of profSpe2Candidates) {
      try {
        await db.insert(fichesGrandOral).values({
          ...insertData,
          profSpe1Id: profSpe1Candidate || null,
          profSpe2Id: profSpe2Candidate || null,
        });
        return;
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (lastError instanceof Error) {
    throw new HttpError(
      400,
      `Affectation Grand Oral impossible : ${lastError.message}`
    );
  }
  throw new HttpError(400, "Affectation Grand Oral impossible.");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "PUT") {
    return methodNotAllowed(res, ["GET", "PUT"]);
  }

  await handleApi(res, async () => {
    await requireRole(req, ["superadmin", "administration"]);

    if (req.method === "GET") {
      const eleveRows = await db
        .select({
          id: eleves.id,
          nom: eleves.nom,
          prenom: eleves.prenom,
          classeId: eleves.classeId,
          classeNom: classes.nom,
          classeNiveau: classes.niveau,
          professeurReferentId: stages.professeurReferentId,
          stageStatut: stages.statut,
          profSpe1Id: fichesGrandOral.profSpe1Id,
          profSpe2Id: fichesGrandOral.profSpe2Id,
          goStatut: fichesGrandOral.statut,
        })
        .from(eleves)
        .leftJoin(classes, eq(eleves.classeId, classes.id))
        .leftJoin(stages, eq(stages.eleveId, eleves.id))
        .leftJoin(
          fichesGrandOral,
          and(
            eq(fichesGrandOral.eleveId, eleves.id),
            eq(fichesGrandOral.anneeScolaire, ANNEE_SCOLAIRE)
          )
        )
        .orderBy(asc(classes.nom), asc(eleves.nom), asc(eleves.prenom));

      const classeRows = await db
        .select({
          id: classes.id,
          nom: classes.nom,
          niveau: classes.niveau,
        })
        .from(classes)
        .orderBy(asc(classes.niveau), asc(classes.nom));

      const profRows = await db
        .select({
          id: professeurs.id,
          authUserId: professeurs.authUserId,
          nom: professeurs.nom,
          prenom: professeurs.prenom,
          matieres: professeurs.matieres,
        })
        .from(professeurs)
        .orderBy(asc(professeurs.nom), asc(professeurs.prenom));

      return {
        eleves: eleveRows.map((eleve) => ({
          ...eleve,
          professeurReferentId: normalizeReferentForUi(
            eleve.professeurReferentId,
            profRows
          ),
          profSpe1Id: normalizeGrandOralProfForUi(eleve.profSpe1Id, profRows),
          profSpe2Id: normalizeGrandOralProfForUi(eleve.profSpe2Id, profRows),
          stageActif: isStageModuleActive(
            eleve.classeNiveau,
            eleve.stageStatut
          ),
          grandOralActif: isGrandOralModuleActive(
            eleve.classeNiveau,
            eleve.goStatut
          ),
        })),
        classes: classeRows,
        professeurs: profRows,
      };
    }

    const body = (req.body ?? {}) as UpdateBody;
    const eleveId = normalizeId(body.eleveId);
    const professeurReferentId = normalizeId(body.professeurReferentId);
    const profSpe1Id = normalizeId(body.profSpe1Id);
    const profSpe2Id = normalizeId(body.profSpe2Id);
    const hasProfesseurReferent = Object.prototype.hasOwnProperty.call(
      body,
      "professeurReferentId"
    );

    if (!eleveId) {
      throw new HttpError(400, "Élève manquant.");
    }

    const professeurReferentCandidates = hasProfesseurReferent
      ? await resolveStageReferentCandidates(professeurReferentId)
      : null;

    const profSpe1Candidates =
      body.grandOralActif === false
        ? [""]
        : await resolveGrandOralProfCandidates(profSpe1Id);
    const profSpe2Candidates =
      body.grandOralActif === false
        ? [""]
        : await resolveGrandOralProfCandidates(profSpe2Id);

    const [targetEleve] = await db
      .select({
        id: eleves.id,
        classeNiveau: classes.niveau,
      })
      .from(eleves)
      .leftJoin(classes, eq(eleves.classeId, classes.id))
      .where(eq(eleves.id, eleveId))
      .limit(1);

    if (!targetEleve) {
      throw new HttpError(404, "Élève introuvable.");
    }

    const existingStage = await db
      .select({ id: stages.id, statut: stages.statut })
      .from(stages)
      .where(eq(stages.eleveId, eleveId))
      .limit(1);

    if (existingStage.length > 0) {
      const nextStageStatut =
        body.stageActif === false
          ? MODULE_DESACTIVE
          : body.stageActif === true &&
              !isStageModuleActive(
                targetEleve.classeNiveau,
                existingStage[0].statut
              )
            ? stageStatusWhenActivated(targetEleve.classeNiveau)
            : undefined;

      const stageUpdate: Partial<typeof stages.$inferInsert> = {
        ...(nextStageStatut ? { statut: nextStageStatut } : {}),
      };

      if (Object.keys(stageUpdate).length > 0 || professeurReferentCandidates) {
        await updateStageWithReferentFallback(
          existingStage[0].id,
          stageUpdate,
          professeurReferentCandidates
        );
      }
    } else {
      const shouldCreateStage =
        body.stageActif !== false || targetEleve.classeNiveau === "seconde";
      if (shouldCreateStage) {
        await insertStageWithReferentFallback(
          {
            eleveId,
            statut:
              body.stageActif === false
                ? MODULE_DESACTIVE
                : stageStatusWhenActivated(targetEleve.classeNiveau),
          },
          professeurReferentCandidates
        );
      }
    }

    const existingFiche = await db
      .select({ id: fichesGrandOral.id, statut: fichesGrandOral.statut })
      .from(fichesGrandOral)
      .where(
        and(
          eq(fichesGrandOral.eleveId, eleveId),
          eq(fichesGrandOral.anneeScolaire, ANNEE_SCOLAIRE)
        )
      )
      .limit(1);

    if (existingFiche.length > 0) {
      const nextGoStatut =
        body.grandOralActif === false
          ? MODULE_DESACTIVE
          : body.grandOralActif === true &&
              !isGrandOralModuleActive(
                targetEleve.classeNiveau,
                existingFiche[0].statut
              )
            ? "brouillon"
            : undefined;

      await updateGrandOralWithProfFallback(
        existingFiche[0].id,
        {
          ...(nextGoStatut ? { statut: nextGoStatut } : {}),
          updatedAt: new Date(),
        },
        profSpe1Candidates,
        profSpe2Candidates
      );
    } else {
      const shouldCreateFiche =
        body.grandOralActif !== false ||
        targetEleve.classeNiveau === "terminale";
      if (shouldCreateFiche) {
        await insertGrandOralWithProfFallback(
          {
            eleveId,
            anneeScolaire: ANNEE_SCOLAIRE,
            statut:
              body.grandOralActif === false ? MODULE_DESACTIVE : "brouillon",
          },
          profSpe1Candidates,
          profSpe2Candidates
        );
      }
    }

    return { ok: true };
  });
}
