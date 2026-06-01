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
const EDITABLE_STATUTS = ["a_completer", "en_cours_saisie"] as const;
const REQUIRED_SUBMIT_FIELDS = [
  "entrepriseNom",
  "entrepriseType",
  "entrepriseAdresse",
  "entrepriseRepresentant",
  "entrepriseQualite",
  "tuteurNomQualite",
] as const;

type StageSelect = typeof stages.$inferSelect;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function horaireDbKey(jour: string, periode: string, bound: string): string {
  const periodePart = periode === "matin" ? "Matin" : "Apm";
  const boundPart = bound === "debut" ? "Debut" : "Fin";
  return `horaire${capitalize(jour)}${periodePart}${boundPart}`;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function serializeStage(stage: StageSelect, moduleActif = true) {
  const horaires: Record<string, string> = {};
  for (const jour of JOURS) {
    for (const periode of PERIODES) {
      for (const bound of BOUNDS) {
        const key = horaireDbKey(jour, periode, bound);
        const val = (stage as Record<string, unknown>)[key];
        if (typeof val === "string" && val) {
          horaires[`${jour}_${periode}_${bound}`] = val;
        }
      }
    }
  }
  return { ...stage, moduleActif, horaires };
}

function isEditableByEleve(statut: string | null | undefined): boolean {
  return EDITABLE_STATUTS.includes(statut as (typeof EDITABLE_STATUTS)[number]);
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

      return serializeStage(existingStage, true);
    }

    if (!moduleActif) {
      throw new HttpError(403, "Le module Stage n'est pas activé pour cet élève.");
    }

    // POST
    const body = (req.body ?? {}) as Record<string, unknown>;
    const submit = body.submit === true;

    if (existingStage && !isEditableByEleve(existingStage.statut)) {
      throw new HttpError(
        400,
        "Le dossier a deja ete envoye pour verification. Seuls l'administration ou le professeur principal peuvent le modifier."
      );
    }

    const stageData: Record<string, unknown> = {
      eleveId: eleve.id,
      statut: submit ? "soumis" : "en_cours_saisie",
      entrepriseNom: normalizeText(body.entrepriseNom),
      entrepriseRepresentant: normalizeText(body.entrepriseRepresentant),
      entrepriseQualite: normalizeText(body.entrepriseQualite),
      entrepriseAdresse: normalizeText(body.entrepriseAdresse),
      entrepriseTelephone: normalizeText(body.entrepriseTelephone),
      entrepriseEmail: normalizeText(body.entrepriseEmail),
      entrepriseType: normalizeText(body.entrepriseType),
      tuteurNomQualite: normalizeText(body.tuteurNomQualite),
      tuteurEmail: normalizeText(body.tuteurEmail),
      tuteurTelephone: normalizeText(body.tuteurTelephone),
      faitLe: normalizeText(body.faitLe),
      updatedAt: new Date(),
    };

    if (submit) {
      const missingFields = REQUIRED_SUBMIT_FIELDS.filter(
        (field) => !stageData[field]
      );
      if (missingFields.length > 0) {
        throw new HttpError(
          400,
          "Complete les informations obligatoires avant d'envoyer le dossier."
        );
      }
      stageData.soumisAt = new Date();
    }

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
      return serializeStage(updated, true);
    }

    const [inserted] = await db
      .insert(stages)
      .values(stageData as typeof stages.$inferInsert)
      .returning();
    return serializeStage(inserted, true);
  });
}
