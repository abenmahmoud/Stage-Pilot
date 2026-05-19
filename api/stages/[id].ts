import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc, eq, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import { stages, eleves, classes, professeurs } from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireRole, HttpError, type AuthUser } from "../_shared/auth.js";
import { isStageModuleActive } from "../_shared/modules.js";
import {
  canReadStageForUser,
  getProfesseurIdForUser,
} from "../_shared/access.js";

const STAGE_STATUTS = [
  "a_completer",
  "en_cours_saisie",
  "soumis",
  "convention_generee",
  "convention_signee",
  "stage_en_cours",
  "stage_termine",
  "dispense",
  "accueil_lycee",
] as const;

type StageUpdateBody = {
  statut?: string;
  professeurReferentId?: string | null;
  entrepriseNom?: string | null;
  entrepriseAdresse?: string | null;
  entrepriseTelephone?: string | null;
  entrepriseEmail?: string | null;
  entrepriseRepresentant?: string | null;
  entrepriseQualite?: string | null;
  entrepriseType?: string | null;
  tuteurNomQualite?: string | null;
  tuteurEmail?: string | null;
  tuteurTelephone?: string | null;
  faitLe?: string | null;
};

type StageAccessRow = {
  professeurPrincipalId: string | null;
  professeurReferentId: string | null;
};

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(value);
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !isUuid(value)) {
    throw new HttpError(400, "Identifiant professeur invalide");
  }
  return value;
}

function isStageStatut(value: unknown): value is (typeof STAGE_STATUTS)[number] {
  return typeof value === "string" && STAGE_STATUTS.includes(value as never);
}

function canManageStage(row: StageAccessRow, user: AuthUser): boolean {
  return (
    ["superadmin", "administration"].includes(user.role) ||
    row.professeurPrincipalId === user.id
  );
}

async function listProfesseurs() {
  return db
    .select({
      id: professeurs.id,
      authUserId: professeurs.authUserId,
      nom: professeurs.nom,
      prenom: professeurs.prenom,
      matieres: professeurs.matieres,
    })
    .from(professeurs)
    .orderBy(asc(professeurs.nom), asc(professeurs.prenom));
}

async function loadStage(eleveId: string) {
  const result = await db
    .select({
      id: stages.id,
      eleveId: stages.eleveId,
      eleveNom: eleves.nom,
      elevePrenom: eleves.prenom,
      classeNom: classes.nom,
      classeNiveau: classes.niveau,
      professeurPrincipalId: classes.professeurPrincipalId,
      statut: stages.statut,
      professeurReferentId: stages.professeurReferentId,
      professeurReferentAuthUserId: professeurs.authUserId,
      professeurReferentNom: professeurs.nom,
      professeurReferentPrenom: professeurs.prenom,
      entrepriseNom: stages.entrepriseNom,
      entrepriseAdresse: stages.entrepriseAdresse,
      entrepriseTelephone: stages.entrepriseTelephone,
      entrepriseEmail: stages.entrepriseEmail,
      entrepriseRepresentant: stages.entrepriseRepresentant,
      entrepriseQualite: stages.entrepriseQualite,
      entrepriseType: stages.entrepriseType,
      tuteurNomQualite: stages.tuteurNomQualite,
      tuteurEmail: stages.tuteurEmail,
      tuteurTelephone: stages.tuteurTelephone,
      dateDebut: stages.dateDebut,
      dateFin: stages.dateFin,
      faitLe: stages.faitLe,
    })
    .from(stages)
    .innerJoin(eleves, eq(stages.eleveId, eleves.id))
    .leftJoin(classes, eq(eleves.classeId, classes.id))
    .leftJoin(
      professeurs,
      or(
        eq(stages.professeurReferentId, professeurs.id),
        eq(stages.professeurReferentId, professeurs.authUserId)
      )
    )
    .where(eq(stages.eleveId, eleveId))
    .limit(1);

  return result[0] ?? null;
}

function formatStage(stage: NonNullable<Awaited<ReturnType<typeof loadStage>>>) {
  const effectiveStatut =
    stage.statut === "a_completer" && stage.entrepriseNom
      ? "en_cours_saisie"
      : stage.statut;

  return {
    ...stage,
    statut: effectiveStatut,
    professeurReferentId:
      stage.professeurReferentAuthUserId ?? stage.professeurReferentId,
    professeurReferent:
      stage.professeurReferentNom && stage.professeurReferentPrenom
        ? `${stage.professeurReferentNom} ${stage.professeurReferentPrenom}`
        : null,
  };
}

