import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { stages, eleves, classes } from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireUser, HttpError } from "../_shared/auth.js";
import { isStageModuleActive } from "../_shared/modules.js";

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"] as const;
const PERIODES = ["matin", "apm"] as const;
const BOUNDS = ["debut", "fin"] as const;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function horaireDbKey(jour: string, periode: string, bound: string): string {
  const periodePart = periode === "matin" ? "Matin" : "Apm";
  const boundPart = bound === "debut" ? "Debut" : "Fin";
  return `horaire${capitalize(jour)}${periodePart}${boundPart}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  await handleApi(res, async () => {
    const user = await requireUser(req);

    // Récupérer la fiche élève liée à ce compte auth
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
      // Élève sans fiche métier (compte créé mais pas encore lié à un élève importé)
      return {
        id: null,
        statut: "a_completer",
        entrepriseNom: "",
        horaires: {},
      };
    }

    const eleve = eleveRows[0];
    const existing = await db
      .select()
      .from(stages)
      .where(eq(stages.eleveId, eleve.id))
      .limit(1);

    const existingStage = existing[0] ?? null;
    const moduleActif = isStageModuleActive(
      eleve.classeNiveau,
      existingStage?.statut
    );

    if (req.method === "GET") {
      if (!moduleActif) {
        return {
          moduleActif: false,
          id: existingStage?.id ?? null,
          statut: "module_desactive",
          entrepriseNom: "",
          horaires: {},
        };
      }

      if (!existingStage) {
        return {
          moduleActif: true,
          id: null,
          statut: "a_completer",
          entrepriseNom: "",
          horaires: {},
        };
      }

      const s = existingStage;
      const horaires: Record<string, string> = {};
      for (const jour of JOURS) {
        for (const periode of PERIODES) {
          for (const bound of BOUNDS) {
            const key = horaireDbKey(jour, periode, bound);
            const val = (s as Record<string, unknown>)[key];
            if (typeof val === "string" && val) {
              horaires[`${jour}_${periode}_${bound}`] = val;
            }
          }
        }
      }
      return { ...s, moduleActif: true, horaires };
    }

    if (!moduleActif) {
      throw new HttpError(403, "Le module Stage n'est pas activé pour cet élève.");
    }

    // POST
    const body = (req.body ?? {}) as Record<string, unknown>;
    const submit = body.submit === true;

    const stageData: Record<string, unknown> = {
      eleveId: eleve.id,
      statut: submit ? "soumis" : "en_cours_saisie",
      entrepriseNom: (body.entrepriseNom as string) || null,
      entrepriseRepresentant: (body.entrepriseRepresentant as string) || null,
      entrepriseQualite: (body.entrepriseQualite as string) || null,
      entrepriseAdresse: (body.entrepriseAdresse as string) || null,
      entrepriseTelephone: (body.entrepriseTelephone as string) || null,
      entrepriseEmail: (body.entrepriseEmail as string) || null,
      entrepriseType: (body.entrepriseType as string) || null,
      tuteurNomQualite: (body.tuteurNomQualite as string) || null,
      tuteurEmail: (body.tuteurEmail as string) || null,
      tuteurTelephone: (body.tuteurTelephone as string) || null,
      faitLe: (body.faitLe as string) || null,
    };

    if (submit) stageData.soumisAt = new Date();

    const horaires = (body.horaires ?? {}) as Record<string, string>;
    for (const jour of JOURS) {
      for (const periode of PERIODES) {
        for (const bound of BOUNDS) {
          const inKey = `${jour}_${periode}_${bound}`;
          const dbKey = horaireDbKey(jour, periode, bound);
          stageData[dbKey] = horaires[inKey] || null;
        }
      }
    }

    if (existingStage) {
      const [updated] = await db
        .update(stages)
        .set(stageData)
        .where(eq(stages.id, existingStage.id))
        .returning();
      return updated;
    }

    const [inserted] = await db
      .insert(stages)
      .values(stageData as typeof stages.$inferInsert)
      .returning();
    return inserted;
  });
}
