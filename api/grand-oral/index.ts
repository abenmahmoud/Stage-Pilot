import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  fichesGrandOral,
  eleves,
  classes,
  professeurs,
} from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireRole } from "../_shared/auth.js";
import { isGrandOralModuleActive } from "../_shared/modules.js";
import {
  canReadGrandOralForUser,
  getGrandOralRoleForUser,
  getProfesseurIdForUser,
} from "../_shared/access.js";

const ANNEE_SCOLAIRE = "2025-2026";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  await handleApi(res, async () => {
    const user = await requireRole(req, [
      "superadmin",
      "administration",
      "pp",
      "professeur",
      "proviseur",
    ]);
    const professeurId = await getProfesseurIdForUser(user);

    const allRows = await db
      .select({
        id: fichesGrandOral.id,
        eleveId: eleves.id,
        eleveNom: eleves.nom,
        elevePrenom: eleves.prenom,
        eleveAuthUserId: eleves.authUserId,
        classeNom: classes.nom,
        classeNiveau: classes.niveau,
        professeurPrincipalId: classes.professeurPrincipalId,
        statut: fichesGrandOral.statut,
        profSpe1Id: fichesGrandOral.profSpe1Id,
        profSpe2Id: fichesGrandOral.profSpe2Id,
        question1: fichesGrandOral.question1,
        soumisAt: fichesGrandOral.soumisAt,
      })
      .from(eleves)
      .leftJoin(classes, eq(eleves.classeId, classes.id))
      .leftJoin(
        fichesGrandOral,
        and(
          eq(fichesGrandOral.eleveId, eleves.id),
          eq(fichesGrandOral.anneeScolaire, ANNEE_SCOLAIRE)
        )
      )
      .orderBy(asc(classes.nom), asc(eleves.nom), asc(eleves.prenom));

    const readableRows = allRows
      .filter((f) => isGrandOralModuleActive(f.classeNiveau, f.statut))
      .filter((f) => canReadGrandOralForUser(f, user, professeurId));

    const profMap = await loadProfesseursByReference(
      readableRows.flatMap((f) => [f.profSpe1Id, f.profSpe2Id])
    );

    const fichesList = readableRows.map((f) => ({
      ...f,
      statut: f.statut ?? "brouillon",
      specialites: null,
      profSpe1: f.profSpe1Id ? profLabel(profMap.get(f.profSpe1Id)) : null,
      profSpe2: f.profSpe2Id ? profLabel(profMap.get(f.profSpe2Id)) : null,
      currentUserGoRole: getGrandOralRoleForUser(f, user, professeurId),
    }));

    const total = fichesList.length;
    const brouillons = fichesList.filter((f) => f.statut === "brouillon").length;
    const finalises = fichesList.filter((f) => f.statut === "finalise").length;
    const enAttente = total - brouillons - finalises;

    return {
      fiches: fichesList,
      stats: { total, brouillons, enAttente, finalises },
    };
  });
}