async function resolveProfesseurReference(value: unknown): Promise<string[]> {
  const normalized = normalizeOptionalId(value);
  if (!normalized) return [""];

  const [professeur] = await db
    .select({
      id: professeurs.id,
      authUserId: professeurs.authUserId,
    })
    .from(professeurs)
    .where(
      or(
        eq(professeurs.id, normalized),
        eq(professeurs.authUserId, normalized)
      )
    )
    .limit(1);

  if (!professeur) {
    throw new HttpError(400, "Professeur referent introuvable");
  }

  return Array.from(
    new Set([professeur.authUserId, professeur.id].filter(Boolean))
  ) as string[];
}

async function updateStageWithReferentFallback(
  stageId: string,
  updateData: Record<string, unknown>,
  professeurReferentCandidates: string[] | null
): Promise<void> {
  if (!professeurReferentCandidates) {
    await db
      .update(stages)
      .set(updateData as Partial<typeof stages.$inferInsert>)
      .where(eq(stages.id, stageId));
    return;
  }

  let lastError: unknown = null;
  for (const candidate of professeurReferentCandidates) {
    try {
      await db
        .update(stages)
        .set({
          ...(updateData as Partial<typeof stages.$inferInsert>),
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
  throw new HttpError(400, "Affectation du professeur impossible");
}

function hasEntrepriseAfterUpdate(
  stage: NonNullable<Awaited<ReturnType<typeof loadStage>>>,
  updateData: Record<string, unknown>
): boolean {
  if (Object.prototype.hasOwnProperty.call(updateData, "entrepriseNom")) {
    return typeof updateData.entrepriseNom === "string";
  }
  return Boolean(stage.entrepriseNom);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "PUT") {
    return methodNotAllowed(res, ["GET", "PUT"]);
  }

  await handleApi(res, async () => {
    const user = await requireRole(req, [
      "superadmin",
      "administration",
      "pp",
      "professeur",
      "proviseur",
    ]);
    const professeurId = await getProfesseurIdForUser(user);

    const eleveId = (req.query.id as string) || "";
    if (!eleveId || !isUuid(eleveId)) {
      throw new HttpError(400, "Identifiant eleve invalide");
    }

    const stage = await loadStage(eleveId);
    if (!stage) {
      throw new HttpError(404, "Stage introuvable pour cet eleve");
    }
    if (!isStageModuleActive(stage.classeNiveau, stage.statut)) {
      throw new HttpError(404, "Stage desactive pour cet eleve");
    }
    if (!canReadStageForUser(stage, user, professeurId)) {
      throw new HttpError(403, "Acces interdit a ce dossier de stage");
    }

    const canManage = canManageStage(stage, user);

    if (req.method === "GET") {
      return {
        ...formatStage(stage),
        canManage,
        professeurs: await listProfesseurs(),
      };
    }

    if (!canManage) {
      throw new HttpError(
        403,
        "Seule l'administration ou le professeur principal peut modifier ce stage"
      );
    }

    const body = (req.body ?? {}) as StageUpdateBody;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    let professeurReferentCandidates: string[] | null = null;

    const textFields: Array<keyof StageUpdateBody> = [
      "entrepriseNom",
      "entrepriseAdresse",
      "entrepriseTelephone",
      "entrepriseEmail",
      "entrepriseRepresentant",
      "entrepriseQualite",
      "entrepriseType",
      "tuteurNomQualite",
      "tuteurEmail",
      "tuteurTelephone",
      "faitLe",
    ];

    for (const field of textFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        updateData[field] = normalizeText(body[field]);
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "professeurReferentId")) {
      professeurReferentCandidates = await resolveProfesseurReference(
        body.professeurReferentId
      );
    }

    const hasEntreprise = hasEntrepriseAfterUpdate(stage, updateData);

    if (Object.prototype.hasOwnProperty.call(body, "statut")) {
      if (!isStageStatut(body.statut)) {
        throw new HttpError(400, "Statut de stage invalide");
      }
      updateData.statut =
        body.statut === "a_completer" && hasEntreprise
          ? "en_cours_saisie"
          : body.statut;
    } else if (stage.statut === "a_completer" && hasEntreprise) {
      updateData.statut = "en_cours_saisie";
    }

    await updateStageWithReferentFallback(
      stage.id,
      updateData,
      professeurReferentCandidates
    );

    const updatedStage = await loadStage(eleveId);
    if (!updatedStage) {
      throw new HttpError(404, "Stage introuvable apres mise a jour");
    }

    return {
      ...formatStage(updatedStage),
      canManage,
      professeurs: await listProfesseurs(),
    };
  });
}
