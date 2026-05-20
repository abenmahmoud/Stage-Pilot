import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, inArray, or } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  fichesGrandOral,
  eleves,
  classes,
  professeurs,
} from "../../../db/schema.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { requireUser, HttpError } from "../../_shared/auth.js";
import { isGrandOralModuleActive } from "../../_shared/modules.js";
import {
  canReadGrandOralForUser,
  canSignGrandOralForUser,
  getGrandOralRoleForUser,
  getProfesseurIdForUser,
} from "../../_shared/access.js";

type ProfesseurLookup = {
  id: string;
  authUserId: string | null;
  nom: string;
  prenom: string;
  matieres: string | null;
};

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

function actionMessage(
  statut: string | null,
  role: "prof_spe1" | "prof_spe2" | null,
  canSign: boolean
): string | null {
  if (!role) return null;
  if (canSign) return "C'est a vous : vous pouvez valider les questions.";
  if (statut === "brouillon") {
    return "Vous etes affecte a cette fiche. Elle est encore en brouillon : l'eleve doit saisir ses questions puis soumettre.";
  }
  if (role === "prof_spe2" && statut === "soumis_prof1") {
    return "Vous etes prof spe 2. En attente de la validation du prof spe 1.";
  }
  if (role === "prof_spe1" && statut === "soumis_prof2") {
    return "Votre validation est enregistree. En attente du prof spe 2.";
  }
  if (statut === "soumis_proviseur") {
    return "Les validations professeurs sont terminees. En attente du chef d'etablissement.";
  }
  if (statut === "finalise") return "La fiche est finalisee.";
  return "Aucune action attendue pour le moment.";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  await handleApi(res, async () => {
    const user = await requireUser(req);
    const professeurId = await getProfesseurIdForUser(user);

    const ficheId = (req.query.id as string) || "";
    if (!ficheId || !/^[0-9a-fA-F-]{36}$/.test(ficheId)) {
      throw new HttpError(400, "Identifiant fiche invalide");
    }

    const result = await db
      .select({
        id: fichesGrandOral.id,
        eleveNom: eleves.nom,
        elevePrenom: eleves.prenom,
        eleveAuthUserId: eleves.authUserId,
        classeNom: classes.nom,
        classeNiveau: classes.niveau,
        professeurPrincipalId: classes.professeurPrincipalId,
        numeroCanditat: fichesGrandOral.numeroCanditat,
        statut: fichesGrandOral.statut,
        profSpe1Id: fichesGrandOral.profSpe1Id,
        profSpe2Id: fichesGrandOral.profSpe2Id,
        question1: fichesGrandOral.question1,
        specialitesQuestion1: fichesGrandOral.specialitesQuestion1,
        question2: fichesGrandOral.question2,
        specialitesQuestion2: fichesGrandOral.specialitesQuestion2,
        commentaireProf1: fichesGrandOral.commentaireProf1,
        commentaireProf2: fichesGrandOral.commentaireProf2,
        signeProf1At: fichesGrandOral.signeProf1At,
        signeProf2At: fichesGrandOral.signeProf2At,
        cachetApposeAt: fichesGrandOral.cachetApposeAt,
      })
      .from(fichesGrandOral)
      .innerJoin(eleves, eq(fichesGrandOral.eleveId, eleves.id))
      .leftJoin(classes, eq(eleves.classeId, classes.id))
      .where(eq(fichesGrandOral.id, ficheId))
      .limit(1);

    if (result.length === 0) throw new HttpError(404, "Fiche introuvable");
    const fiche = result[0];

    if (!isGrandOralModuleActive(fiche.classeNiveau, fiche.statut)) {
      throw new HttpError(404, "Grand Oral desactive pour cet eleve");
    }
    if (!canReadGrandOralForUser(fiche, user, professeurId)) {
      throw new HttpError(403, "Acces interdit a cette fiche Grand Oral");
    }

    const profMap = await loadProfesseursByReference([
      fiche.profSpe1Id,
      fiche.profSpe2Id,
    ]);
    const currentUserGoRole = getGrandOralRoleForUser(
      fiche,
      user,
      professeurId
    );
    const canSign = canSignGrandOralForUser(fiche, user, professeurId);

    return {
      ...fiche,
      profSpe1: fiche.profSpe1Id ? profLabel(profMap.get(fiche.profSpe1Id)) : null,
      profSpe2: fiche.profSpe2Id ? profLabel(profMap.get(fiche.profSpe2Id)) : null,
      currentUserGoRole,
      canSign,
      actionMessage: actionMessage(fiche.statut, currentUserGoRole, canSign),
    };
  });
}
