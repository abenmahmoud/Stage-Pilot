import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, eq, inArray } from "drizzle-orm";
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
          nom: professeurs.nom,
          prenom: professeurs.prenom,
          matieres: professeurs.matieres,
        })
        .from(professeurs)
        .orderBy(asc(professeurs.nom), asc(professeurs.prenom));

      return {
        eleves: eleveRows.map((eleve) => ({
          ...eleve,
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

    if (!eleveId) {
      throw new HttpError(400, "Élève manquant.");
    }

    const profIds = Array.from(
      new Set([professeurReferentId, profSpe1Id, profSpe2Id].filter(Boolean))
    ) as string[];

    if (profIds.length > 0) {
      const existing = await db
        .select({ id: professeurs.id })
        .from(professeurs)
        .where(inArray(professeurs.id, profIds));
      if (existing.length !== profIds.length) {
        throw new HttpError(400, "Un des professeurs sélectionnés est introuvable.");
      }
    }

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

      await db
        .update(stages)
        .set({
          professeurReferentId,
          ...(nextStageStatut ? { statut: nextStageStatut } : {}),
        })
        .where(eq(stages.id, existingStage[0].id));
    } else {
      const shouldCreateStage =
        body.stageActif !== false || targetEleve.classeNiveau === "seconde";
      if (shouldCreateStage) {
        await db.insert(stages).values({
          eleveId,
          statut:
            body.stageActif === false
              ? MODULE_DESACTIVE
              : stageStatusWhenActivated(targetEleve.classeNiveau),
          professeurReferentId,
        });
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

      await db
        .update(fichesGrandOral)
        .set({
          profSpe1Id: body.grandOralActif === false ? null : profSpe1Id,
          profSpe2Id: body.grandOralActif === false ? null : profSpe2Id,
          ...(nextGoStatut ? { statut: nextGoStatut } : {}),
          updatedAt: new Date(),
        })
        .where(eq(fichesGrandOral.id, existingFiche[0].id));
    } else {
      const shouldCreateFiche =
        body.grandOralActif !== false ||
        targetEleve.classeNiveau === "terminale";
      if (shouldCreateFiche) {
        await db.insert(fichesGrandOral).values({
          eleveId,
          anneeScolaire: ANNEE_SCOLAIRE,
          profSpe1Id: body.grandOralActif === false ? null : profSpe1Id,
          profSpe2Id: body.grandOralActif === false ? null : profSpe2Id,
          statut: body.grandOralActif === false ? MODULE_DESACTIVE : "brouillon",
        });
      }
    }

    return { ok: true };
  });
}
